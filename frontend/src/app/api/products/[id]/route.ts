import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, props: Params) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const { id } = await props.params;
    const body = await request.json();
    await fetchFromSupabase(`/products?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
