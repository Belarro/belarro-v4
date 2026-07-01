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
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;

    const [orders, variants, crops, procedures, customers, batches, harvests, mixComponents] = await Promise.all([
      fetchFromSupabase('/belarro_v4_order?status=in.(active,pending_seed,growing)&deleted_at=is.null&select=*'),
      fetchFromSupabase('/belarro_v4_product_variant?select=*'),
      fetchFromSupabase('/belarro_v4_crop?select=*'),
      fetchFromSupabase('/belarro_v4_growth_procedure?select=crop_id,stack_days,blackout_days,light_days'),
      fetchFromSupabase('/belarro_v4_customer?select=id,name&deleted_at=is.null'),
      fetchFromSupabase('/belarro_v4_seeding_batch?select=*'),
      fetchFromSupabase('/belarro_v4_harvest_record?select=*'),
      fetchFromSupabase('/belarro_v4_crop_mix_component?select=*'),
    ]);

    const varMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]));
    const cropMap = new Map<string, any>((crops || []).map((c: any) => [c.id, c]));
    const procMap = new Map<string, any>((procedures || []).map((p: any) => [p.crop_id, p]));
    const custMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));
    // mixComponentsMap: mix_crop_id → array of { component_crop_id, percentage }
    const mixComponentsMap = new Map<string, any[]>();
    for (const mc of (mixComponents || [])) {
      if (!mixComponentsMap.has(mc.mix_crop_id)) mixComponentsMap.set(mc.mix_crop_id, []);
      mixComponentsMap.get(mc.mix_crop_id)!.push(mc);
    }

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

    // ISO week number helper — used to determine biweekly seeding week
    const isoWeek = (d: Date): number => {
      const tmp = new Date(d);
      tmp.setHours(0, 0, 0, 0);
      tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
      const week1 = new Date(tmp.getFullYear(), 0, 4);
      return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    };
    const thisWeekNum = isoWeek(today);

    // What to seed this Tuesday and this Friday
    const nextTuesday = nextTuesdayOnOrAfter(today);
    const nextFriday = new Date(today);
    while (nextFriday.getDay() !== FRIDAY) nextFriday.setDate(nextFriday.getDate() + 1);

    const todayKey = ymd(today);
    const tuesdayKey = ymd(nextTuesday);
    const fridayKey = ymd(nextFriday);

    // ── SEEDING SCHEDULE ───────────────────────────────────────────────
    // Step 1: accumulate total grams needed per component crop across all orders.
    // Mix orders expand into their component crops by percentage.
    // Biweekly orders only appear on even ISO weeks.

    // gramsNeeded: cropId → total grams needed this week
    const gramsNeeded = new Map<string, number>();

    const addGrams = (cropId: string, grams: number) => {
      gramsNeeded.set(cropId, (gramsNeeded.get(cropId) || 0) + grams);
    };

    // delivery schedule: per customer
    const customerDeliveryMap = new Map<string, { harvest_date: string; harvest_display: string; customer_name: string; items: any[] }>();

    for (const order of (orders || [])) {
      if (order.frequency === 'biweekly' && thisWeekNum % 2 !== 0) continue;

      const customer = custMap.get(order.customer_id);
      if (!customer?.name) continue;

      const variant = varMap.get(order.product_variant_id);
      const crop = variant ? cropMap.get(variant.crop_id) : null;
      if (!crop) continue;

      const orderQty = order.quantity || 1;
      const sizeGrams = variant?.size_grams || 0;
      const totalGrams = orderQty * sizeGrams;

      if (crop.is_mix) {
        // Expand mix into component crops
        const components = mixComponentsMap.get(crop.id) || [];
        for (const comp of components) {
          const gramsForComp = totalGrams * (comp.percentage / 100);
          addGrams(comp.component_crop_id, gramsForComp);
        }
      } else {
        addGrams(crop.id, totalGrams);
      }

      // Delivery tab — use the mix crop's grow days for harvest date estimation
      // For mixes, use the longest component grow days
      let growDaysForDelivery = 0;
      if (crop.is_mix) {
        const components = mixComponentsMap.get(crop.id) || [];
        for (const comp of components) {
          const compProc = procMap.get(comp.component_crop_id);
          const compDays = compProc
            ? (compProc.stack_days || 0) + (compProc.blackout_days || 0) + (compProc.light_days || 0)
            : 0;
          if (compDays > growDaysForDelivery) growDaysForDelivery = compDays;
        }
      } else {
        const proc = procMap.get(crop.id);
        growDaysForDelivery = proc
          ? (proc.stack_days || 0) + (proc.blackout_days || 0) + (proc.light_days || 0)
          : 0;
      }

      const seedDayTarget = growDaysForDelivery > 10 ? TUESDAY : FRIDAY;
      const seedDate = nextDayOnOrAfter(today, seedDayTarget);
      const harvestRaw = new Date(seedDate);
      harvestRaw.setDate(harvestRaw.getDate() + (growDaysForDelivery || 10));
      const harvestTuesday = nextTuesdayOnOrAfter(harvestRaw);
      const harvestKey = ymd(harvestTuesday);

      if (!customerDeliveryMap.has(order.customer_id)) {
        customerDeliveryMap.set(order.customer_id, {
          harvest_date: harvestKey,
          harvest_display: fmt(harvestTuesday),
          customer_name: customer.name,
          items: [],
        });
      }
      const delivery = customerDeliveryMap.get(order.customer_id)!;
      if (harvestKey > delivery.harvest_date) {
        delivery.harvest_date = harvestKey;
        delivery.harvest_display = fmt(harvestTuesday);
      }
      const yieldPerTray = crop.yield_per_tray_grams || null;
      const traysNeeded = yieldPerTray && totalGrams > 0 ? Math.ceil(totalGrams / yieldPerTray) : orderQty;
      delivery.items.push({
        crop_name: crop.name_en,
        order_qty: orderQty,
        size_name: variant?.size_name || '',
        size_grams: sizeGrams,
        trays_needed: traysNeeded,
      });
    }

    // Step 2: for each crop with grams needed, calculate trays and seed day
    // seed day buckets: Map<seedDateKey, Map<cropId, {crop_name, trays, grams_needed}>>
    const bySeedDateMap = new Map<string, Map<string, { crop_name: string; trays: number; grams_needed: number }>>();

    for (const [cropId, totalGramsNeeded] of gramsNeeded) {
      const crop = cropMap.get(cropId);
      if (!crop) continue;

      const proc = procMap.get(cropId);
      const growDays = proc
        ? (proc.stack_days || 0) + (proc.blackout_days || 0) + (proc.light_days || 0)
        : 0;
      if (growDays === 0) continue;

      const yieldPerTray = crop.yield_per_tray_grams || null;
      const trays = yieldPerTray && totalGramsNeeded > 0
        ? Math.ceil(totalGramsNeeded / yieldPerTray)
        : 1;

      const useTuesday = growDays > 10;
      const seedDayTarget = useTuesday ? TUESDAY : FRIDAY;
      const seedDate = nextDayOnOrAfter(today, seedDayTarget);
      const seedKey = ymd(seedDate);

      if (!bySeedDateMap.has(seedKey)) bySeedDateMap.set(seedKey, new Map());
      const dayMap = bySeedDateMap.get(seedKey)!;
      dayMap.set(cropId, { crop_name: crop.name_en, trays, grams_needed: Math.round(totalGramsNeeded) });
    }

    const schedule = Array.from(customerDeliveryMap.values()).sort((a, b) =>
      a.harvest_date.localeCompare(b.harvest_date) || a.customer_name.localeCompare(b.customer_name)
    );

    const flatSeedDay = (dateKey: string) =>
      Array.from((bySeedDateMap.get(dateKey) || new Map()).values()).map(e => ({
        crop_name: e.crop_name,
        quantity_trays: e.trays,
        grams_needed: e.grams_needed,
      }));

    // ── 4-WEEK FORWARD SCHEDULE ────────────────────────────────────────
    // Build seeding list for each of the next 4 Tuesdays and 4 Fridays.
    // For each seed date we re-run the grams accumulation for that specific week,
    // so biweekly orders are handled correctly per week.

    const upcomingSeedDates: Array<{ date: Date; day: 'Tuesday' | 'Friday'; weekOffset: number }> = [];
    for (let w = 0; w < 4; w++) {
      const tuesdayW = new Date(nextTuesday);
      tuesdayW.setDate(tuesdayW.getDate() + w * 7);
      const fridayW = new Date(nextFriday);
      fridayW.setDate(fridayW.getDate() + w * 7);
      upcomingSeedDates.push({ date: tuesdayW, day: 'Tuesday', weekOffset: w });
      upcomingSeedDates.push({ date: fridayW, day: 'Friday', weekOffset: w });
    }
    // Sort chronologically
    upcomingSeedDates.sort((a, b) => a.date.getTime() - b.date.getTime());

    const seedSchedule = upcomingSeedDates.map(({ date, day }) => {
      const weekNum = isoWeek(date);
      // Accumulate grams for this specific seed date
      const gramsForWeek = new Map<string, number>();
      for (const order of (orders || [])) {
        if (order.frequency === 'biweekly' && weekNum % 2 !== 0) continue;
        const variant = varMap.get(order.product_variant_id);
        const crop = variant ? cropMap.get(variant.crop_id) : null;
        if (!crop) continue;
        const proc = procMap.get(crop.id);
        const growDays = proc ? (proc.stack_days || 0) + (proc.blackout_days || 0) + (proc.light_days || 0) : 0;
        if (growDays === 0) continue;
        // Only include crops that belong on this seed day (Tue=long, Fri=short)
        const belongsHere = day === 'Tuesday' ? growDays > 10 : growDays <= 10;
        if (!belongsHere) continue;
        const orderQty = order.quantity || 1;
        const sizeGrams = variant?.size_grams || 0;
        const totalGrams = orderQty * sizeGrams;
        if (crop.is_mix) {
          for (const comp of (mixComponentsMap.get(crop.id) || [])) {
            gramsForWeek.set(comp.component_crop_id, (gramsForWeek.get(comp.component_crop_id) || 0) + totalGrams * (comp.percentage / 100));
          }
        } else {
          gramsForWeek.set(crop.id, (gramsForWeek.get(crop.id) || 0) + totalGrams);
        }
      }
      const items = Array.from(gramsForWeek.entries())
        .map(([cropId, grams]) => {
          const crop = cropMap.get(cropId);
          if (!crop) return null;
          const yieldPerTray = crop.yield_per_tray_grams || null;
          const trays = yieldPerTray && grams > 0 ? Math.ceil(grams / yieldPerTray) : 1;
          // Harvest = next Tuesday on or after (seed date + growDays)
          const proc = procMap.get(cropId);
          const growDays = proc ? (proc.stack_days || 0) + (proc.blackout_days || 0) + (proc.light_days || 0) : 10;
          const harvestRaw = new Date(date);
          harvestRaw.setDate(harvestRaw.getDate() + growDays);
          const harvestTue = nextTuesdayOnOrAfter(harvestRaw);
          return { crop_name: crop.name_en, trays, grams_needed: Math.round(grams), harvest_display: fmt(harvestTue) };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.crop_name.localeCompare(b.crop_name));

      return {
        date: ymd(date),
        display: fmt(date),
        day,
        total_trays: items.reduce((s: number, i: any) => s + i.trays, 0),
        items,
      };
    }).filter(d => d.items.length > 0);

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        seed_today: flatSeedDay(todayKey),
        seed_tuesday: flatSeedDay(tuesdayKey),
        seed_friday: flatSeedDay(fridayKey),
        seed_schedule: seedSchedule,
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
