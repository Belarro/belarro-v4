import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;

    await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${id}`, { method: 'DELETE' });

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

    const updated = await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        sent_via: sent_via || null,
        sent_date: status === 'completed' || status === 'sent' ? new Date().toISOString() : null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
    });

    return NextResponse.json({
      success: true,
      data: updated ? updated[0] : null,
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
