import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const { id, crop_id, quantity_grams, seeds_per_tray, reorder_threshold_trays } = await request.json();

    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    await fetchFromSupabase(`/belarro_v4_seed_inventory?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        crop_id,
        quantity_grams,
        seeds_per_tray,
        reorder_threshold_trays,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
