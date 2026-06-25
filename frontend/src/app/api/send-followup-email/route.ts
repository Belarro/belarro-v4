import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const FLYER_EN = 'https://wbqzlxdyjdmbzifhsyil.supabase.co/storage/v1/object/public/assets/flyers/followup-en.png';
const FLYER_DE = 'https://wbqzlxdyjdmbzifhsyil.supabase.co/storage/v1/object/public/assets/flyers/followup-de.png';

async function getValidAccessToken(): Promise<string> {
  const rows = await fetchFromSupabase('/gmail_tokens?email=eq.hello%40belarro.com&select=*');
  if (!rows || rows.length === 0) throw new Error('Gmail not connected. Go to Settings to connect.');

  const token = rows[0];
  const now = new Date();
  const expiresAt = new Date(token.expires_at);

  // Refresh if expired (with 60s buffer)
  if (expiresAt.getTime() - now.getTime() < 60000) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!refreshRes.ok) throw new Error('Failed to refresh Gmail token. Reconnect in Settings.');
    const refreshed = await refreshRes.json();
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await fetchFromSupabase(`/gmail_tokens?id=eq.${token.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ access_token: refreshed.access_token, expires_at: newExpiry, updated_at: new Date().toISOString() }),
    });
    return refreshed.access_token;
  }

  return token.access_token;
}

function buildMimeEmail({
  to, subject, body, language, attachmentBase64, attachmentName,
}: {
  to: string; subject: string; body: string; language: string;
  attachmentBase64: string; attachmentName: string;
}): string {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: Belarro Microgreens <hello@belarro.com>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: image/png; name="${attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    ``,
    attachmentBase64,
    ``,
    `--${boundary}--`,
  ];
  return lines.join('\r\n');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { followup_id, to, subject, body, language } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Fetch flyer as base64
    const flyerUrl = (language || '').toUpperCase() === 'DE' ? FLYER_DE : FLYER_EN;
    const flyerName = (language || '').toUpperCase() === 'DE' ? 'Belarro-Microgreens-DE.png' : 'Belarro-Microgreens-EN.png';

    const flyerRes = await fetch(flyerUrl);
    if (!flyerRes.ok) throw new Error('Failed to fetch flyer image');
    const flyerBuffer = await flyerRes.arrayBuffer();
    const flyerBase64 = Buffer.from(flyerBuffer).toString('base64');

    // Build MIME email
    const raw = buildMimeEmail({
      to, subject, body, language,
      attachmentBase64: flyerBase64,
      attachmentName: flyerName,
    });

    // Base64url encode
    const encodedEmail = Buffer.from(raw).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Get valid access token
    const accessToken = await getValidAccessToken();

    // Send via Gmail API
    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error('Gmail send failed:', err);
      throw new Error(`Gmail send failed: ${sendRes.status}`);
    }

    // Auto-log the follow-up as sent
    if (followup_id) {
      await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${followup_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'sent',
          sent_via: 'email',
          sent_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      // Advance next stage due date
      const current = await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${followup_id}&select=*`);
      if (current && current.length > 0) {
        const cur = current[0];
        const nextStage = (cur.stage || 1) + 1;
        const next = await fetchFromSupabase(
          `/belarro_v4_follow_up?location_id=eq.${cur.location_id}&stage=eq.${nextStage}&status=eq.pending&select=id,follow_up_days`
        );
        if (next && next.length > 0) {
          const n = next[0];
          const daysToAdd = n.follow_up_days ?? 2;
          const due = new Date();
          let added = 0;
          while (added < daysToAdd) {
            due.setDate(due.getDate() + 1);
            const dow = due.getDay();
            if (dow !== 0 && dow !== 6) added++;
          }
          await fetchFromSupabase(`/belarro_v4_follow_up?id=eq.${n.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ due_date: due.toISOString(), updated_at: new Date().toISOString() }),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
