import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;

    // Fetch Belarro customers + SalesTracker locations in parallel
    const [customers, locations] = await Promise.all([
      fetchFromSupabase('/belarro_v4_customer?deleted_at=is.null&select=*&order=created_at.desc').catch(() => []),
      fetchFromSupabase('/locations?archived=neq.YES&select=id,location_name,contact_person,direct_phone,business_phone,direct_email,business_email,pipeline_stage,interest_level,visit_notes,sales_rep,timestamp,created_at&order=timestamp.desc.nullslast&limit=500').catch(() => []),
    ]);

    // Normalize belarro_v4_customer rows
    const customerRows = (customers || []).map((c: any) => ({
      id: c.id,
      _source: 'belarro',
      name: c.restaurant_name || c.name,
      contact_person: c.contact_person || null,
      contact_title: c.contact_title || null,
      email: c.email || null,
      phone: c.phone || null,
      whatsapp: c.whatsapp || null,
      address: c.address || null,
      city: c.city || null,
      status: c.status, // 'active' | 'prospect' | 'paused' | 'inactive'
      net_days: c.net_days || 30,
      tax_number: c.tax_number || null,
      interest_level: null,
      visit_notes: null,
      visited_at: null,
      first_contact_date: c.first_contact_date,
      created_at: c.created_at,
    }));

    // Belarro customer IDs already in the system (to avoid duplication)
    const belarroCustIds = new Set(customerRows.map((c: any) => c.id));

    // Normalize locations rows — map pipeline_stage to status
    const stageToStatus = (stage: string | null): string => {
      if (!stage) return 'prospect';
      if (stage === 'active') return 'active';
      if (stage === 'snoozed') return 'paused';
      return 'prospect'; // new_visit, follow_up_1..5, etc.
    };

    const locationRows = (locations || [])
      .filter((loc: any) => !belarroCustIds.has(loc.id)) // skip if already in belarro
      .map((loc: any) => ({
        id: loc.id,
        _source: 'saletracker',
        name: loc.location_name,
        contact_person: loc.contact_person || null,
        contact_title: null,
        email: loc.direct_email || loc.business_email || null,
        phone: loc.direct_phone || loc.business_phone || null,
        whatsapp: null,
        address: null,
        city: null,
        status: stageToStatus(loc.pipeline_stage),
        net_days: 30,
        tax_number: null,
        interest_level: loc.interest_level || null,
        visit_notes: loc.visit_notes || null,
        sales_rep: loc.sales_rep || null,
        visited_at: loc.timestamp || null,
        first_contact_date: loc.timestamp || loc.created_at,
        created_at: loc.created_at,
      }));

    const all = [...customerRows, ...locationRows];

    return NextResponse.json({ success: true, data: all });
  } catch (error) {
    console.error('Customers GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // const auth = await requireAuth();
    // if (!auth.ok) return auth.response;
    const body = await request.json();
    const {
      name,
      restaurant_name,
      contact_person,
      contact_title,
      tax_number,
      address,
      city,
      email,
      whatsapp,
      phone,
      net_days,
      status,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const customerId = crypto.randomUUID();
    const firstContactDate = new Date().toISOString();

    // Create customer record
    const newCustomer = await fetchFromSupabase('/belarro_v4_customer', {
      method: 'POST',
      body: JSON.stringify({
        id: customerId,
        name,
        restaurant_name: restaurant_name || null,
        contact_person: contact_person || null,
        contact_title: contact_title || 'owner',
        tax_number: tax_number || null,
        address: address || null,
        city: city || null,
        email: email || null,
        whatsapp: whatsapp || null,
        phone: phone || null,
        status: status || 'prospect',
        net_days: net_days ? parseInt(net_days) : 30,
        first_contact_date: firstContactDate,
      }),
    });

    // Auto-generate 5 follow-ups
    const followUpDays = [0, 3, 7, 14, 30];
    const followUps = [];
    
    for (let i = 0; i < followUpDays.length; i++) {
      const days = followUpDays[i];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
      
      const followUpId = crypto.randomUUID();
      const newFollowup = await fetchFromSupabase('/belarro_v4_follow_up', {
        method: 'POST',
        body: JSON.stringify({
          id: followUpId,
          customer_id: customerId,
          follow_up_number: i + 1,
          follow_up_days: days,
          due_date: dueDate.toISOString(),
          status: 'pending',
          sent_via: null,
          sent_date: null,
          notes: null,
        }),
      });
      followUps.push(newFollowup);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...(newCustomer ? newCustomer[0] : { id: customerId, name }),
        follow_ups: followUps,
      },
      message: 'Customer created successfully with 5 auto-generated follow-ups',
    });
  } catch (error) {
    console.error('Customer POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
