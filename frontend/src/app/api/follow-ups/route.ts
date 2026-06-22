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

function parsePhone(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/\s+/g, '').replace(/^00/, '+');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Fetch all pending follow-ups
    const followups = await fetchFromSupabase(
      '/belarro_v4_follow_up?select=*&order=due_date.asc'
    );
    const fls = (followups || []).filter((f: any) => f.location_id);

    if (fls.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch all locations that have follow-ups
    const locationIds = [...new Set(fls.map((f: any) => f.location_id))];
    const idFilter = locationIds.map((id: any) => `id.eq.${id}`).join(',');
    const locations = await fetchFromSupabase(
      `/locations?or=(${idFilter})&select=id,location_name,contact_person,direct_phone,business_phone,direct_email,business_email,language,visit_notes,pipeline_stage,interest_level`
    );
    const locMap = new Map<string, any>((locations || []).map((l: any) => [l.id, l]));

    // Only include follow-ups for locations not yet converted (pipeline_stage != 'active')
    const hydrated = fls
      .filter((f: any) => {
        const loc = locMap.get(f.location_id);
        if (!loc) return false;
        return loc.pipeline_stage !== 'active';
      })
      .map((f: any) => {
        const loc = locMap.get(f.location_id) || {};
        const contactName = loc.contact_person || loc.location_name || 'there';
        const phone = parsePhone(loc.direct_phone) || parsePhone(loc.business_phone);
        const stage = f.stage || f.follow_up_number || 1;
        return {
          ...f,
          stage,
          message_title: MESSAGES[stage]?.title || `Stage ${stage}`,
          message_text: buildMessage(stage, contactName),
          whatsapp_number: phone,
          location: {
            id: loc.id,
            name: loc.location_name,
            contact_person: loc.contact_person,
            phone,
            email: loc.direct_email || loc.business_email,
            interest_level: loc.interest_level,
            pipeline_stage: loc.pipeline_stage,
          },
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
    const { location_id, visited_at } = await request.json();
    if (!location_id) return NextResponse.json({ success: false, error: 'location_id required' }, { status: 400 });

    // Don't create duplicates
    const existing = await fetchFromSupabase(
      `/belarro_v4_follow_up?location_id=eq.${location_id}&status=eq.pending&select=id&limit=1`
    );
    if (existing && existing.length > 0) {
      return NextResponse.json({ success: false, error: 'Follow-ups already exist for this location' }, { status: 409 });
    }

    const base = new Date(visited_at || new Date()).getTime();
    const stages = [
      { stage: 1, follow_up_number: 1, follow_up_days: 0,  offset: 2 * 60 * 60 * 1000 },
      { stage: 2, follow_up_number: 2, follow_up_days: 2,  offset: 2  * 24 * 60 * 60 * 1000 },
      { stage: 3, follow_up_number: 3, follow_up_days: 5,  offset: 5  * 24 * 60 * 60 * 1000 },
      { stage: 4, follow_up_number: 4, follow_up_days: 14, offset: 14 * 24 * 60 * 60 * 1000 },
      { stage: 5, follow_up_number: 5, follow_up_days: 30, offset: 30 * 24 * 60 * 60 * 1000 },
    ];

    for (const s of stages) {
      await fetchFromSupabase('/belarro_v4_follow_up', {
        method: 'POST',
        body: JSON.stringify({
          id: crypto.randomUUID(),
          location_id,
          customer_id: location_id, // keep for backward compat
          follow_up_number: s.follow_up_number,
          follow_up_days: s.follow_up_days,
          stage: s.stage,
          due_date: new Date(base + s.offset).toISOString(),
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
