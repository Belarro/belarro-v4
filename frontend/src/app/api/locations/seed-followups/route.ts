import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Fetch all locations that are not active/archived
    const locations = await fetchFromSupabase(
      `/locations?select=id,location_name,timestamp,created_at&archived=neq.YES&pipeline_stage=neq.active`
    );

    if (!locations || locations.length === 0) {
      return NextResponse.json({ success: true, result: { created: 0, skipped: 0 } });
    }

    let created = 0;
    let skipped = 0;

    for (const loc of locations) {
      // Check if follow-ups already exist
      const existing = await fetchFromSupabase(
        `/belarro_v4_follow_up?location_id=eq.${loc.id}&select=id&limit=1`
      );
      if (existing && existing.length > 0) { skipped++; continue; }

      // Parse visit date
      // Always schedule from now — if visit was in the past, start fresh
      const base = new Date();

      const stages = [
        { stage: 1, follow_up_number: 1, follow_up_days: 0,  offset: 2 * 60 * 60 * 1000 },
        { stage: 2, follow_up_number: 2, follow_up_days: 2,  offset: 2  * 24 * 60 * 60 * 1000 },
        { stage: 3, follow_up_number: 3, follow_up_days: 5,  offset: 5  * 24 * 60 * 60 * 1000 },
        { stage: 4, follow_up_number: 4, follow_up_days: 14, offset: 14 * 24 * 60 * 60 * 1000 },
        { stage: 5, follow_up_number: 5, follow_up_days: 30, offset: 30 * 24 * 60 * 60 * 1000 },
      ];

      for (const s of stages) {
        await fetchFromSupabase('/belarro_v4_follow_up', {
          method: 'POST',
          body: JSON.stringify({
            id: crypto.randomUUID(),
            location_id: loc.id,
            follow_up_number: s.follow_up_number,
            follow_up_days: s.follow_up_days,
            stage: s.stage,
            due_date: new Date(base.getTime() + s.offset).toISOString(),
            status: 'pending',
          }),
        });
      }
      created++;
    }

    return NextResponse.json({ success: true, result: { created, skipped } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
