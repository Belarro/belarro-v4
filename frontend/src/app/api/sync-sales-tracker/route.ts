import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';

// Shared secret guards this public endpoint (Apps Script can't log in).
const SYNC_SECRET = process.env.SALETRACKER_SYNC_SECRET || '';

const FOLLOW_UP_DAYS = [0, 3, 7, 14, 30];

export async function POST(request: NextRequest) {
  try {
    // --- Auth: shared secret (header preferred; body fallback for Apps Script simplicity) ---
    const headerSecret = request.headers.get('x-sync-secret');
    const body = await request.json();
    const providedSecret = headerSecret || body.secret;
    if (!SYNC_SECRET || providedSecret !== SYNC_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // --- Map Apps Script payload → customer fields ---
    const restaurantName = String(body.locationName || '').trim();
    const contactPerson = String(body.contactPerson || '').trim();
    const phone = String(body.directPhone || '').trim();
    const email = body.directEmail ? String(body.directEmail).trim() : null;
    const city = body.city ? String(body.city).trim() : 'Berlin';
    const address = body.address ? String(body.address).trim() : null;

    if (!restaurantName || !contactPerson || !phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: locationName, contactPerson, directPhone' },
        { status: 400 }
      );
    }

    // --- Idempotency: skip if a customer with this restaurant_name already exists ---
    const existing = await fetchFromSupabase(
      `/belarro_v4_customer?restaurant_name=eq.${encodeURIComponent(restaurantName)}&select=id&limit=1`
    );
    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: true,
        id: existing[0].id,
        message: 'Customer already exists — skipped duplicate sync.',
        duplicate: true,
      });
    }

    // --- Create customer (status active = closed deal) ---
    const customerId = crypto.randomUUID();
    const now = new Date().toISOString();
    const whatsapp = phone.replace(/[^0-9]/g, '');

    await fetchFromSupabase('/belarro_v4_customer', {
      method: 'POST',
      body: JSON.stringify({
        id: customerId,
        name: restaurantName,
        restaurant_name: restaurantName,
        contact_person: contactPerson,
        address,
        city,
        email,
        phone,
        whatsapp,
        status: 'active',
        net_days: 30,
        first_contact_date: now,
      }),
    });

    // --- Generate the 5 standard follow-ups ---
    const followUps = [];
    for (let i = 0; i < FOLLOW_UP_DAYS.length; i++) {
      const due = new Date();
      due.setDate(due.getDate() + FOLLOW_UP_DAYS[i]);
      const fu = await fetchFromSupabase('/belarro_v4_follow_up', {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
          customer_id: customerId,
          follow_up_number: i + 1,
          follow_up_days: FOLLOW_UP_DAYS[i],
          due_date: due.toISOString(),
          status: 'pending',
          sent_via: null,
          sent_date: null,
          notes: 'Auto-created from saletracker closed deal',
        }),
      });
      followUps.push(fu);
    }

    return NextResponse.json({
      success: true,
      id: customerId,
      message: 'Customer + 5 follow-ups created from closed deal.',
      follow_ups_created: followUps.length,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
