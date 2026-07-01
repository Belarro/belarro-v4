import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { logError } from '@/lib/logger';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, props: Params) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const { id } = await props.params;

    const order = await fetchFromSupabase(`/belarro_v4_order?id=eq.${id}&select=*`);
    if (!order || order.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderData = order[0];

    // Hydrate Customer and Variant details
    const [customer, variant] = await Promise.all([
      fetchFromSupabase(`/belarro_v4_customer?id=eq.${orderData.customer_id}&select=*`),
      fetchFromSupabase(`/belarro_v4_product_variant?id=eq.${orderData.product_variant_id}&select=*`)
    ]);

    let crop = null;
    if (variant && variant.length > 0) {
      const cr = await fetchFromSupabase(`/belarro_v4_crop?id=eq.${variant[0].crop_id}&select=*`);
      if (cr && cr.length > 0) crop = cr[0];
    }

    return NextResponse.json({
      success: true,
      data: {
        ...orderData,
        customer: customer ? customer[0] : null,
        variant: variant ? { ...variant[0], crop } : null
      }
    });
  } catch (error) {
    await logError('GET /api/orders/[id]', error, { status: 500 });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: Params) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const { id } = await props.params;
    const body = await request.json();

    const order = await fetchFromSupabase(`/belarro_v4_order?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    return NextResponse.json({
      success: true,
      data: order ? order[0] : body,
      message: 'Order updated successfully',
    });
  } catch (error) {
    await logError('PUT /api/orders/[id]', error, { status: 500 });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: Params) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const { id } = await props.params;

    // Soft delete (Data Protection Mandate).
    await fetchFromSupabase(`/belarro_v4_order?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    await logError('DELETE /api/orders/[id]', error, { status: 500 });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
