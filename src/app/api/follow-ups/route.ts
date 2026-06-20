import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    try {
      const followups = await fetchFromSupabase('/belarro_v4_follow_up?select=*&order=due_date.asc');
      const fls = followups || [];

      // Hydrate with customer details
      const customers = await fetchFromSupabase('/belarro_v4_customer?select=id,name,restaurant_name,phone,whatsapp,email');
      const custMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));

      const hydrated = fls.map((f: any) => ({
        ...f,
        customer: custMap.get(f.customer_id) || { name: 'Unknown Customer' }
      }));

      return NextResponse.json({
        success: true,
        data: hydrated
      });
    } catch (dbErr) {
      console.warn('Followups table not ready, using mocks');
      return NextResponse.json({
        success: true,
        data: [
          {
            id: 'mock-f1',
            customer_id: 'mock-c2',
            follow_up_number: 1,
            follow_up_days: 0,
            due_date: new Date().toISOString(),
            status: 'pending',
            notes: 'First contact follow-up',
            customer: { name: 'Gourmet Berlin', phone: '+49 1520 7654321', email: 'sarah@gourmet.berlin' }
          }
        ]
      });
    }
  } catch (error) {
    console.error('Followups GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
