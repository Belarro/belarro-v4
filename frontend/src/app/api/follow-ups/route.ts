import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const CHEF_PAGE = 'https://belarro.com/for-chefs';

const MESSAGES: Record<number, { title: string; template: string }> = {
  1: {
    title: 'The Link (2 hours)',
    template: `Hello [Name],\n\nThank you for your time today; it was a pleasure meeting you.\n\nHere is the link for our varieties and pricing: ${CHEF_PAGE}\n\nI would love to hear what you think. Just a reminder: no delivery fees, no minimum order.\n\nEnjoy the rest of your service.\nRon from Belarro`,
  },
  2: {
    title: 'The Taste (2 days)',
    template: `Hello [Name],\n\nRon from Belarro. I hope you had the chance to taste the samples and see how they work with your dishes.\n\nWe only grow what you order, no old stock, zero waste. We harvest the morning of delivery, and our greens last up to 10 days in the fridge.\n\nLet me know what caught your eye and I'll get it into the next grow cycle.\n\nRon`,
  },
  3: {
    title: 'The Facts (5 days)',
    template: `Hello [Name],\n\nRon from Belarro. Wanted to follow up and see how you found our greens.\n\nWe grow over 25 varieties, more variety than most suppliers, more options for your plates. Orders are recurring: order once, receive fresh every Tuesday. You can always change, add or cancel.\n\nHere's the full list: ${CHEF_PAGE}\n\nRon`,
  },
  4: {
    title: 'The Easy Yes (2 weeks)',
    template: `Hello [Name],\n\nRon from Belarro. Haven't heard back, just wanted to check in.\n\nWe're local. No imports, faster, more consistent product, just fresh greens with less emissions.\n\nNo minimums, no pressure. Just let me know when you're ready.\n\nRon`,
  },
  5: {
    title: 'The Open Door (1 month)',
    template: `Hello [Name],\n\nRon from Belarro. No worries if the timing wasn't right.\n\nWhenever you need fresh microgreens, we're one message away. No minimums, free delivery, harvested the morning we bring them to you.\n\nOur varieties and pricing are always here: ${CHEF_PAGE}\n\nWishing you a great season.\nRon`,
  },
};

function buildMessage(stage: number, contactName: string): string {
  const tpl = MESSAGES[stage]?.template || '';
  return tpl.replace(/\[Name\]/g, contactName || 'there');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Only follow-ups for leads (not active customers)
    const followups = await fetchFromSupabase(
      '/belarro_v4_follow_up?select=*&order=due_date.asc'
    );
    const fls = followups || [];

    // Only fetch lead customers
    const customers = await fetchFromSupabase(
      "/belarro_v4_customer?status=eq.lead&select=id,name,restaurant_name,phone,whatsapp,email,contact_person,language&deleted_at=is.null"
    );
    const custMap = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));

    // Only include follow-ups that belong to leads
    const hydrated = fls
      .filter((f: any) => custMap.has(f.customer_id))
      .map((f: any) => {
        const customer = custMap.get(f.customer_id);
        const contactName = customer?.contact_person || customer?.name || 'there';
        const stage = f.stage || f.follow_up_number || 1;
        return {
          ...f,
          stage,
          message_title: MESSAGES[stage]?.title || `Stage ${stage}`,
          message_text: buildMessage(stage, contactName),
          whatsapp_number: customer?.whatsapp || customer?.phone || null,
          customer,
        };
      });

    return NextResponse.json({ success: true, data: hydrated });
  } catch (error) {
    console.error('Followups GET error:', error);
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
    const { customer_id, first_contact_date } = await request.json();
    if (!customer_id) return NextResponse.json({ success: false, error: 'customer_id required' }, { status: 400 });

    const base = new Date(first_contact_date || new Date());
    const stages = [
      { stage: 1, follow_up_number: 1, follow_up_days: 0, offset: 2 * 60 * 60 * 1000 },
      { stage: 2, follow_up_number: 2, follow_up_days: 2, offset: 2 * 24 * 60 * 60 * 1000 },
      { stage: 3, follow_up_number: 3, follow_up_days: 5, offset: 5 * 24 * 60 * 60 * 1000 },
      { stage: 4, follow_up_number: 4, follow_up_days: 14, offset: 14 * 24 * 60 * 60 * 1000 },
      { stage: 5, follow_up_number: 5, follow_up_days: 30, offset: 30 * 24 * 60 * 60 * 1000 },
    ];

    for (const s of stages) {
      await fetchFromSupabase('/belarro_v4_follow_up', {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
          customer_id,
          follow_up_number: s.follow_up_number,
          follow_up_days: s.follow_up_days,
          stage: s.stage,
          due_date: new Date(base.getTime() + s.offset).toISOString(),
          status: 'pending',
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
