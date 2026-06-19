// supabase/functions/notify-follow-ups/index.ts
// Deno runtime. Deployed with: supabase functions deploy notify-follow-ups
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Notification config (set as Edge Function secrets)
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')!; // e.g. whatsapp:+14155238886
const RON_WHATSAPP_TO = Deno.env.get('RON_WHATSAPP_TO')!;           // e.g. whatsapp:+49...
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RON_EMAIL_TO = Deno.env.get('RON_EMAIL_TO')!;                 // rbyinc@gmail.com
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!;                     // e.g. Belarro <noreply@belarro.de>

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function endOfTodayUTC(): string {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 23, 59, 59, 999)
  ).toISOString();
}

async function log(entry: Record<string, unknown>) {
  await supabase.from('belarro_v4_notification_log').insert(entry);
}

async function sendWhatsApp(body: string, count: number) {
  try {
    const params = new URLSearchParams({
      From: TWILIO_WHATSAPP_FROM,
      To: RON_WHATSAPP_TO,
      Body: body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || `Twilio ${res.status}`);
    await log({
      channel: 'whatsapp',
      recipient: RON_WHATSAPP_TO,
      follow_up_count: count,
      status: 'sent',
      provider_id: json.sid,
      payload: { body },
    });
  } catch (err) {
    await log({
      channel: 'whatsapp',
      recipient: RON_WHATSAPP_TO,
      follow_up_count: count,
      status: 'failed',
      error: String(err),
      payload: { body },
    });
  }
}

async function sendEmail(subject: string, html: string, count: number) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [RON_EMAIL_TO], subject, html }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || `Resend ${res.status}`);
    await log({
      channel: 'email',
      recipient: RON_EMAIL_TO,
      follow_up_count: count,
      status: 'sent',
      provider_id: json.id,
      payload: { subject },
    });
  } catch (err) {
    await log({
      channel: 'email',
      recipient: RON_EMAIL_TO,
      follow_up_count: count,
      status: 'failed',
      error: String(err),
      payload: { subject },
    });
  }
}

Deno.serve(async (req) => {
  // Reject anything that isn't the cron call carrying the shared secret.
  const secret = req.headers.get('x-cron-secret');
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 1. Pull today's due, pending follow-ups.
  const { data: followups, error: fErr } = await supabase
    .from('belarro_v4_follow_up')
    .select('id, customer_id, follow_up_number, due_date, status')
    .eq('status', 'pending')
    .lte('due_date', endOfTodayUTC())
    .order('due_date', { ascending: true });

  if (fErr) {
    await log({ channel: 'email', recipient: RON_EMAIL_TO, status: 'failed', error: fErr.message });
    return new Response(JSON.stringify({ ok: false, error: fErr.message }), { status: 500 });
  }

  const list = followups ?? [];

  // 2. Hydrate customers.
  const ids = [...new Set(list.map((f) => f.customer_id))];
  let custMap = new Map<string, any>();
  if (ids.length) {
    const { data: customers } = await supabase
      .from('belarro_v4_customer')
      .select('id, name, restaurant_name, contact_person, phone, whatsapp')
      .in('id', ids);
    custMap = new Map((customers ?? []).map((c) => [c.id, c]));
  }

  const count = list.length;

  // 3. If nothing due, log 'skipped' and exit (no noisy empty messages).
  if (count === 0) {
    await log({ channel: 'whatsapp', recipient: RON_WHATSAPP_TO, follow_up_count: 0, status: 'skipped' });
    await log({ channel: 'email', recipient: RON_EMAIL_TO, follow_up_count: 0, status: 'skipped' });
    return new Response(JSON.stringify({ ok: true, count: 0 }), { status: 200 });
  }

  // 4. Build the digest.
  const lines = list.map((f, i) => {
    const c = custMap.get(f.customer_id);
    const who = c?.restaurant_name || c?.name || 'Unknown';
    const phone = c?.phone ? ` (${c.phone})` : '';
    return `${i + 1}. ${who}${phone} — follow-up #${f.follow_up_number}`;
  });

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const waBody = `🌱 Belarro — ${count} follow-up${count > 1 ? 's' : ''} due today (${today}):\n\n${lines.join('\n')}\n\nOpen the dashboard to action them.`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#10B981">Belarro — ${count} follow-up${count > 1 ? 's' : ''} due today</h2>
      <p style="color:#6b7280">${today}</p>
      <ol style="color:#111827;line-height:1.7">
        ${list
          .map((f) => {
            const c = custMap.get(f.customer_id);
            const who = c?.restaurant_name || c?.name || 'Unknown';
            const phone = c?.phone ? ` &mdash; ${c.phone}` : '';
            return `<li><strong>${who}</strong>${phone} (follow-up #${f.follow_up_number})</li>`;
          })
          .join('')}
      </ol>
      <p><a href="https://belarro-v4.vercel.app/admin" style="color:#10B981;font-weight:600">Open dashboard →</a></p>
    </div>`;

  // 5. Send both channels (each logs its own outcome; one failing doesn't block the other).
  await Promise.all([
    sendWhatsApp(waBody, count),
    sendEmail(`Belarro: ${count} follow-up${count > 1 ? 's' : ''} due today`, html, count),
  ]);

  return new Response(JSON.stringify({ ok: true, count }), { status: 200 });
});
