import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

// Add N business days (skip Sat=6, Sun=0) to a date
function addBusinessDays(from: Date, days: number): Date {
  if (days === 0) return from;
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

// Days between stages for new lead flow
const NEW_LEAD_GAPS: Record<number, number> = { 1: 0, 2: 2, 3: 5, 4: 14, 5: 30 };
// Days between stages for re-engage flow
const REENGAGE_GAPS: Record<number, number> = { 1: 0, 2: 5, 3: 14, 4: 30 };

export async function DELETE(_request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;

    // Get the follow-up to find location_id
    const current = await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${id}&select=location_id`);
    const locationId = current?.[0]?.location_id;

    // Delete all follow-ups for this location
    if (locationId) {
      await fetchFromSupabase(`/belarro_v4_follow_up?location_id=eq.${locationId}`, { method: 'DELETE' });
      await fetchFromSupabase(`/locations?id=eq.${locationId}`, { method: 'DELETE' });
    } else {
      await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${id}`, { method: 'DELETE' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Follow-up DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;
    const body = await request.json();
    const { status, sent_via, notes } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: 'status is required' }, { status: 400 });
    }

    const now = new Date();

    // Mark this stage as completed
    await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        sent_via: sent_via || null,
        sent_date: status === 'completed' || status === 'sent' ? now.toISOString() : null,
        notes: notes || null,
        updated_at: now.toISOString()
      })
    });

    // Recalculate next stage due date from actual sent time (not for replied — that's manual)
    if (status === 'completed' || status === 'sent') {
      // Get this follow-up to find location_id and stage
      const current = await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${id}&select=*`);
      if (current && current.length > 0) {
        const cur = current[0];
        const nextStage = (cur.stage || cur.follow_up_number || 1) + 1;

        // Find next pending stage for this location
        const next = await fetchFromSupabase(
          `/belarro_v4_follow_up?location_id=eq.${cur.location_id}&stage=eq.${nextStage}&status=eq.pending&select=id,stage,follow_up_days`
        );

        if (next && next.length > 0) {
          const n = next[0];
          // Determine flow from existing follow_up_days pattern
          const gaps = n.follow_up_days <= 14 && nextStage <= 4
            ? REENGAGE_GAPS
            : NEW_LEAD_GAPS;
          const daysToAdd = gaps[nextStage] ?? n.follow_up_days ?? 2;
          const newDueDate = addBusinessDays(now, daysToAdd);

          await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${n.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              due_date: newDueDate.toISOString(),
              updated_at: now.toISOString()
            })
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Follow-up logged successfully'
    });
  } catch (error) {
    console.error('Follow-up PUT error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
