import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Tuesday = 2, Friday = 5 (JS: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat)
const TUESDAY = 2;
const FRIDAY = 5;

// Find the latest Tuesday or Friday that is ON OR BEFORE the given date.
// This ensures we don't seed too late — we must seed on or before the required date.
function snapToSeedDay(date: Date, useTuesday: boolean): Date {
  const target = useTuesday ? TUESDAY : FRIDAY;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Walk backward until we land on the right day
  while (d.getDay() !== target) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// Next occurrence of a day (0-6) on or after a given date
function nextDayOnOrAfter(from: Date, day: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() !== day) d.setDate(d.getDate() + 1);
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
      fetchFromSupabase('/belarro_v4_growth_procedure?select=crop_id,stack_days,blackout_days,light_days'),
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
    // One delivery group per customer. Within each group, crops are deduplicated
    // (multiple order lines for the same crop → sum trays).

    const customerGroups = new Map<string, any[]>();
    for (const order of (orders || [])) {
      const cid = order.customer_id;
      if (!customerGroups.has(cid)) customerGroups.set(cid, []);
      customerGroups.get(cid)!.push(order);
    }

    const schedule: {
      harvest_date: string;
      harvest_display: string;
      customer_id: string;
      customer_name: string;
      items: {
        crop_id: string;
        crop_name: string;
        grow_days: number;
        seed_date: string;
        seed_display: string;
        seed_day: string;
        quantity_trays: number;
      }[];
    }[] = [];

    for (const [customerId, customerOrders] of customerGroups) {
      const customer = custMap.get(customerId);
      const customerName = customer?.name || null;
      if (!customerName) continue; // skip orders with no real customer name

      // Resolve crop + grow days per order line
      const lines = customerOrders.map((order: any) => {
        const variant = varMap.get(order.product_variant_id);
        const crop = variant ? cropMap.get(variant.crop_id) : null;
        const proc = crop ? procMap.get(crop.id) : null;
        // humidity_dome is concurrent — don't add. blackout is sequential — add.
        const growDays = proc
          ? (proc.stack_days || 0) + (proc.blackout_days || 0) + (proc.light_days || 0)
          : 0;
        return { order, crop, growDays: growDays > 0 ? growDays : null };
      }).filter((l: any) => l.crop); // skip lines with no crop

      if (lines.length === 0) continue;

      // Only use grow days we actually know — skip unknowns for harvest calc
      const knownGrowDays = lines.map((l: any) => l.growDays).filter((d: any) => d !== null) as number[];
      const maxGrowDays = knownGrowDays.length > 0 ? Math.max(...knownGrowDays) : 7;

      const earliestRaw = new Date(today);
      earliestRaw.setDate(earliestRaw.getDate() + maxGrowDays);
      const harvestTuesday = nextTuesdayOnOrAfter(earliestRaw);

      // Deduplicate by crop — sum trays for same crop
      const byCrop = new Map<string, { crop: any; growDays: number | null; trays: number }>();
      for (const { order, crop, growDays } of lines) {
        const key = crop.id;
        if (!byCrop.has(key)) {
          byCrop.set(key, { crop, growDays, trays: 0 });
        }
        byCrop.get(key)!.trays += (order.quantity || 1);
      }

      const items = Array.from(byCrop.values()).map(({ crop, growDays, trays }) => {
        if (growDays === null) {
          return {
            crop_id: crop.id,
            crop_name: crop.name_en,
            grow_days: 0,
            seed_date: '',
            seed_display: '⚠️ Set grow days in crop config',
            seed_day: '—',
            quantity_trays: trays,
          };
        }
        const rawSeedDate = new Date(harvestTuesday);
        rawSeedDate.setDate(rawSeedDate.getDate() - growDays);
        const useTuesday = growDays >= 10; // 10+ days → Tuesday seed; <10 days → Friday seed
        const seedDate = snapToSeedDay(rawSeedDate, useTuesday);
        return {
          crop_id: crop.id,
          crop_name: crop.name_en,
          grow_days: growDays,
          seed_date: ymd(seedDate),
          seed_display: fmt(seedDate),
          seed_day: useTuesday ? 'Tuesday' : 'Friday',
          quantity_trays: trays,
        };
      });

      schedule.push({
        harvest_date: ymd(harvestTuesday),
        harvest_display: fmt(harvestTuesday),
        customer_id: customerId,
        customer_name: customerName,
        items,
      });
    }

    // Sort by harvest date, then customer name
    schedule.sort((a, b) =>
      new Date(a.harvest_date).getTime() - new Date(b.harvest_date).getTime() ||
      a.customer_name.localeCompare(b.customer_name)
    );

    // What to seed this Tuesday and this Friday
    const nextTuesday = nextTuesdayOnOrAfter(today);
    const nextFriday = new Date(today);
    while (nextFriday.getDay() !== FRIDAY) nextFriday.setDate(nextFriday.getDate() + 1);

    const todayKey = ymd(today);
    const tuesdayKey = ymd(nextTuesday);
    const fridayKey = ymd(nextFriday);

    // Flatten all items, group by seed_date (deduplicated by crop across all customers)
    const bySeedDateMap = new Map<string, Map<string, { crop_name: string; trays: number; customers: string[]; harvest_display: string; grow_days: number }>>();
    for (const delivery of schedule) {
      for (const item of delivery.items) {
        if (!item.seed_date) continue;
        if (!bySeedDateMap.has(item.seed_date)) bySeedDateMap.set(item.seed_date, new Map());
        const cropMap2 = bySeedDateMap.get(item.seed_date)!;
        if (!cropMap2.has(item.crop_id)) {
          cropMap2.set(item.crop_id, { crop_name: item.crop_name, trays: 0, customers: [], harvest_display: delivery.harvest_display, grow_days: item.grow_days });
        }
        const entry = cropMap2.get(item.crop_id)!;
        entry.trays += item.quantity_trays;
        if (!entry.customers.includes(delivery.customer_name)) entry.customers.push(delivery.customer_name);
      }
    }

    const flatSeedDay = (dateKey: string) =>
      Array.from((bySeedDateMap.get(dateKey) || new Map()).values()).map(e => ({
        crop_name: e.crop_name,
        quantity_trays: e.trays,
        customer_name: e.customers.join(', '),
        harvest_display: e.harvest_display,
        grow_days: e.grow_days,
      }));

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        seed_today: flatSeedDay(todayKey),
        seed_tuesday: flatSeedDay(tuesdayKey),
        seed_friday: flatSeedDay(fridayKey),
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
