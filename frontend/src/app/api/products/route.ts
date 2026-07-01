import { NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const data = await fetchFromSupabase('/products?order=sort_order.asc');
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
