# Belarro Platform — Sprint 1 Build (June 24–26)

> **Copy-paste ready.** Clone the repo, follow this top to bottom, and the four Sprint 1 features ship.
> All paths are relative to `belarro-v4/frontend/` unless stated otherwise.
>
> **Stack as it exists today:** Next.js 16 (App Router), React 18, Tailwind 3, Supabase (accessed via REST through `src/lib/supabase.ts` using the service-role key). No auth exists yet. Tables are prefixed `belarro_v4_`.

---

## Sprint 1 Scope

| ID | Feature | Outcome |
|----|---------|---------|
| Phase 1 | Auth | Ron logs in with email/password; every `/admin/*` route and every API route is gated. |
| Phase 2 | Dashboard | First widget on the dashboard shows today's due follow-ups. |
| Phase 3 | Notifications | Edge function sends WhatsApp + email at 07:00 daily; logged to `notification_log`. |
| Phase 4 | Sync | saletracker "Closed Deal" creates a customer + 5 follow-ups in admin. |

---

## 0. Pre-flight (do this first, once)

### 0.1 Install new dependencies

```bash
cd belarro-v4/frontend
npm install @supabase/ssr@^0.5.1 @supabase/supabase-js@^2.43.0
```

`@supabase/supabase-js` is already a dependency; `npm install` keeps it pinned. `@supabase/ssr` is the only genuinely new package the frontend needs. Twilio and Resend run inside the Supabase Edge Function (Deno), not in the Next.js app — no npm install needed for them.

### 0.2 Environment variables

**`.env.local` (already present — confirm these two exist, add the rest):**

```env
# Already present
NEXT_PUBLIC_SUPABASE_URL=https://wbqzlxdyjdmbzifhsyil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — already in file>
SUPABASE_SERVICE_ROLE_KEY=<service role key — already in file>
```

> The anon key is required for `@supabase/ssr` (it powers the cookie-based session). It is already in `.env.local`. Good.

**Vercel dashboard → Project → Settings → Environment Variables** (Production + Preview):

| Name | Value | Notes |
|------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wbqzlxdyjdmbzifhsyil.supabase.co` | already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon JWT) | already set |
| `SUPABASE_SERVICE_ROLE_KEY` | (service-role JWT) | already set — **server only, never `NEXT_PUBLIC_`** |

> Twilio/Resend secrets are **Supabase Edge Function secrets**, not Vercel vars — see Phase 3.

### 0.3 `.gitignore` check (HARD RULE — never commit secrets)

```bash
cd belarro-v4/frontend
git check-ignore -v .env.local   # must print a match
```
If it does not match, add `.env*.local` and `.env` to `.gitignore` before doing anything else.

---

# PHASE 1 — Core Auth (S1-001 → S1-009)

## S1-001 / S1-002 — Supabase Auth + Ron's user (Supabase Dashboard, no code)

1. **Supabase Dashboard → Authentication → Providers → Email**: enable **Email** provider. Turn **OFF** "Confirm email" (single-operator app; Ron's account is created by you, not self-signup).
2. **Authentication → Users → Add user → Create new user**:
   - Email: `rbyinc@gmail.com`
   - Password: (set a strong one, hand it to Ron via 1Password — never commit it)
   - Auto Confirm User: **ON**
3. **Authentication → URL Configuration**: set **Site URL** to your Vercel production URL (e.g. `https://belarro-v4.vercel.app`) and add `http://localhost:3000` to **Redirect URLs**.

**Acceptance:** The user appears in the Users table with a green "confirmed" state.

---

## S1-003 / S1-004 — `lib/supabase-server.ts` (server-side client with cookies)

### `src/lib/supabase-server.ts`

**Purpose:** Creates a Supabase client bound to the request's cookies for use in Server Components, Route Handlers, and the dashboard. Reads the logged-in user from the session cookie. This is the *auth* client (anon key + user session) — distinct from the existing service-role `fetchFromSupabase` helper, which we keep for privileged data reads.

**Code:**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client bound to the current request's cookies.
 * Use inside Server Components and Route Handlers to read the
 * authenticated user / session. Next.js 16: cookies() is async.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component (read-only cookies).
            // Safe to ignore — middleware refreshes the session cookie.
          }
        },
      },
    }
  );
}

/**
 * Returns the authenticated user or null. Use at the top of every
 * API route to gate access.
 */
