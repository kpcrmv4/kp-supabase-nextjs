---
name: nextjs-pwa-webpush
description: >
  Make a Next.js (App Router) app an installable PWA with a hand-rolled service
  worker, plus Web Push (VAPID) and in-app realtime notifications. Use when adding
  a manifest, offline shell, install prompt, push subscriptions, or server-sent
  push on domain events (assigned / reported / approved). Covers the SW (precache,
  network-first navigation, push + notificationclick), the required next.config
  headers so /sw.js updates, VAPID key handling (generated into .env at
  scaffold), the web-push sender that prunes dead endpoints, the notifications
  table + bell pattern, and the app-icon badge number (Badging API,
  setAppBadge in-app + from the SW push handler). Triggers on: PWA, service
  worker, manifest, web push, VAPID, web-push, push_subscriptions,
  notification bell, offline, app badge, setAppBadge, ตัวเลขบนไอคอน.
metadata:
  type: reference
  stack: nextjs-app-router, web-push, supabase
---

# Next.js PWA + Web Push + In-App Notifications

Hand-rolled (no `next-pwa`/serwist dependency) so it stays on Vercel free tier
and you control the SW. Pairs with **[supabase-rls-schema]** (the
`notifications` + `push_subscriptions` tables) and **[nextjs-supabase-ssr-auth]**.

## Service worker — `public/sw.js`

Precache the shell, network-first for navigations with an offline fallback, and
handle push + click:

```js
const CACHE = 'app-v1';   // bump on each deploy that changes precached files
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())));

self.addEventListener('activate', (e) =>
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch { return (await (await caches.open(CACHE)).match('/offline.html')) || Response.error(); }
    })());
  }
});

self.addEventListener('push', (e) => {
  let d = { title: 'แจ้งเตือน', body: '', url: '/', taskId: undefined, urgent: false, unreadCount: undefined };
  try { if (e.data) d = { ...d, ...e.data.json() }; } catch { if (e.data) d.title = e.data.text(); }
  e.waitUntil((async () => {
    // App icon badge while the app is closed — payload carries the count
    // (the SW can't query the DB itself; the server already knows the number).
    if (typeof d.unreadCount === 'number' && self.navigator.setAppBadge) {
      try {
        if (d.unreadCount > 0) await self.navigator.setAppBadge(d.unreadCount);
        else await self.navigator.clearAppBadge();
      } catch {}
    }
    await self.registration.showNotification(d.title, {
      // badge = monochrome status-bar glyph (Android), NOT the app-icon number.
      body: d.body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', lang: 'th',
      data: { url: d.url || '/' }, tag: d.taskId || undefined,
      requireInteraction: !!d.urgent,                     // urgent stays on screen
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { try { await c.navigate(target); } catch {} return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
```

## `next.config` — let the SW update + control its scope

```js
async headers() {
  return [{
    source: '/sw.js',
    headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
    ],
  }];
}
```

Without `no-cache` on `/sw.js`, browsers serve a stale worker and pushes/offline
behaviour silently drift from your code.

## Manifest + install

- `app/manifest.ts` returns name, `theme_color`, `display: 'standalone'`, and
  icons at 192 / 512 / maskable (generate from one source logo).
- Register the SW on mount; capture `beforeinstallprompt` in a `useInstallPrompt`
  hook to show a custom install button.

## Web Push — VAPID

Generate VAPID keys **at scaffold time** and write them into `.env.local`
(`/new-kp-app` does this): `npx web-push generate-vapid-keys --json` →
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (server only, never
committed), `VAPID_SUBJECT`.

- 🔴 **Generate once, keep forever.** New keys invalidate every existing push
  subscription — users must re-subscribe. Never overwrite keys already
  present in `.env.local`.
- Copy the **same** key pair into the Vercel project's env vars on deploy.
- Store subscriptions in `push_subscriptions` (endpoint unique).

Sender that prunes dead endpoints (410/404):

```ts
// lib/push-server.ts
import webpush from 'web-push';
let configured: boolean | null = null;
function ensure() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  return (configured = true);
}
export async function sendPush(subs, payload): Promise<string[]> {
  if (!ensure() || !subs.length) return [];
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload));
    } catch (err) {
      const st = (err as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) dead.push(s.endpoint);   // delete these rows
    }
  }));
  return dead;
}
```

