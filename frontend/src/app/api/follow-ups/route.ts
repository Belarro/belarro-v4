import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const CHEF_PAGE = 'https://belarro.com/for-chefs';
const OLD_LEAD_DAYS = 30;

// ─── NEW LEAD FLOW (visited < 30 days ago) ───────────────────────────────────

const NEW_EN: Record<number, { title: string; template: string }> = {
  1: {
    title: 'The Link (2 hours)',
    template: `Hello [Name],\n\nThank you for your time today; it was a pleasure meeting you.\n\nHere is the link for our varieties and pricing:\n\n${CHEF_PAGE}\n\nI would love to hear what you think. Just a reminder: no delivery fees, no minimum order.\n\nEnjoy the rest of your service.\nRon from Belarro`,
  },
  2: {
    title: 'The Taste (2 days)',
    template: `Hello [Name],\n\nRon from Belarro. I hope you had the chance to taste the samples and see how they work with your dishes.\n\nWe only grow what you order, no old stock, zero waste. We harvest the morning of delivery, and our greens last up to 10 days in the fridge.\n\nLet me know what caught your eye and I will get it into the next grow cycle.\n\nRon from Belarro`,
  },
  3: {
    title: 'The Facts (5 days)',
    template: `Hello [Name],\n\nRon from Belarro. Wanted to follow up and see how you found our greens.\n\nWe grow over 25 varieties, more variety than most suppliers, more options for your plates. Orders are recurring: order once, receive fresh every Tuesday. You can always change, add or cancel.\n\nHere is the full list:\n\n${CHEF_PAGE}\n\nRon from Belarro`,
  },
  4: {
    title: 'The Easy Yes (2 weeks)',
    template: `Hello [Name],\n\nRon from Belarro. Haven't heard back, just wanted to check in.\n\nWe are local. No imports, faster, more consistent product, just fresh greens with less emissions.\n\nNo minimums, no delivery fees. Just let me know when you are ready.\n\nRon from Belarro`,
  },
  5: {
    title: 'The Open Door (1 month)',
    template: `Hello [Name],\n\nRon from Belarro. No worries if the timing wasn't right.\n\nWhenever you need fresh microgreens, we are one message away. No minimums, free delivery, harvested the morning we bring them to you.\n\nOur varieties and pricing are always here:\n\n${CHEF_PAGE}\n\nWishing you a great season.\nRon from Belarro`,
  },
};

const NEW_DE: Record<number, { title: string; template: string }> = {
  1: {
    title: 'The Link (2 Stunden)',
    template: `Hallo [Name],\n\nvielen Dank für Ihre Zeit heute, es war eine Freude Sie kennenzulernen.\n\nHier ist der Link zu unseren Sorten und Preisen:\n\n${CHEF_PAGE}\n\nIch würde mich freuen zu hören, was Sie denken. Zur Erinnerung: keine Lieferkosten, keine Mindestbestellung.\n\nGenießen Sie den Rest Ihres Abends.\nRon von Belarro`,
  },
  2: {
    title: 'The Taste (2 Tage)',
    template: `Hallo [Name],\n\nRon von Belarro. Ich hoffe, Sie hatten die Gelegenheit, die Proben zu probieren und zu sehen, wie sie zu Ihren Gerichten passen.\n\nWir wachsen nur, was Sie bestellen, kein alter Bestand, kein Abfall. Wir ernten am Morgen der Lieferung und unsere Microgreens bleiben bis zu 10 Tage frisch im Kühlschrank.\n\nLassen Sie mich wissen, was Ihr Interesse geweckt hat, und ich nehme es in den nächsten Anbauzyklus auf.\n\nRon von Belarro`,
  },
  3: {
    title: 'The Facts (5 Tage)',
    template: `Hallo [Name],\n\nRon von Belarro. Ich wollte nachfragen, wie Ihnen unsere Microgreens gefallen haben.\n\nWir bauen über 25 Sorten an, mehr Auswahl als die meisten Lieferanten, mehr Möglichkeiten für Ihre Teller. Bestellungen sind wiederkehrend: einmal bestellen, jeden Dienstag frisch erhalten. Sie können jederzeit ändern, hinzufügen oder stornieren.\n\nHier ist die vollständige Liste:\n\n${CHEF_PAGE}\n\nRon von Belarro`,
  },
  4: {
    title: 'The Easy Yes (2 Wochen)',
    template: `Hallo [Name],\n\nRon von Belarro. Ich habe noch nichts gehört und wollte kurz nachfragen.\n\nWir sind lokal. Keine Importe, schnelleres und konsistenteres Produkt, einfach frische Microgreens mit weniger Emissionen.\n\nKeine Mindestbestellung, keine Lieferkosten. Sagen Sie mir einfach, wann Sie bereit sind.\n\nRon von Belarro`,
  },
  5: {
    title: 'The Open Door (1 Monat)',
    template: `Hallo [Name],\n\nRon von Belarro. Kein Problem, wenn der Zeitpunkt nicht gepasst hat.\n\nWann immer Sie frische Microgreens benötigen, wir sind eine Nachricht entfernt. Keine Mindestbestellung, kostenlose Lieferung, geerntet am Morgen der Lieferung.\n\nUnsere Sorten und Preise finden Sie hier:\n\n${CHEF_PAGE}\n\nWir wünschen Ihnen eine großartige Saison.\nRon von Belarro`,
  },
};

