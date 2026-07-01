import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

/**
 * Call at the top of every protected API route:
 *
 *   const auth = await requireAuth();
 *   if (!auth.ok) return auth.response;
 *
 * `auth.user` is the authenticated Supabase user when ok === true.
 */
export async function requireAuth() {
  const user = await getAuthenticatedUser();
  if (!user) {
    console.log('Auth failed: no user found');
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized', debug: 'no user in session' },
        { status: 401 }
      ),
    };
  }
  console.log('Auth successful:', user.email);
  return { ok: true as const, user };
}
