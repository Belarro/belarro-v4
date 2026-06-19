// Shared Supabase REST helper (service-role, server-only).
// Centralizes what was previously inlined in each API route so new Sprint 1
// routes share one source of truth. NEVER import this into a client component —
// it uses the service-role key.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wbqzlxdyjdmbzifhsyil.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function fetchFromSupabase(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  return response.json();
}