Routes: `POST /api/push/subscribe` (store subscription for `auth.uid()`),
`POST /api/notify` (server event → insert `notifications` rows, **count that
user's unread rows**, then `sendPush` with `unreadCount` in the payload; delete
returned dead endpoints). The count powers the app-icon badge below.

### 🔴 Dispatch AFTER the response — never in the user's request

Awaiting the fan-out inside an action/route made one status click take **26
seconds** in production. Two rules ([nextjs-gotchas] #5):

```ts
import { after } from 'next/server';
// in the action/route: respond first, dispatch after
after(() => dispatchNotifications(eventPayload));
```

- Inside the dispatcher, fetch **all** target users' subscriptions in **one**
  query (`.in('user_id', userIds)`), then send in parallel with
  `Promise.allSettled` — never a query per user per loop (26s → 2.8s).

## In-app notifications (realtime bell)

- Insert a `notifications` row per event (`type`, `title`, `body`, `task_id`).
- Client subscribes to Realtime on `notifications` filtered to the user, shows an
  unread badge, and marks read on open.
- **Clicking a notification navigates to the relevant page immediately**, then
  marks read as best-effort:
  ```ts
  function targetFor(n) {
    if (role === 'admin') return n.type === 'reported' ? '/admin/approve' : '/admin/tasks';
    return '/member/board';
  }
  async function openNotif(n) {
    setOpen(false);
    router.push(targetFor(n));                 // navigate first
    if (!n.is_read) { try { await markRead(n.id); refresh(); } catch {} }
  }
  ```
- For urgent events, also show an in-app popup on login + on realtime arrival
  (a modal driven by unread `type = 'urgent'`), independent of OS push permission.

## App icon badge (Badging API) — the number on the home-screen icon

The badge number is **not** automatic with push — it must be set explicitly,
in **two** places:

1. **App open** — sync it wherever the bell's unread count changes
   (realtime arrival, mark-read, initial load):

   ```ts
   export function syncAppBadge(unread: number) {
     if (!('setAppBadge' in navigator)) return;          // feature-detect always
     if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
     else navigator.clearAppBadge().catch(() => {});
   }
   ```

2. **App closed** — the SW push handler sets it from `unreadCount` in the
   payload (already wired above). This is the path that matters on iOS.

Platform limits (state these in the product, don't fight them):

- Badges appear only on an **installed** PWA (home screen / installed app) —
  never in a plain browser tab. Pairs with the install prompt above.
- **iOS 16.4+** supports web push + badge for home-screen PWAs; the badge must
  come from the SW handler (place #2).
- **Android** shows a notification dot rather than a Web-Badging number — the
  badge is a bonus surface, in-app + push remain the primary channels.
- `setAppBadge(count)` is distinct from the `badge` option of
  `showNotification()` (a monochrome Android status-bar glyph — use a
  dedicated white-on-transparent `badge-96.png`, not the color app icon).

## Triggers (typical)

assigned → notify assignee · reported → notify admins · approved / sent-back →
notify the member. Fire both the in-app insert and the web push in the same route.

## Checklist

- [ ] `/sw.js` served with `no-cache` + `Service-Worker-Allowed: /`.
- [ ] Manifest + icons (192/512/maskable) + monochrome `badge-96.png`; install prompt wired.
- [ ] VAPID keys generated once into `.env.local` (never overwritten), private key
      server-only, same pair set in Vercel env.
- [ ] `push_subscriptions.endpoint` unique; dead endpoints pruned after send.
- [ ] Notification click navigates immediately, marks read best-effort.
- [ ] Urgent events get an in-app popup, not just OS push.
- [ ] App-icon badge synced in-app (`syncAppBadge`) **and** from the SW push
      handler via `unreadCount`; cleared when everything is read.
- [ ] Badge tested with the app fully closed on an installed PWA (incl. iOS).
- [ ] Push dispatch runs via `after()`, one subscriptions query, `Promise.allSettled`.
```
