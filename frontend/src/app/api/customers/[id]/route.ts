import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;

    // Fetch customer with related data (visits, orders, followups)
    const customer = await fetchFromSupabase(`/belarro_v4_customer?id=eq.${id}&select=*`);
    
    if (!customer || customer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerData = customer[0];

    const [visits, orders, followups] = await Promise.all([
      fetchFromSupabase(`/belarro_v4_visit?customer_id=eq.${id}&select=*&order=visit_date.desc`),
      fetchFromSupabase(`/belarro_v4_order?customer_id=eq.${id}&select=*&order=created_at.desc`),
      fetchFromSupabase(`/belarro_v4_follow_up?customer_id=eq.${id}&select=*&order=due_date.asc`),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...customerData,
        visits: visits || [],
        orders: orders || [],
        follow_ups: followups || [],
      },
    });
  } catch (error) {
    console.error('Customer GET error:', error);
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

    const customer = await fetchFromSupabase(`/belarro_v4_customer?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    return NextResponse.json({
      success: true,
      data: customer ? customer[0] : body,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    console.error('Customer PUT error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;

    // Delete customer (Supabase cascade constraints will delete follow-ups/visits/orders)
    await fetchFromSupabase(`/belarro_v4_customer?id=eq.${id}`, {
      method: 'DELETE',
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Customer DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
