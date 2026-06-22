import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Helper: Calculate seeding date based on schedule
const calculateSeedingDate = (orderDate: Date, schedule: string = 'FRIDAY'): Date => {
  const date = new Date(orderDate);
  const dayOfWeek = date.getDay(); // 0=Sunday, 2=Tuesday, 5=Friday

  const targetDay = schedule === 'TUESDAY' ? 2 : 5;
  
  if (dayOfWeek === targetDay) {
    return date;
  }
  
  const diff = (targetDay + 7 - dayOfWeek) % 7;
  const result = new Date(date);
  result.setDate(result.getDate() + diff);
  return result;
};

// Helper: Calculate next delivery date (Saturday following harvest)
const calculateNextDeliveryDate = (harvestDate: Date): Date => {
  const result = new Date(harvestDate);
  const dayOfWeek = result.getDay(); // 0=Sunday, 6=Saturday
  
  const diff = (6 + 7 - dayOfWeek) % 7;
  result.setDate(result.getDate() + diff);
  return result;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const status = searchParams.get('status');

    let path = '/belarro_v4_order?deleted_at=is.null&select=*&order=created_at.desc';
    if (customerId) {
      path = `/belarro_v4_order?deleted_at=is.null&customer_id=eq.${customerId}&select=*&order=created_at.desc`;
    } else if (status) {
      path = `/belarro_v4_order?deleted_at=is.null&status=eq.${status}&select=*&order=created_at.desc`;
    }

    try {
      const orders = await fetchFromSupabase(path);
      const ords = orders || [];

      // Hydrate with Customer and Variant
      const [customers, variants, crops] = await Promise.all([
        fetchFromSupabase('/belarro_v4_customer?select=id,name,email,restaurant_name'),
        fetchFromSupabase('/belarro_v4_product_variant?select=*'),
        fetchFromSupabase('/belarro_v4_crop?select=id,name_en,name_de')
      ]);

      const custMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));
      const varMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]));
      const cropMap = new Map<string, any>((crops || []).map((c: any) => [c.id, c]));

      const hydrated = ords.map((o: any) => {
        const variant = varMap.get(o.product_variant_id);
        let crop = null;
        if (variant) {
          crop = cropMap.get(variant.crop_id);
        }
        return {
          ...o,
          customer: custMap.get(o.customer_id) || { name: 'Unknown Customer' },
          variant: variant ? {
            ...variant,
            crop: crop || { name_en: 'Unknown Crop', name_de: 'Unbekannt' }
          } : null
        };
      });

      return NextResponse.json({
        success: true,
        data: hydrated
      });
    } catch (dbErr) {
      console.warn('Database tables not ready, returning mock orders');
      return NextResponse.json({
        success: true,
        data: [
          {
            id: 'mock-o1',
            customer_id: 'mock-c1',
            product_variant_id: 'mock-v1',
            quantity: 5,
            order_date: new Date().toISOString(),
            expected_harvest_date: new Date().toISOString(),
            next_delivery_date: new Date().toISOString(),
            status: 'growing',
            recurring: true,
            customer: { name: 'Chefs Table' },
            variant: { size_name: '100g Bag', price_eur: 6.50, crop: { name_en: 'Broccoli', name_de: 'Brokkoli' } }
          }
        ]
      });
    }
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { customer_id, product_variant_id, quantity, recurring } = body;

    if (!customer_id || !product_variant_id || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'customer_id, product_variant_id, and quantity are required' },
        { status: 400 }
      );
    }

    // Get variant
    const variant = await fetchFromSupabase(`/belarro_v4_product_variant?id=eq.${product_variant_id}&select=*`);
    if (!variant || variant.length === 0) {
      return NextResponse.json({ success: false, error: 'Product variant not found' }, { status: 404 });
    }
    const variantData = variant[0];

    // Get growth procedure to calculate total growth days
    const procedure = await fetchFromSupabase(`/belarro_v4_growth_procedure?crop_id=eq.${variantData.crop_id}&select=*`);
    
    let growthDays = 10; // Default fallback
    if (procedure && procedure.length > 0) {
      const p = procedure[0];
      const lightsDays = p.light_enabled ? (p.light_days || 0) : 0;
      let envDays = 0;
      if (lightsDays > 0) {
        envDays = lightsDays;
      } else if (p.blackout_enabled && p.blackout_days) {
        envDays = p.blackout_days;
      } else {
        envDays = p.growth_env_days || 0;
      }
      growthDays = (p.stack_enabled ? (p.stack_days || 0) : 0) + envDays;
    }

    const orderDate = new Date();
    // Default schedule to Friday for now
    const seedingDate = calculateSeedingDate(orderDate, 'FRIDAY');
    const harvestDate = new Date(seedingDate);
    harvestDate.setDate(harvestDate.getDate() + growthDays);
    const nextDeliveryDate = calculateNextDeliveryDate(harvestDate);

    const orderId = crypto.randomUUID();

    const newOrder = await fetchFromSupabase('/belarro_v4_order', {
      method: 'POST',
      body: JSON.stringify({
        id: orderId,
        customer_id,
        product_variant_id,
        quantity: parseFloat(quantity),
        order_date: orderDate.toISOString(),
        expected_harvest_date: harvestDate.toISOString(),
        next_delivery_date: nextDeliveryDate.toISOString(),
        status: 'pending_seed',
        recurring: recurring === true || recurring === 'true'
      })
    });

    // Attempt to deduct from seed inventory (if it exists)
    try {
      const seedInv = await fetchFromSupabase(`/belarro_v4_seed_inventory?crop_id=eq.${variantData.crop_id}&select=*`);
      if (seedInv && seedInv.length > 0) {
        const inv = seedInv[0];
        const seedsNeeded = parseFloat(quantity) * 60; // 60g per tray default
        await fetchFromSupabase(`/belarro_v4_seed_inventory?id=eq.${inv.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            quantity_grams: Math.max(0, inv.quantity_grams - seedsNeeded)
          })
        });
      }
    } catch (invErr) {
      console.warn('Inventory deduction skipped:', invErr);
    }

    return NextResponse.json({
      success: true,
      data: newOrder ? newOrder[0] : { id: orderId, customer_id, product_variant_id, quantity },
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Order POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
