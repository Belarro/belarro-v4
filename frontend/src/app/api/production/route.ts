import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Tuesday = 2, Friday = 5 (JS: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat)
const TUESDAY = 2;
const FRIDAY = 5;

// Snap a date back to the nearest Tuesday or Friday ON OR BEFORE the given date
function snapToSeedDay(date: Date, useTuesday: boolean): Date {
  const target = useTuesday ? TUESDAY : FRIDAY;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() !== target) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// Next Tuesday on or after a given date
function nextTuesdayOnOrAfter(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() !== TUESDAY) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// Format date as YYYY-MM-DD
function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

// Format for display
function fmt(d: Date): string {
  return d.toLocaleDateString('en-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const [orders, variants, crops, procedures, customers, batches, harvests] = await Promise.all([
      fetchFromSupabase('/belarro_v4_order?status=in.(pending_seed,growing)&select=*'),
      fetchFromSupabase('/belarro_v4_product_variant?select=*'),
      fetchFromSupabase('/belarro_v4_crop?select=*'),
      fetchFromSupabase('/belarro_v4_growth_procedure?select=*'),
      fetchFromSupabase('/belarro_v4_customer?select=id,name&deleted_at=is.null'),
      fetchFromSupabase('/belarro_v4_seeding_batch?select=*'),
      fetchFromSupabase('/belarro_v4_harvest_record?select=*'),
    ]);

    const varMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]));
    const cropMap = new Map<string, any>((crops || []).map((c: any) => [c.id, c]));
    const procMap = new Map<string, any>((procedures || []).map((p: any) => [p.crop_id, p]));
    const custMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));

    // Active batches (in the ground, not yet harvested)
    const harvestedIds = new Set((harvests || []).map((h: any) => h.seeding_batch_id));
    const activeBatches = (batches || [])
      .filter((b: any) => !harvestedIds.has(b.id))
      .map((b: any) => ({
        ...b,
        crop: cropMap.get(b.crop_id) || { name_en: 'Unknown', name_de: '' },
      }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const readyToHarvest = activeBatches.filter((b: any) => new Date(b.expected_harvest_date) <= today);

    // ── PRODUCTION CALENDAR ────────────────────────────────────────────
    // Group orders by customer — all items for one customer share a delivery date
    const customerGroups = new Map<string, any[]>();
    for (const order of (orders || [])) {
      const cid = order.customer_id;
      if (!customerGroups.has(cid)) customerGroups.set(cid, []);
      customerGroups.get(cid)!.push(order);
    }

    // For each customer group, compute grow days per item and find harvest Tuesday
    const schedule: Record<string, {
      harvest_date: string;
      harvest_display: string;
      customer_name: string;
      items: {
        crop_name: string;
        grow_days: number;
        seed_date: string;
        seed_display: string;
        seed_day: string; // 'Tuesday' | 'Friday'
        quantity_trays: number;
        order_id: string;
        crop_id: string;
        status: string;
      }[];
    }> = {};

    for (const [customerId, customerOrders] of customerGroups) {
      const customer = custMap.get(customerId);
      const customerName = customer?.name || `Customer ${customerId.slice(0, 6)}`;

      // Compute grow days for each order line
      const lines = customerOrders.map((order: any) => {
        const variant = varMap.get(order.product_variant_id);
        const crop = variant ? cropMap.get(variant.crop_id) : null;
        const proc = crop ? procMap.get(crop.id) : null;
        const growDays = (proc?.stack_days || 0) + (proc?.growth_env_days || 0) || 7; // default 7 if not set
        return { order, crop, growDays };
      });

      // Longest grow time determines the earliest possible harvest Tuesday
      const maxGrowDays = Math.max(...lines.map(l => l.growDays));

      // Earliest raw harvest = today + maxGrowDays
      const earliestRaw = new Date(today);
      earliestRaw.setDate(earliestRaw.getDate() + maxGrowDays);
      const harvestTuesday = nextTuesdayOnOrAfter(earliestRaw);
      const harvestKey = ymd(harvestTuesday);

      if (!schedule[harvestKey]) {
        schedule[harvestKey] = {
          harvest_date: harvestKey,
          harvest_display: fmt(harvestTuesday),
          customer_name: customerName,
          items: [],
        };
      } else {
        // Multiple customers on the same harvest Tuesday — append customer name
        schedule[harvestKey].customer_name += `, ${customerName}`;
      }

      for (const { order, crop, growDays } of lines) {
        // Seed date = harvestTuesday minus growDays
        const rawSeedDate = new Date(harvestTuesday);
        rawSeedDate.setDate(rawSeedDate.getDate() - growDays);

        // Snap to seeding day: ≥10 days = Tuesday seeding, <10 days = Friday seeding
        const useTuesday = growDays >= 10;
        const seedDate = snapToSeedDay(rawSeedDate, useTuesday);

        schedule[harvestKey].items.push({
          crop_name: crop?.name_en || 'Unknown',
          grow_days: growDays,
          seed_date: ymd(seedDate),
          seed_display: fmt(seedDate),
          seed_day: useTuesday ? 'Tuesday' : 'Friday',
          quantity_trays: order.quantity || 1,
          order_id: order.id,
          crop_id: crop?.id || '',
          status: order.status,
        });
      }
    }

    // Sort schedule by harvest date
    const sortedSchedule = Object.values(schedule).sort(
      (a, b) => new Date(a.harvest_date).getTime() - new Date(b.harvest_date).getTime()
    );

    // What to seed this Tuesday and this Friday
    const nextTuesday = nextTuesdayOnOrAfter(today);
    const nextFriday = new Date(today);
    while (nextFriday.getDay() !== FRIDAY) nextFriday.setDate(nextFriday.getDate() + 1);

    const todayKey = ymd(today);
    const tuesdayKey = ymd(nextTuesday);
    const fridayKey = ymd(nextFriday);

    // Flatten all schedule items, group by seed_date
    const bySeedDate = new Map<string, any[]>();
    for (const delivery of sortedSchedule) {
      for (const item of delivery.items) {
        if (!bySeedDate.has(item.seed_date)) bySeedDate.set(item.seed_date, []);
        bySeedDate.get(item.seed_date)!.push({ ...item, customer_name: delivery.customer_name, harvest_display: delivery.harvest_display });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        schedule: sortedSchedule,
        seed_today: bySeedDate.get(todayKey) || [],
        seed_tuesday: bySeedDate.get(tuesdayKey) || [],
        seed_friday: bySeedDate.get(fridayKey) || [],
        active_batches: activeBatches,
        ready_to_harvest: readyToHarvest,
        today: todayKey,
        next_tuesday: tuesdayKey,
        next_friday: fridayKey,
      },
    });
  } catch (error) {
    console.error('Production GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
