---
name: nextjs-gotchas
description: >
  Next.js (App Router / Next 16) behaviors that fail SILENTLY — build green,
  typecheck green, feature dead. Use when a button does nothing after deploy of
  a new route, Tailwind classes vanish on new folders, notFound() returns 200,
  a server action hangs for tens of seconds, or an env var is ignored. Covers
  allowedDevOrigins (403 chunks → no hydration), Tailwind JIT not scanning new
  route groups, loading.tsx breaking notFound()'s 404 status, the
  revalidatePath('/', 'layout') full-app cache purge, after() for fan-out work,
  and NEXT_PUBLIC_* being baked at dev-server start. Triggers on:
  allowedDevOrigins, hydration dead buttons, tailwind class missing, notFound
  200, revalidatePath slow, after next/server, fan-out, NEXT_PUBLIC restart.
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

## Checklist

- [ ] `allowedDevOrigins` covers localhost, 127.0.0.1, and `*.localhost`.
- [ ] New folders/route groups ⇒ dev-server restart + visual re-check.
- [ ] Status-sensitive public routes have no `loading.tsx`.
- [ ] `revalidatePath` targets specific paths; `'layout'` purge is deliberate.
- [ ] Post-action fan-out goes through `after()`; dispatcher batches queries.
- [ ] Env var added ⇒ dev server restarted before judging the feature broken.