// ─── RE-ENGAGE FLOW (visited > 30 days ago) ──────────────────────────────────
// Stage numbers: 1=Re-Engage, 2=Follow Up, 3=Easy Yes, 4=Open Door

const REENGAGE_EN: Record<number, { title: string; template: string }> = {
  1: {
    title: 'Re-Engage',
    template: `Hi [Name], Ron from Belarro. Berlin's precision indoor farm for professional kitchens. I stopped by [Restaurant] a while back and we're finally following up properly.\n\nWe've expanded significantly. We now grow 25+ varieties of microgreens, all harvested the morning of delivery. Unlike imported greens that spend days in transit, ours go straight from Prenzlauer Berg to your kitchen.\n\nEvery Tuesday\nNo delivery fees\nNo minimum order\n\nWant me to send over our current price list, or would you like some fresh samples next time I'm in your area?\n\nRon from Belarro`,
  },
  2: {
    title: 'Re-Engage Follow Up (5 days)',
    template: `Hello [Name],\n\nRon from Belarro. Just following up on my last message.\n\nWe grow over 25 varieties. Order once and receive fresh every week. You can always change, add or cancel. No minimums, no delivery fees.\n\nWhenever you are ready, we are one message away.\n\nRon from Belarro`,
  },
  3: {
    title: 'The Easy Yes (2 weeks)',
    template: NEW_EN[4].template,
  },
  4: {
    title: 'The Open Door (1 month)',
    template: NEW_EN[5].template,
  },
};

