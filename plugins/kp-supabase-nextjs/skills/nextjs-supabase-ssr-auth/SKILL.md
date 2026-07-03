---
name: nextjs-supabase-ssr-auth
description: >
  Cookie-based SSR authentication for Next.js (App Router) + Supabase using
  @supabase/ssr. Use when setting up login, session middleware, protected routes,
  role-based access (admin/staff), service-role admin routes, or a numeric PIN
  login. Encodes the four client factories (browser/server/admin/middleware), the
  middleware auth gate, and two hard-won bugs: (1) middleware redirecting /api/*
  to the HTML login page so server-side sign-in never sets a cookie, and (2)
  route-handler sign-in cookies not propagating because they were written via
  next/headers cookies() instead of onto the response. Triggers on: supabase auth,
  @supabase/ssr, middleware session, signInWithPassword, RLS auth.uid(), PIN login.
metadata:
  type: reference
  stack: nextjs-app-router, supabase, typescript
---

# Next.js + Supabase SSR Auth

Cookie-based auth with `@supabase/ssr`. Battle-tested across multi-tenant SaaS
projects. Pairs with **[supabase-rls-schema]** for the DB side and
**vercel-react-best-practices** / **supabase-postgres-best-practices** for the
surrounding code and schema.

## Packages

Pin the client to avoid the `never`-generics incompatibility:

```jsonc
"@supabase/supabase-js": "~2.47.0",   // pin: 2.48+ broke ssr 0.5.x generics
"@supabase/ssr": "0.5.2"
```

## The four clients — one file each

### 1. Browser client (client components) — singleton

```ts
// lib/supabase/client.ts
'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;
export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
```

### 2. Server client (Server Components + read-only route handlers)

```ts
// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called during a Server Component render — middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
```

⚠️ This client is fine for **reads** and for Server Components. It is **NOT
reliable for writing session cookies in a route handler** — see the sign-in bug
below.

### 3. Service-role client (SERVER ONLY — bypasses RLS)

```ts
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Never import this into a client component. Use only for admin provisioning,
reading protected columns, or operations that must bypass RLS.

### 4. Middleware client (refresh session + gate routes)

```ts
// lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

const PUBLIC_PATHS = ['/login', '/manifest.webmanifest', '/sw.js'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  // 🔴 API routes must NEVER be redirected to the HTML login page — they enforce
  // their own auth and return JSON. The session is still refreshed above.
  const isApi = path.startsWith('/api');

  if (!user && !isPublic && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/'; url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}
```

```ts
// middleware.ts (repo root)
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
export async function middleware(request: NextRequest) { return updateSession(request); }
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
```

## 🔴 Bug #1 — middleware redirects `POST /api/*` to `/login`

**Symptom:** a login/sign-in API returns `200` in the browser but no session
cookie appears; protected routes still bounce to `/login`. The Network panel
shows `POST /api/login → 307 → /login?next=/api/login`.

**Cause:** the matcher includes `/api/*`, and the gate redirects every
unauthenticated non-public path to the HTML login page — including the login
POST itself. `fetch` follows the 307, so the real route handler never runs and
the `200` you see is the `/login` HTML.

**Fix:** never redirect `/api/*` (the `isApi` guard above). API routes enforce
their own auth and return JSON `401`. Redirecting an API call to an HTML page is
always wrong.

## 🔴 Bug #2 — route-handler sign-in cookie doesn't reach the browser

**Symptom:** `signInWithPassword` succeeds server-side (no error) but
`document.cookie` / the next request has no `sb-*` session cookie.

**Cause:** the route used `getSupabaseServer()` (writes via `next/headers`
`cookies()`), whose `setAll` does not reliably attach `Set-Cookie` onto a
`NextResponse.json()` returned from a route handler.

**Fix:** in any route handler that establishes a session, bind the client's
cookie writes directly to the **response object** (middleware-style):

```ts
// app/api/pin-login/route.ts  (any server-side sign-in route)
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ...resolve { email, password } (see PIN pattern below)...

  const response = NextResponse.json({ ok: true });   // create FIRST
  const sb = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));   // write onto RESPONSE
        },
      },
    },
  );
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  return response;   // carries Set-Cookie
}
```

Admin username/password login done with the **browser** client
(`getSupabaseBrowser().auth.signInWithPassword`) does not hit this bug — the
browser sets its own cookies. This only bites **server-side** sign-in routes.

## Role model + profile bootstrap

- One `profiles` row per `auth.users` (1:1), created by a `handle_new_user`
  trigger that **always** inserts `role = 'janitor'/'member'` — never trust a
  client-supplied role. Admins are promoted by the service-role key only.
- `is_admin()` is a `SECURITY DEFINER` helper (avoids RLS recursion). See
  **[supabase-rls-schema]**.
- Wrap the app in a `ProfileContext` that loads the caller's profile once;
  route by `profile.role` (admin → dashboard, staff → own board).

## PIN login pattern (numeric login without exposing the auth password)

Requirement shape: staff log in with a short numeric PIN; an admin can **view**
and **reset** each PIN; PINs must be unique.

1. Store the PIN **plaintext** in `profiles.pin` (admin must view it) and protect
   it with **column-level** grants so peers can't read each other's:
   ```sql
   alter table public.profiles add column if not exists pin text;
   create unique index if not exists profiles_pin_unique on public.profiles(pin) where pin is not null;
   revoke select (pin) on public.profiles from anon, authenticated;  -- only service_role reads it
   ```
   Because `select (pin)` is revoked, every client query must list explicit
   columns — `select('*')` will fail. Keep a `PROFILE_COLS` constant without `pin`.
2. Derive a **deterministic** Supabase auth password from the PIN so PIN sign-in
   works through normal `signInWithPassword`:
   ```ts
   // lib/pin.ts
   import { createHash } from 'crypto';
   const PEPPER = process.env.PIN_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'change-me';
   export const isValidPin = (v: unknown): v is string => typeof v === 'string' && /^\d{4}$/.test(v);
   export const derivePassword = (pin: string) => 'pin_' + createHash('sha256').update(`${PEPPER}:${pin}`).digest('hex');
   ```
   The seed script and every route must use the **same** `PEPPER` fallback so the
   derived passwords match.
3. **Sign-in route** (`/api/pin-login`): service-role finds the active staff row
   by `pin` → `admin.auth.admin.getUserById(id)` for the email → sign in with
   `derivePassword(pin)` using the **response-bound** client (Bug #2 fix).
4. **Set/reset PIN** (admin route or self route): validate 4 digits → uniqueness
   check (`.eq('pin', pin).neq('id', targetId)` → `409` on conflict) →
   `admin.auth.admin.updateUserById(id, { password: derivePassword(pin) })` **and**
   `update({ pin })`. Keep both in sync.
5. Login page defaults to a PIN keypad that auto-submits on the 4th digit, with a
   toggle to the admin username/password form.

## Checklist

- [ ] `.env.local` holds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY` (+ `PIN_PEPPER` if used). Gitignored, never committed.
- [ ] Middleware excludes `/api/*` from the login redirect.
- [ ] Every server-side sign-in route binds cookies to the response object.
- [ ] Service-role client is imported only in server code.
- [ ] Role is set server-side only; `handle_new_user` never trusts client metadata.
- [ ] Client profile reads use explicit columns when a protected column (e.g. `pin`) exists.
```
