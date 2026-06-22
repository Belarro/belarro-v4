import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { location_id } = await request.json();
    if (!location_id) return NextResponse.json({ success: false, error: 'location_id required' }, { status: 400 });

    // Mark location as active in locations table
    await fetchFromSupabase(`/locations?id=eq.${location_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pipeline_stage: 'active', updated_at: new Date().toISOString() }),
    });

    // Close all pending follow-ups for this location
    await fetchFromSupabase(`/belarro_v4_follow_up?location_id=eq.${location_id}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
