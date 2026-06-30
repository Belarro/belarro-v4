import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

function isoWeek(d: Date): number {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// All Tuesdays in a given YYYY-MM
function tuesdaysInMonth(year: number, month: number): Date[] {
  const tuesdays: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month - 1) {
    tuesdays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return tuesdays;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ success: false, error: 'month param required (YYYY-MM)' }, { status: 400 });
    }

    const [year, mon] = month.split('-').map(Number);
    const tuesdays = tuesdaysInMonth(year, mon);

    const [orders, variants, crops, customers] = await Promise.all([
      fetchFromSupabase('/belarro_v4_order?deleted_at=is.null&select=*').catch((e: any) => { throw new Error('orders: ' + e.message); }),
      fetchFromSupabase('/belarro_v4_product_variant?select=*').catch((e: any) => { throw new Error('variants: ' + e.message); }),
      fetchFromSupabase('/belarro_v4_crop?select=id,name_en&deleted_at=is.null').catch((e: any) => { throw new Error('crops: ' + e.message); }),
      fetchFromSupabase('/belarro_v4_customer?select=id,name,restaurant_name,email,address').catch((e: any) => { throw new Error('customers: ' + e.message); }),
    ]);

    const varMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]));
    const cropMap = new Map<string, any>((crops || []).map((c: any) => [c.id, c]));
    const custMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));

    // Group orders by customer — include even if customer not in custMap (fetch all customers without deleted_at filter as fallback)
    const byCustomer = new Map<string, any[]>();
    for (const order of (orders || [])) {
      if (!byCustomer.has(order.customer_id)) byCustomer.set(order.customer_id, []);
      byCustomer.get(order.customer_id)!.push(order);
    }

    const invoices = Array.from(byCustomer.entries()).map(([customerId, custOrders]) => {
      const customer = custMap.get(customerId);
      if (!customer) return null;
      const customerName = customer.restaurant_name || customer.name || 'Unknown';

      // Build line items: one per order per applicable Tuesday
      const lines: any[] = [];

      for (const order of custOrders) {
        const variant = varMap.get(order.product_variant_id);
        const crop = variant ? cropMap.get(variant.crop_id) : null;
        if (!variant || !crop) continue;

        const unitPrice = variant.price_eur ?? 0;
        const qty = order.quantity || 1;

        for (const tuesday of tuesdays) {
          if (order.frequency === 'biweekly' && isoWeek(tuesday) % 2 !== 0) continue;

          lines.push({
            id: `${order.id}-${tuesday.toISOString().split('T')[0]}`,
            order_id: order.id,
            delivery_date: tuesday.toISOString().split('T')[0],
            crop_name: crop.name_en,
            size_name: variant.size_name,
            qty,
            unit_price: unitPrice,
            line_total: +(qty * unitPrice).toFixed(2),
            removed: false,
            qty_override: null as number | null,
          });
        }
      }

      lines.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date) || a.crop_name.localeCompare(b.crop_name));

      const subtotal = lines.reduce((s, l) => s + (l.removed ? 0 : l.line_total), 0);

      return {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        customer_tax_number: null,
        net_days: 30,
        month,
        lines,
        subtotal: +subtotal.toFixed(2),
        vat: +(subtotal * 0.07).toFixed(2),
        total: +(subtotal * 1.07).toFixed(2),
      };
    }).filter(Boolean).sort((a: any, b: any) => a.customer_name.localeCompare(b.customer_name));

    return NextResponse.json({
      success: true,
      data: invoices,
      tuesdays: tuesdays.map(t => t.toISOString().split('T')[0]),
      _debug: {
        order_count: (orders || []).length,
        variant_count: (variants || []).length,
        crop_count: (crops || []).length,
        customer_count: (customers || []).length,
        invoices_generated: invoices.length,
      }
    });
  } catch (error) {
    console.error('Invoice generate error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
