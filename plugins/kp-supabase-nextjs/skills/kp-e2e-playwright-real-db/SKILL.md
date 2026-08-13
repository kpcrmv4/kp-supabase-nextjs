---
name: kp-e2e-playwright-real-db
description: >
  Playwright E2E against a REAL Supabase database (separate org per test run) —
  the mechanics that make it reliable. Use when writing or debugging Playwright
  specs for a Next.js + Supabase app: per-role storageState (Supabase Auth rate
  limits), truly-unauthenticated contexts, org-scoped assertions with the
  service-role client, serial execution for shared mutable data, reading
  "did not run" correctly, dev-server warm-up, hydration-signal clicking, and
  Chrome/Chrome-MCP quirks. Triggers on: playwright, storageState,
  global-setup, rate limit reached, flaky E2E, did not run, hydration click,
  data-hydrated, test against real database, workers 1, 127.0.0.1.
metadata:
  type: reference
  stack: playwright, nextjs, supabase
---

# Playwright E2E on a real database

Companion to **[kp-testing-cadence]** (which decides *when* to run E2E) and
**[kp-acceptance-test-matrix]** (*what* each row must assert at UI/UX/API/DB) —
this skill is *how*. Test against the real Supabase project through a **separate
org** — RLS already isolates tenants, and real-RLS confidence beats mocks.

## Auth: log in once per role, never per test

Per-test `signInWithPassword` hits Supabase Auth's rate limit — specs fail
randomly with `Request rate limit reached` and poison unrelated tests.

```ts
// global-setup.ts — one login per role, persisted
await context.storageState({ path: authFile(role) });

// spec
test.use({ storageState: authFile('staff') });
```

DB-level tests cache clients the same way: memoize one client promise per role
at module level.

## Unauthenticated tests must CLEAR state explicitly

`browser.newContext()` inherits the config's `storageState` — your "not logged
in" test is silently logged in, and a missing 401 check slips through:

```ts
test.describe('anonymous access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });   // really empty
  // ...
});
```

## Service-role assertions must filter by org

The admin client sees **every** tenant. Counts/lookups without `.eq('org_id',
TEST_ORG)` start failing the day demo data is added — with nothing wrong in the
app. Scope every assertion query to the test org.

## Shared mutable data ⇒ serial

Stock levels, asset statuses, one user's notifications are shared resources.
Tests that mutate them must not run in parallel: `workers: 1`, or a separate
Playwright project with `dependencies` so it runs after (and alone).

## "did not run" is not "passed"

A failed project in `dependencies` skips everything depending on it.
`2 failed, 86 did not run, 52 passed` means **86 tests are unverified** — read
the "did not run" line before calling a run green.

## Dev-server compile & warm-up

Dev compiles routes on first hit — the first test of each page can time out
spuriously. Warm up all main routes in global setup and give
`expect.timeout` headroom (~20s on dev with heavy revalidates).

## Click only after hydration — never `waitForTimeout`

`toBeVisible` passes before React attaches handlers; clicks land on dead
buttons. Emit a real signal and wait for it:

```tsx
// client component
const [ready, setReady] = useState(false);
useEffect(() => setReady(true), []);
return <div data-testid="my-list" data-hydrated={ready}>...</div>;
```

```ts
await expect(page.getByTestId('my-list')).toHaveAttribute('data-hydrated', 'true');
await page.getByTestId('my-button').click();
```

## Triage rule: is the TEST wrong or the SYSTEM wrong?

A failing test is data, not an obstacle — the worst real bugs get caught by
tests, not by reading code. Before "fixing" a failing spec, verify actual
state first (query the DB, look at the screenshot). Only then decide which
side is wrong.

## Small gotchas that burn hours

- `response.body()` of a page-initiated `fetch()` isn't always readable — use
  `page.request.post/get` to verify downloads/files separately.
- `selectOption({ label: ... })` takes the **full string**, not a regex.
- Ambiguous selectors: `getByRole('link', { name: /แคตตาล็อก/ })` can match
  another card mentioning the word — anchor with `^` or scope via the
  container's testid.
- Verify PDFs by content, not size: `body.subarray(0,4).toString() === '%PDF'`
  and `body.toString('latin1').includes('Sarabun')` proves the Thai font is
  really embedded ([react-pdf-thai]).
- Chrome MCP: some machines can't open `localhost` — use
  `http://127.0.0.1:3000` (and add both to `allowedDevOrigins`, see
  [nextjs-gotchas]). A stale Chrome on the same profile blocks launching
  (`browser is already running`) — kill it first. And **never open a new
  instance per test round while old ones live** — they stack by the dozen
  and freeze the machine; kill once at run start, then reuse the single
  instance ([kp-testing-cadence]).

## Checklist

- [ ] One login per role via `storageState`; DB clients memoized per role.
- [ ] Anonymous specs explicitly clear `storageState`.
- [ ] Every service-role assertion filters `org_id`.
- [ ] Mutating specs run serial (workers/project dependencies).
- [ ] Reports checked for "did not run" before declaring green.
- [ ] Warm-up in global setup; hydration waited via `data-hydrated`, not sleeps.
- [ ] Failing spec triaged against real DB/screenshot before editing the test.