const REENGAGE_DE: Record<number, { title: string; template: string }> = {
  1: {
    title: 'Re-Engage',
    template: `Hallo [Name], Ron von Belarro. Berlins Präzisions-Indoorfarm für professionelle Küchen. Ich war vor einer Weile bei [Restaurant] und melde mich jetzt endlich richtig zurück.\n\nWir haben uns stark weiterentwickelt. Wir bauen jetzt 25+ Sorten Microgreens an, alle am Morgen der Lieferung geerntet. Anders als importierte Greens, die tagelang unterwegs sind, kommen unsere direkt aus Prenzlauer Berg zu Ihnen.\n\nJeden Dienstag\nKeine Lieferkosten\nKeine Mindestbestellung\n\nSoll ich Ihnen unsere aktuelle Preisliste schicken, oder möchten Sie beim nächsten Mal, wenn ich in Ihrer Nähe bin, frische Muster probieren?\n\nRon von Belarro`,
  },
  2: {
    title: 'Re-Engage Follow Up (5 Tage)',
    template: `Hallo [Name],\n\nRon von Belarro. Ich melde mich kurz zu meiner letzten Nachricht.\n\nWir bauen über 25 Sorten an. Einmal bestellen und jede Woche frisch erhalten. Sie können jederzeit ändern, hinzufügen oder stornieren. Keine Mindestbestellung, keine Lieferkosten.\n\nWann immer Sie bereit sind, wir sind eine Nachricht entfernt.\n\nRon von Belarro`,
  },
  3: {
    title: 'The Easy Yes (2 Wochen)',
    template: NEW_DE[4].template,
  },
  4: {
    title: 'The Open Door (1 Monat)',
    template: NEW_DE[5].template,
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function buildMessage(flow: 'new' | 'reengage', stage: number, lang: string, contactName: string): { title: string; text: string } {
  const name = contactName || 'there';
  const isEN = lang === 'en';

  if (flow === 'reengage') {
    const msg = isEN ? (REENGAGE_EN[stage] || REENGAGE_EN[1]) : (REENGAGE_DE[stage] || REENGAGE_DE[1]);
    return { title: msg.title, text: msg.template.replace(/\[Name\]/g, name) };
  } else {
    const msg = isEN ? (NEW_EN[stage] || NEW_EN[1]) : (NEW_DE[stage] || NEW_DE[1]);
    return { title: msg.title, text: msg.template.replace(/\[Name\]/g, name) };
  }
}

function parsePhone(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/\s+/g, '').replace(/^00/, '+');
}

function isOldLead(timestamp: string | null, createdAt: string | null): boolean {
  const dateStr = timestamp || createdAt;
  if (!dateStr) return true;
  const cleaned = String(dateStr).trim()
    .replace(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, '$3-$2-$1')
    .replace(' ', 'T');
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return true;
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > OLD_LEAD_DAYS;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const followups = await fetchFromSupabase(
      '/belarro_v4_follow_up?location_id=not.is.null&select=*&status=neq.skipped&order=due_date.asc'
    );
    const fls = followups || [];
    if (fls.length === 0) return NextResponse.json({ success: true, data: [] });

    const locationIds = [...new Set(fls.map((f: any) => f.location_id))];
    const idFilter = locationIds.map((id: any) => `id.eq.${id}`).join(',');
    const locations = await fetchFromSupabase(
      `/locations?or=(${idFilter})&archived=neq.YES&select=id,location_name,contact_person,direct_phone,business_phone,direct_email,business_email,language,visit_notes,pipeline_stage,interest_level,timestamp,created_at,sales_rep`
    );
    const locMap = new Map<string, any>((locations || []).map((l: any) => [l.id, l]));

    // Only keep next pending follow-up per location
    const nextPerLocation = new Map<string, any>();
    for (const f of fls) {
      const loc = locMap.get(f.location_id);
      if (!loc) continue;
      if (loc.pipeline_stage === 'active' || loc.pipeline_stage === 'snoozed') continue;
      if (f.status !== 'pending' && f.status !== 'replied') continue;
      const stage = f.stage || f.follow_up_number || 1;
      const existing = nextPerLocation.get(f.location_id);
      if (!existing || stage < (existing.stage || existing.follow_up_number || 1)) {
        nextPerLocation.set(f.location_id, { ...f, stage });
      }
    }

    const hydrated = Array.from(nextPerLocation.values()).map((f: any) => {
      const loc = locMap.get(f.location_id) || {};
      const contactName = loc.contact_person || loc.location_name || 'there';
      const phone = parsePhone(loc.direct_phone) || parsePhone(loc.business_phone);
      const lang = (loc.language || '').toLowerCase().trim();
      const flow: 'new' | 'reengage' = isOldLead(loc.timestamp, loc.created_at) ? 'reengage' : 'new';
      const totalStages = flow === 'reengage' ? 4 : 5;
      const { title, text } = buildMessage(flow, f.stage, lang, contactName);

      return {
        ...f,
        flow,
        total_stages: totalStages,
        message_title: title,
        message_text: text,
        whatsapp_number: phone,
        location: {
          id: loc.id,
          name: loc.location_name,
          contact_person: loc.contact_person,
          phone,
          email: loc.direct_email || loc.business_email,
          interest_level: loc.interest_level,
          pipeline_stage: loc.pipeline_stage,
          language: lang,
          visited_at: loc.timestamp || loc.created_at || null,
          sales_rep: loc.sales_rep || null,
        },
      };
    }).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    // All completed stages for History tab — only ones actually sent (have sent_date or sent_via)
    const completedRows = fls.filter((f: any) =>
      (f.status === 'completed' || f.status === 'sent') &&
      locMap.has(f.location_id) &&
      (f.sent_date || f.sent_via)
    );

    const completed = completedRows.map((f: any) => {
      const loc = locMap.get(f.location_id) || {};
      const lang = (loc.language || '').toLowerCase().trim();
      const flow: 'new' | 'reengage' = isOldLead(loc.timestamp, loc.created_at) ? 'reengage' : 'new';
      const { title, text } = buildMessage(flow, f.stage, lang, loc.contact_person || loc.location_name);
      return {
        ...f,
        flow,
        total_stages: flow === 'reengage' ? 4 : 5,
        message_title: title,
        message_text: text,
        whatsapp_number: parsePhone(loc.direct_phone) || parsePhone(loc.business_phone),
        location: {
          id: loc.id,
          name: loc.location_name,
          contact_person: loc.contact_person,
          phone: parsePhone(loc.direct_phone) || parsePhone(loc.business_phone),
          email: loc.direct_email || loc.business_email,
          interest_level: loc.interest_level,
          pipeline_stage: loc.pipeline_stage,
          language: lang,
        },
      };
    });

    return NextResponse.json({ success: true, data: [...hydrated, ...completed] });
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

    const existing = await fetchFromSupabase(
      `/belarro_v4_follow_up?location_id=eq.${location_id}&status=eq.pending&select=id&limit=1`
    );
    if (existing && existing.length > 0) {
      return NextResponse.json({ success: false, error: 'Follow-ups already exist' }, { status: 409 });
    }

    const base = new Date(visited_at || new Date()).getTime();
    const old = isOldLead(visited_at, null);

    const stages = old ? [
      { stage: 1, follow_up_number: 1, follow_up_days: 0,  offset: 0 },
      { stage: 2, follow_up_number: 2, follow_up_days: 5,  offset: 5  * 24 * 60 * 60 * 1000 },
      { stage: 3, follow_up_number: 3, follow_up_days: 14, offset: 14 * 24 * 60 * 60 * 1000 },
      { stage: 4, follow_up_number: 4, follow_up_days: 30, offset: 30 * 24 * 60 * 60 * 1000 },
    ] : [
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