export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
```

**Test locally:** Imported by routes below; verified there.

**Acceptance:** Compiles with `npm run build`. No TypeScript errors.

---

### `src/lib/supabase-browser.ts`

**Purpose:** Browser-side Supabase client for the login form (calls `signInWithPassword`) and the logout button.

**Code:**

```ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Acceptance:** Imported by `/login` and the logout button without error.

---

## S1-005 — Auth helper for API routes

### `src/lib/auth.ts`

**Purpose:** One-line guard used at the top of every API route. Returns a ready-made 401 response when there is no session, so each route stays clean.

**Code:**

```ts
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
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  return { ok: true as const, user };
}
```

**Acceptance:** Used by every route in S1-008.

---

## S1-006 — Login page

### `src/app/login/page.tsx`

**Purpose:** Email/password login form. On success, redirects to `/admin`. Matches the Belarro design language (green #10B981, rounded cards, focus rings).

**Code:**

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    // Full navigation so the new session cookie is picked up by middleware.
    router.refresh();
    router.replace('/admin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-lg">
            B
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Belarro</h1>
            <p className="text-xs text-gray-500 font-medium">Farm Management</p>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Sign in</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Enter your credentials to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="you@belarro.de"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Test locally:** `npm run dev`, open `http://localhost:3000/login`, enter Ron's credentials → lands on `/admin`. Wrong password → red error, no redirect.

**Acceptance:** Valid login redirects to `/admin`; invalid login shows the error and stays on `/login`.

---

## S1-007 — Middleware gates all `/admin/*` routes

> **Replaces** the current `middleware.ts` (which only redirects `/`). The new version refreshes the Supabase session cookie on every request **and** redirects unauthenticated users away from `/admin/*`.

### `src/middleware.ts`

> **Important:** the existing file is at the project root (`frontend/middleware.ts`). Next.js accepts either `middleware.ts` at root **or** `src/middleware.ts`. Since the rest of the app lives in `src/`, move it to `src/middleware.ts` and delete the root one to keep a single source of truth. (If you prefer to keep it at root, the code is identical — just leave it where it is and delete `src/middleware.ts`.)

**Purpose:** (1) keep the Supabase auth cookie fresh, (2) bounce logged-out users from `/admin/*` to `/login`, (3) preserve the existing `/ → /admin` redirect, (4) keep already-logged-in users off `/login`.

**Code:**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() refreshes the session cookie. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Root → dashboard (preserves prior behaviour, now points at /admin).
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Gate everything under /admin.
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users shouldn't see the login page.
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image optimisation files.
     * API routes are intentionally NOT matched here — each route enforces
     * auth itself via requireAuth() (defence in depth + correct 401 JSON).
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

> **Why API routes call `requireAuth()` instead of relying on middleware:** middleware redirects (302) are wrong for an API client — it needs a clean `401 JSON`. So the dashboard/UI is gated by middleware, and the data layer is gated by `requireAuth()`. Defence in depth.

**Test locally:**
- Log out (or open incognito) → visit `http://localhost:3000/admin` → redirected to `/login`.
- Log in → visit `/login` → redirected to `/admin`.
- `curl http://localhost:3000/api/crops` with no session → see `{"success":false,"error":"Unauthorized"}` once S1-008 is applied.

**Acceptance:** Unauthenticated `/admin` access redirects to `/login`; authenticated access loads.

---

## S1-008 — Auth check on every API route

Add these **two lines** to the top of every handler (`GET`, `POST`, `PUT`, `DELETE`) in every route under `src/app/api/`, immediately inside the `try`:

```ts
const auth = await requireAuth();
if (!auth.ok) return auth.response;
```

…and add the import at the top of each file:

```ts
import { requireAuth } from '@/lib/auth';
```

**Routes to patch (every handler in each):**

```
src/app/api/crops/route.ts
src/app/api/crops/[id]/route.ts
src/app/api/customers/route.ts
src/app/api/customers/[id]/route.ts
src/app/api/dashboard/route.ts
src/app/api/follow-ups/route.ts
src/app/api/follow-ups/[id]/route.ts
src/app/api/harvest/route.ts
src/app/api/inventory/route.ts
src/app/api/invoices/route.ts
src/app/api/orders/route.ts
src/app/api/orders/[id]/route.ts
src/app/api/seeding/route.ts
src/app/api/upload/route.ts
```

> **DO NOT** add `requireAuth()` to the sync endpoint (`/api/sync-sales-tracker`, Phase 4) — that one is called by Google Apps Script and is protected by a shared secret instead. See S1-018.

**Worked example — full patched `src/app/api/customers/route.ts` GET (top portion):**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';   // ← add

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();        // ← add
    if (!auth.ok) return auth.response;       // ← add

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    // ...rest unchanged
```

Apply the identical two-line insert to the `POST` handler in the same file, and to every handler in every route in the list above.

> **Fast path (optional, for the developer):** these are mechanical edits. A find/replace per file is fine, but verify each handler individually — some files have multiple exports (`GET` + `POST`, or `GET` + `PUT` + `DELETE`).

**Test locally:**
```bash
# No session → 401
curl -s http://localhost:3000/api/customers | jq '.'
# → {"success": false, "error": "Unauthorized"}
```
Then log in via browser and the customers page loads normally (browser sends the session cookie).

**Acceptance:** Every `/api/*` route (except sync) returns `401 Unauthorized` when called without a session, and works normally with one.

---

## S1-009 — Logout button in Sidebar

> Replaces the static footer in `src/components/Sidebar.tsx` with a logout button. The Sidebar is already a client component, so we can add the handler inline.

**Edit `src/components/Sidebar.tsx`:**

1. Add to the imports at the top:

```tsx
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
```

2. Inside the component, just after `const pathname = usePathname();`, add:

```tsx
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
    router.replace('/login');
  }
```

3. Replace the footer block:

```tsx
      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
        <p className="text-[11px] text-gray-400 font-medium">Belarro V4 Admin</p>
      </div>
```

with:

```tsx
      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition flex items-center justify-center gap-2"
        >
          Sign out
        </button>
        <p className="text-[11px] text-gray-400 font-medium text-center">Belarro V4 Admin</p>
      </div>
```

**Test locally:** Click "Sign out" → redirected to `/login`; pressing back / re-visiting `/admin` redirects to `/login` again (session is gone).

**Acceptance:** Logout clears the session and returns Ron to `/login`.

---

# PHASE 2 — Follow-up Dashboard (S1-010, S1-011)

## S1-010 — `GET /api/follow-ups/today`

### `src/app/api/follow-ups/today/route.ts`

**Purpose:** Returns follow-ups that are **due today or overdue** and still `pending`, hydrated with customer contact details. Drives the dashboard widget and is reused by the notification edge function's logic (the edge function queries Supabase directly, but the day-window logic matches this route).

**Code:**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // End of "today" in UTC. Due = due_date <= end of today AND status pending.
    // This intentionally includes overdue items so nothing slips through.
    const now = new Date();
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    ).toISOString();

    const path =
      `/belarro_v4_follow_up` +
      `?status=eq.pending` +
      `&due_date=lte.${endOfToday}` +
      `&select=*` +
      `&order=due_date.asc`;

    const followups = (await fetchFromSupabase(path)) || [];

    // Hydrate with customer details (one extra read, small table).
    const customers =
      (await fetchFromSupabase(
        '/belarro_v4_customer?select=id,name,restaurant_name,contact_person,phone,whatsapp,email'
      )) || [];
    const custMap = new Map<string, any>(customers.map((c: any) => [c.id, c]));

    const data = followups.map((f: any) => {
      const customer = custMap.get(f.customer_id) || { name: 'Unknown Customer' };
      const due = new Date(f.due_date);
      const isOverdue = due < new Date(endOfToday) && due.toDateString() !== now.toDateString();
      return {
        ...f,
        customer,
        is_overdue: due.getTime() < now.setHours(0, 0, 0, 0),
      };
    });

    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Follow-ups today GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

> **Honest-metrics note (no fake data):** unlike the existing `/api/follow-ups` route, this endpoint does **not** fall back to mock data on DB error — it returns a real `500`. The dashboard widget shows an honest error state rather than fabricated follow-ups. This aligns with the "no fake data, honest metrics only" principle.

**Test locally:**
```bash
# After logging in, grab the session cookie from the browser devtools (Application → Cookies)
# or just hit it in the browser address bar while logged in:
#   http://localhost:3000/api/follow-ups/today
# Expect: {"success":true,"data":[...],"count":N}
```

**Acceptance:** Returns only `pending` follow-ups with `due_date <= end of today`, each carrying a `customer` object. 401 without a session.

---

## S1-011 — `FollowUpWidget` component

### `src/components/FollowUpWidget.tsx`

**Purpose:** Dashboard widget listing today's due follow-ups with one-tap WhatsApp / email / call actions and a "Mark done" button that PATCHes the follow-up to `completed`.

**Code:**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Customer {
  id?: string;
  name: string;
  restaurant_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

interface FollowUp {
  id: string;
  customer_id: string;
  follow_up_number: number;
  due_date: string;
  status: string;
  notes?: string | null;
  is_overdue?: boolean;
  customer: Customer;
}

export default function FollowUpWidget() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/follow-ups/today');
      const json = await res.json();
      if (json.success) setItems(json.data);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markDone(id: string) {
    setCompleting(id);
    try {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', sent_via: 'call', sent_date: new Date().toISOString() }),
      });
      if (res.ok) setItems((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setCompleting(null);
    }
  }

  function waLink(c: Customer) {
    const num = (c.whatsapp || c.phone || '').replace(/[^0-9]/g, '');
    return num ? `https://wa.me/${num}` : null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Today&apos;s Follow-ups</h2>
          {!loading && !error && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-50 text-green-700">
              {items.length}
            </span>
          )}
        </div>
        <Link href="/admin/follow-ups" className="text-xs font-semibold text-green-600 hover:text-green-700">
          View All
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-sm text-red-600">
          Couldn&apos;t load follow-ups.{' '}
          <button onClick={load} className="font-semibold underline hover:text-red-700">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          🎉 No follow-ups due today. You&apos;re all caught up.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {items.map((f) => {
            const wa = waLink(f.customer);
            return (
              <li key={f.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 truncate">
                      {f.customer.restaurant_name || f.customer.name}
                    </span>
                    {f.is_overdue && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-600">
                        OVERDUE
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500">
                      #{f.follow_up_number}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {f.customer.contact_person || f.customer.name}
                    {f.customer.phone ? ` · ${f.customer.phone}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                    >
                      WA
                    </a>
                  )}
                  {f.customer.email && (
                    <a
                      href={`mailto:${f.customer.email}`}
                      title="Email"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    >
                      Email
                    </a>
                  )}
                  <button
                    onClick={() => markDone(f.id)}
                    disabled={completing === f.id}
                    title="Mark done"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition"
                  >
                    {completing === f.id ? '…' : 'Done'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

> **Dependency on `PUT /api/follow-ups/[id]`:** the "Done" button PUTs `{ status: 'completed', ... }`. Confirm `src/app/api/follow-ups/[id]/route.ts` exports a `PUT` (or `PATCH`) handler that updates those fields. It already exists in the repo — just ensure it accepts a partial `status` update and has the `requireAuth()` guard from S1-008. If it only exports `PATCH`, change the widget's `method` to `'PATCH'`.

**Acceptance:** Widget lists today's follow-ups; WhatsApp/email/call links open; "Done" removes the item and persists `completed` in the DB.

---

## S1-011b — Mount the widget as the first dashboard element

**Edit `src/app/admin/page.tsx`:**

1. Add the import near the top:

```tsx
import FollowUpWidget from '@/components/FollowUpWidget';
```

2. Place the widget as the **first** child inside the returned `<div className="space-y-8">`, immediately above the Header block:

```tsx
  return (
    <div className="space-y-8">
      {/* Today's follow-ups — first thing Ron sees */}
      <FollowUpWidget />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Farm Overview</h1>
        {/* ...unchanged... */}
```

> Note the dashboard's loading guard returns early before the JSX. Mounting `FollowUpWidget` inside the main return means it renders once `data` resolves. If you want it to render even while the KPI dashboard is still loading, lift it above the `if (loading)` check into its own wrapper — but for Sprint 1, inside the main return is fine and simplest.

**Test locally:** Log in → `/admin` shows "Today's Follow-ups" as the top card.

**Acceptance:** The follow-up widget is the first element on the dashboard.

---

# PHASE 3 — Notifications (S1-012 → S1-016)

## S1-014 — `notification_log` table (run in Supabase SQL editor)

**Purpose:** Audit trail of every notification attempt. Required by the Data Protection Mandate (audit logs, no silent failures).

**SQL:**

```sql
CREATE TABLE IF NOT EXISTS belarro_v4_notification_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_date     DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient    TEXT NOT NULL,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_id  TEXT,            -- Twilio SID / Resend id
  error        TEXT,
  payload      JSONB,           -- the message body / summary, for audit
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_run_date
  ON belarro_v4_notification_log (run_date DESC);
```

**Acceptance:** Table exists; `select * from belarro_v4_notification_log` returns 0 rows.

---

## S1-012 / S1-013 — Edge Function: `notify-follow-ups`

> Runs in Supabase (Deno). It queries today's due follow-ups, builds a summary, sends one WhatsApp (Twilio) + one email (Resend) to Ron, and logs both attempts.

### File: `supabase/functions/notify-follow-ups/index.ts`

> Create this in the **belarro-v4 repo root** (not under `frontend/`) — Supabase CLI expects `supabase/functions/...`. If a `supabase/` folder doesn't exist yet, run `supabase init` once at the repo root.

**Purpose:** Daily 07:00 digest of due follow-ups via WhatsApp + email.

**Code:**

```ts
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
```

**Deploy:**
```bash
cd belarro-v4               # repo root
supabase functions deploy notify-follow-ups --no-verify-jwt
```
> `--no-verify-jwt` because we authenticate with our own `x-cron-secret` header (pg_cron isn't a logged-in user).

**Edge Function secrets** (Supabase Dashboard → Edge Functions → notify-follow-ups → Secrets, **or** CLI):
```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxx \
  TWILIO_AUTH_TOKEN=xxx \
  TWILIO_WHATSAPP_FROM="whatsapp:+14155238886" \
  RON_WHATSAPP_TO="whatsapp:+49XXXXXXXXXX" \
  RESEND_API_KEY=re_xxx \
  RON_EMAIL_TO="rbyinc@gmail.com" \
  EMAIL_FROM="Belarro <noreply@belarro.de>" \
  CRON_SECRET="$(openssl rand -hex 32)"
```
> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every Edge Function — do **not** set them manually.
>
> **Twilio WhatsApp note:** to start, use the Twilio **WhatsApp Sandbox** (`whatsapp:+14155238886`) and have Ron join the sandbox from his phone (one-time). For production, request a WhatsApp Business sender. Resend: verify the `belarro.de` domain (or use Resend's `onboarding@resend.dev` sender for the first test).

**Test locally / manually (real E2E, no simulation):**
```bash
# Invoke the function directly with the secret — proves the whole path end to end.
curl -i -X POST \
  "https://wbqzlxdyjdmbzifhsyil.supabase.co/functions/v1/notify-follow-ups" \
  -H "x-cron-secret: <the CRON_SECRET you set>" \
  -H "Content-Type: application/json"
# Expect HTTP 200 + {"ok":true,"count":N}
# Then: check Ron's phone (WhatsApp) and rbyinc@gmail.com (email),
# and: select * from belarro_v4_notification_log order by created_at desc limit 5;
```

**Acceptance:** Manual invoke returns 200, Ron receives a WhatsApp + email (when count > 0), and two rows land in `belarro_v4_notification_log`. Bad/missing `x-cron-secret` → 401.

---

## S1-015 / S1-016 — pg_cron trigger at 07:00 daily

> Sends the daily trigger to the edge function. Uses `pg_cron` + `pg_net` (both available on Supabase). 07:00 **Berlin** time = `05:00 UTC` in winter (CET, UTC+1) / `05:00 UTC` is 07:00 CEST in summer... — see note below.

**SQL (run once in Supabase SQL editor):**

```sql
-- Enable required extensions (idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the cron secret + function URL in Vault-backed settings is ideal;
-- for Sprint 1, inline them in the command (rotate later).
-- Schedule: '0 5 * * *' = 05:00 UTC.
--   Berlin is UTC+2 in summer (CEST) → 05:00 UTC = 07:00 local. ✅ (June ships in summer)
--   In winter (CET, UTC+1), 05:00 UTC = 06:00 local — adjust to '0 6 * * *' after DST ends (late Oct).
select cron.schedule(
  'belarro-daily-followups',
  '0 5 * * *',
  $$
  select net.http_post(
    url     := 'https://wbqzlxdyjdmbzifhsyil.supabase.co/functions/v1/notify-follow-ups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'PASTE_THE_SAME_CRON_SECRET_HERE'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify it's registered:
select jobid, schedule, jobname, active from cron.job where jobname = 'belarro-daily-followups';
```

> **DST honesty:** Sprint 1 ships in June (CEST). `0 5 * * *` UTC = 07:00 Berlin. When clocks fall back in late October, change the schedule to `0 6 * * *`. (A future enhancement is to schedule in a TZ-aware way, but for one operator a calendar reminder to flip it twice a year is the bootstrap-correct call.)

**To update later:**
```sql
select cron.unschedule('belarro-daily-followups');
-- then re-run cron.schedule with the new time
```

**Test:** You already proved the function works via the manual `curl`. To prove the cron wiring without waiting until 07:00, temporarily schedule it one minute out, e.g. `select cron.schedule('belarro-test','*/1 * * * *', $$ ... $$);`, confirm a fresh `notification_log` row appears, then `cron.unschedule('belarro-test')`.

**Acceptance:** `cron.job` lists the active job; manual one-minute test produces a real notification + log row.

---

# PHASE 4 — saletracker Sync (S1-017, S1-018)

## S1-018 — Sync endpoint in belarro-v4

> saletracker's `SYNC_TO_SUPABASE.js` POSTs to `/api/sync-sales-tracker` (currently pointed at `belarro-v2`). We build that endpoint in **v4** so a "Closed Deal" creates a customer **and the 5 follow-ups** (matching the existing customer-creation logic in `/api/customers`).

### `src/app/api/sync-sales-tracker/route.ts`

**Purpose:** Receives a closed-deal prospect from Google Apps Script, creates/updates a `belarro_v4_customer` with status `active`, and generates the standard 5 follow-ups (days 0, 3, 7, 14, 30). Idempotent on restaurant name to avoid duplicates on repeated edits.

**Code:**

```ts
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

    const created = await fetchFromSupabase('/belarro_v4_customer', {
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
```

**Env var (Vercel + `.env.local`):**

| Name | Value |
|------|-------|
| `SALETRACKER_SYNC_SECRET` | `openssl rand -hex 24` — same value goes into the Apps Script (below) |

```bash
# generate it
openssl rand -hex 24
```

**Test locally (real E2E with curl):**
```bash
# Valid closed deal:
curl -s -X POST http://localhost:3000/api/sync-sales-tracker \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: <your SALETRACKER_SYNC_SECRET>" \
  -d '{"locationName":"Test Bistro","contactPerson":"Anna K","directPhone":"+49 1520 1112233","directEmail":"anna@testbistro.de","city":"Berlin"}' | jq '.'
# → {"success":true,"id":"...","message":"Customer + 5 follow-ups created...","follow_ups_created":5}

# Duplicate (run again) → {"success":true,"duplicate":true,...}
# Wrong secret → 401
# Missing fields → 400

# Verify in DB:
#   select * from belarro_v4_customer where restaurant_name='Test Bistro';
#   select * from belarro_v4_follow_up where customer_id='<id>';  -- 5 rows
# Verify in UI: log in → /admin/customers shows "Test Bistro" (active);
#               /admin → today's follow-up widget shows the day-0 follow-up.
```

**Acceptance:** A POST with valid secret creates exactly one customer + 5 follow-ups; the customer appears in `/admin/customers` and the day-0 follow-up appears in the dashboard widget; duplicates are skipped; bad secret → 401.

---

## S1-018b — Update the Apps Script (saletracker repo)

**Edit `saletracker/SYNC_TO_SUPABASE.js`:**

1. Point the endpoint at v4 and add the secret. Change line 27:

```js
// FROM:
const SYNC_ENDPOINT = 'https://belarro-v2.vercel.app/api/sync-sales-tracker';
// TO (your v4 production URL):
const SYNC_ENDPOINT = 'https://belarro-v4.vercel.app/api/sync-sales-tracker';
const SYNC_SECRET   = 'PASTE_THE_SAME_SALETRACKER_SYNC_SECRET';   // add this line
```

2. In `syncProspectToSupabase`, add the secret header (inside the `headers` object of the `UrlFetchApp.fetch` options):

```js
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': SYNC_SECRET           // ← add
      },
```

3. The existing payload already sends `locationName`, `contactPerson`, `directPhone`, `directEmail` — which is exactly what the v4 endpoint maps. The script also sends `language`, `visitNotes`, etc.; the v4 endpoint ignores extras harmlessly.

> **Folder permission note:** this is the one change in the `saletracker` repo. Everything else in Sprint 1 is in `belarro-v4/frontend` (+ the `supabase/` functions folder at the v4 root). Confirm with Ron before committing in `saletracker`.

**Acceptance (S1-017 — full sync E2E):** In the Google Sheet, set a real test row's Interest Level to "Closed Deal" → Apps Script toast "synced" → customer + 5 follow-ups appear in Belarro v4 admin.

---

# Final Verification Checklist (S1-017 / S1-018 — real tests, proof required)

Run all of these against the **running** system, not from reading code.

- [ ] **Auth gate (UI):** Incognito → `localhost:3000/admin` → redirected to `/login`. ✅ screenshot.
- [ ] **Auth gate (API):** `curl -s localhost:3000/api/customers` → `{"success":false,"error":"Unauthorized"}`. ✅ paste output.
- [ ] **Login:** Ron's email/password → lands on `/admin`. Wrong password → red error. ✅ screenshot both.
- [ ] **Logout:** Sidebar "Sign out" → `/login`; back button can't reach `/admin`. ✅
- [ ] **Dashboard widget:** `/admin` top card = "Today's Follow-ups" with real counts (or honest empty/error state). ✅ screenshot.
- [ ] **Mark done:** Click "Done" on a follow-up → it disappears; `select status from belarro_v4_follow_up where id=...` = `completed`. ✅
- [ ] **Notification function:** `curl` the edge function with the secret → 200; Ron's WhatsApp + email arrive; 2 rows in `belarro_v4_notification_log`. ✅ screenshot phone + email + SQL.
- [ ] **Cron registered:** `select * from cron.job where jobname='belarro-daily-followups'` → active. ✅
- [ ] **Sync (curl):** valid POST → customer + 5 follow-ups; duplicate skipped; bad secret 401. ✅ paste outputs.
- [ ] **Sync (real sheet):** mark a row "Closed Deal" → customer appears in `/admin/customers`. ✅ screenshot.
- [ ] **Build clean:** `npm run build` → 0 TypeScript errors. ✅

---

# File Manifest (everything Sprint 1 adds or changes)

**New files — `belarro-v4/frontend/`:**
```
src/lib/supabase-server.ts        (new)
src/lib/supabase-browser.ts       (new)
src/lib/auth.ts                   (new)
src/app/login/page.tsx            (new)
src/middleware.ts                 (new — replaces root middleware.ts)
src/app/api/follow-ups/today/route.ts   (new)
src/components/FollowUpWidget.tsx  (new)
src/app/api/sync-sales-tracker/route.ts (new)
```

**New files — `belarro-v4/` (repo root):**
```
supabase/functions/notify-follow-ups/index.ts   (new — Deno edge function)
```

**Edited files — `belarro-v4/frontend/`:**
```
src/components/Sidebar.tsx         (logout button)
src/app/admin/page.tsx             (mount FollowUpWidget first)
src/app/api/*/route.ts             (requireAuth() on every handler — 14 routes)
package.json                       (add @supabase/ssr)
.env.local                         (add SALETRACKER_SYNC_SECRET)
```

**Edited files — `saletracker/`:**
```
SYNC_TO_SUPABASE.js                (endpoint URL → v4, add x-sync-secret header)
```

**SQL run in Supabase:**
```
belarro_v4_notification_log table
pg_cron + pg_net extensions + belarro-daily-followups job
```

**Supabase Dashboard config:**
```
Enable Email auth provider; create rbyinc@gmail.com user (auto-confirmed)
Edge Function secrets: Twilio + Resend + CRON_SECRET
Site URL + redirect URLs
```

**Secrets to generate / store (1Password — never commit):**
```
Ron's login password
SALETRACKER_SYNC_SECRET   (Vercel env + Apps Script + .env.local)
CRON_SECRET               (Edge Function secret + pg_cron SQL)
TWILIO_*, RESEND_API_KEY  (Edge Function secrets)
```

---

## Ship order (do it in this sequence)

1. Pre-flight (0.1–0.3) → 2. Supabase auth + Ron user (S1-001/002) → 3. All lib files + login + middleware (S1-003→007) → 4. `requireAuth()` across routes (S1-008) → 5. Logout (S1-009) → **commit + deploy, verify auth E2E** → 6. `/today` route + widget (S1-010/011) → **verify dashboard** → 7. `notification_log` + edge function + secrets + cron (S1-012→016) → **verify notification E2E** → 8. Sync endpoint + Apps Script (S1-018) → **verify sync E2E** → 9. Full checklist.

Auth first because everything else sits behind it. Each phase is independently shippable and testable — don't batch the verification to the end.
