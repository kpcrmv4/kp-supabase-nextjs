---
name: nextjs-gotchas
description: >
  Next.js (App Router / Next 16) behaviors that fail SILENTLY — build green,
  typecheck green, feature dead. Use when a button does nothing after deploy of
  a new route, Tailwind classes vanish on new folders, notFound() returns 200,
  a server action hangs for tens of seconds, an env var is ignored, or a
  date/"today" figure is right locally but wrong in production. Covers
  allowedDevOrigins (403 chunks → no hydration), Tailwind JIT not scanning new
  route groups, loading.tsx breaking notFound()'s 404 status, the
  revalidatePath('/', 'layout') full-app cache purge, after() for fan-out work,
  NEXT_PUBLIC_* being baked at dev-server start, and Vercel running in UTC
  (Thai dates / "today" buckets off by 7 hours vs UTC+7, pg_cron firing at the
  wrong hour). Triggers on: allowedDevOrigins, hydration dead buttons,
  tailwind class missing, notFound 200, revalidatePath slow, after
  next/server, fan-out, NEXT_PUBLIC restart, timezone, UTC, Asia/Bangkok,
  wrong date on Vercel, วันที่เพี้ยน, ยอดวันนี้ผิด, Failed to collect page
  data, _not-found build error, stale .next, dev port changed, page with no
  CSS.
metadata:
  type: reference
  stack: nextjs-app-router, nextjs-16
---

# Next.js gotchas — green build, dead feature

Every item here produced **no error** while being broken in production or dev.
Extracted from a completed 11-phase multi-tenant build.

## 1. Next 16 dev blocks cross-origin assets → hydration dies

Opening dev via `127.0.0.1` or `*.localhost` subdomains (multi-tenant
testing!) makes JS chunks answer **403** → React never hydrates → every button
is silently dead; no console error points at the cause.

```js
// next.config.mjs
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.localhost'],
};
```

## 2. Long-running dev server misses Tailwind classes in new folders

Creating a new route group (e.g. `app/(auth)/`) while `npm run dev` is running
→ Tailwind JIT doesn't scan it → the page renders un-styled (cards off-center,
buttons floating) with zero errors.

**Rule: new folder/route group ⇒ restart `npm run dev`, then re-check the page
visually.** Confirm it's this bug by listing what CSS actually shipped:

```js
[...document.styleSheets].flatMap(s => [...s.cssRules].map(r => r.selectorText))
```

## 3. `loading.tsx` makes `notFound()` return 200

A loading boundary streams the response with **200** immediately; a later
`notFound()` still renders the 404 UI but the status stays 200.

- Public pages that need a real 404 (QR landings, permalinks, SEO) →
  **no `loading.tsx`** on that segment.
- Logged-in internal pages → keeping the skeleton and accepting 200 is fine.

This is the exception to the `loading.tsx` guidance in [thai-saas-ui-kit]'s
states section — status-sensitive public routes opt out.

## 4. `revalidatePath('/', 'layout')` purges the whole app

In a server action it forces every route to re-render — pages hang for tens of
seconds (spinner never resolves, "Rendering..." overlay). Revalidate only what
changed:

```ts
revalidatePath('/notifications');   // ✅ the affected path
// client-side router.refresh() already refreshes the current layout
```

Reserve the `'/'`+`'layout'` form for data that genuinely appears in every
layout (org name), knowingly paying the cost.

## 5. Fan-out work: never `await` it inside the user's request

Real case: awaiting per-user web-push sends after an action made one status
click take **26 seconds**. Respond first, work after:

```ts
import { after } from 'next/server';

// ❌ user waits for the fan-out
await dispatchNotifications();

// ✅ response returns; fan-out runs afterwards
after(dispatchNotifications);
```

Inside the dispatcher: fetch all target subscriptions **once**, send in
parallel with `Promise.allSettled` — not a query per loop iteration
(26s → 2.8s). See [nextjs-pwa-webpush] for the push side.

## 6. `NEXT_PUBLIC_*` is baked when the dev server starts

Adding a key later (e.g. VAPID) does nothing until you restart — the feature
just silently stays off. Restart dev/build after any env change involving
`NEXT_PUBLIC_*`.

## 7. Vercel runs in UTC — "today" is 7 hours off Thai time

The dev machine sits in UTC+7; Vercel functions run in **UTC**. Everything
looks right locally, then in production — every day between 00:00 and 06:59
ICT:

- `new Date().toLocaleDateString('th-TH')` (no `timeZone`) shows
  **yesterday's** date on receipts, headers, reports.
- Server-computed "today" ranges (daily dashboard, ยอดวันนี้) bucket rows into
  the wrong day — numbers that are correct after 7am and wrong before it, the
  worst kind of intermittent.
- pg_cron schedules are UTC too: `0 1 * * *` fires at **08:00** Thai time.

Make the zone explicit at every display and day-boundary point; never rely on
server-local time:

```ts
// display — always pass timeZone
new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })
  .format(date);
```

```sql
-- day bucketing / "today" filters: convert in SQL, not in JS server code
select date_trunc('day', created_at at time zone 'Asia/Bangkok') as day, count(*)
from orders group by 1;

-- pg_cron: subtract 7h — 17:00 UTC = 00:00 ICT
select cron.schedule('daily-report', '0 17 * * *', $$ ... $$);
```

Storing `timestamptz` is already correct — the bug lives at **display and
day-boundary** time. Setting `TZ=Asia/Bangkok` in Vercel env patches the Node
runtime but not Edge/middleware and not pg_cron; treat it as a stopgap and
keep the explicit `timeZone:` / `at time zone` anyway.

## 8. `next build` while the dev server is running → phantom failures

The dev server holds `.next`; running `next build` beside it fails with
errors unrelated to your code — typically
`Failed to collect page data for /_not-found`. Before any build whose verdict
you intend to trust: **kill the dev server and `rm -rf .next`**, then build.
Don't debug the "error" first — reproduce it on a clean build before believing
it.

## 9. `npm run dev` silently hops to another port

Port busy → dev boots on the next free port, announced by one console line
nobody reads. Tests and Chrome MCP then talk to the **old half-dead server**
on the expected port — classic symptom: a page renders with no CSS from a
stale process. Before an E2E round: kill stray dev servers, start fresh on a
pinned port, and let global-setup's warm-up assert the app really answers
there ([kp-e2e-playwright-real-db]).

## Checklist

- [ ] `allowedDevOrigins` covers localhost, 127.0.0.1, and `*.localhost`.
- [ ] New folders/route groups ⇒ dev-server restart + visual re-check.
- [ ] Status-sensitive public routes have no `loading.tsx`.
- [ ] `revalidatePath` targets specific paths; `'layout'` purge is deliberate.
- [ ] Post-action fan-out goes through `after()`; dispatcher batches queries.
- [ ] Env var added ⇒ dev server restarted before judging the feature broken.
- [ ] Every date format call passes `timeZone: 'Asia/Bangkok'`; day buckets
      computed with `at time zone` in SQL; pg_cron hours converted from UTC.
- [ ] Build verdicts come from a clean run: dev server killed, `.next` removed.
- [ ] E2E targets a pinned port whose server was started fresh for this run.
