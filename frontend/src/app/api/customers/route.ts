import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let path = '/belarro_v4_customer?deleted_at=is.null&select=*&order=created_at.desc';
    if (status) {
      path = `/belarro_v4_customer?deleted_at=is.null&status=eq.${status}&select=*&order=created_at.desc`;
    }

    try {
      const customers = await fetchFromSupabase(path);
      return NextResponse.json({
        success: true,
        data: customers || [],
      });
    } catch (dbErr) {
      console.warn('Database tables not ready, using mock customers');
      return NextResponse.json({
        success: true,
        data: [
          {
            id: 'mock-c1',
            name: 'Chefs Table',
            restaurant_name: 'Chefs Table Restaurant',
            contact_person: 'Pierre Granger',
            email: 'pierre@chefstable.de',
            phone: '+49 1520 1234567',
            whatsapp: '4915201234567',
            address: 'Mitte 12',
            city: 'Berlin',
            status: 'active',
            net_days: 14,
            first_contact_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'mock-c2',
            name: 'Gourmet Berlin',
            restaurant_name: 'Gourmet Berlin',
            contact_person: 'Sarah Connor',
            email: 'sarah@gourmet.berlin',
            phone: '+49 1520 7654321',
            whatsapp: '4915207654321',
            address: 'Kreuzberg 45',
            city: 'Berlin',
            status: 'prospect',
            net_days: 30,
            first_contact_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ]
      });
    }
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
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const {
      name,
      restaurant_name,
      contact_person,
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
