import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // End of "today" in UTC. Due = due_date <= end of today AND status pending.
    // This intentionally includes overdue items so nothing slips through.
    const now = new Date();
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    ).toISOString();

    const path =
      `/belarro_v4_follow_up` +
      `?status=eq.pending` +
      `&due_date=lte.${endOfToday}` +
      `&select=*` +
      `&order=due_date.asc`;

    const followups = (await fetchFromSupabase(path)) || [];

    // Hydrate with customer details (one extra read, small table).
    const customers =
      (await fetchFromSupabase(
        '/belarro_v4_customer?select=id,name,restaurant_name,contact_person,phone,whatsapp,email'
      )) || [];
    const custMap = new Map<string, any>(customers.map((c: any) => [c.id, c]));

    const startOfTodayMs = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    ).getTime();

    const data = followups.map((f: any) => {
      const customer = custMap.get(f.customer_id) || { name: 'Unknown Customer' };
      const due = new Date(f.due_date);
      return {
        ...f,
        customer,
        is_overdue: due.getTime() < startOfTodayMs,
      };
    });

    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Follow-ups today GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
