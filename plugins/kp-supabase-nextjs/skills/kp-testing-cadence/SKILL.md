---
name: kp-testing-cadence
description: >
  When to run which check during development — a tiered, risk-based testing
  cadence for Next.js + Supabase work verified through Chrome DevTools MCP. Use
  when deciding whether to run E2E now or keep coding, at feature/phase gates,
  or after touching auth/session/cookies/middleware, RLS-visible behavior,
  realtime, PWA/service worker, PDF rendering, or responsive/nav. Prevents both
  under-testing (shipping browser-only bugs a green build can't catch) and
  over-testing (burning tokens/time on flaky E2E every few edits). Triggers on:
  E2E cadence, when to run E2E, Chrome MCP review, testing frequency, feature
  gate, smoke test, regression sweep, verify in browser.
metadata:
  type: reference
  stack: nextjs, supabase, chrome-devtools-mcp, testing
---

# Testing cadence (tiered, risk-based)

Match the check to its cost and to what it can catch. Cheap checks run often;
expensive E2E runs at boundaries **plus** whenever you touch something that only
fails in a real browser. Do **not** run E2E on a fixed "every N units" schedule —
it's too slow and flaky for that.

## The tiers

| Tier | Run when | Catches | Cost |
|------|----------|---------|------|
| `tsc --noEmit` | every edit | type errors | cheap — run freely |
| **build + unit** | every ~2–3 units / checkpoint | compile + logic regressions | cheap — this is the frequent gate |
| **E2E (Chrome MCP)** | feature / phase gate | multi-role, responsive, critical pages | expensive + flaky — run at boundaries |

The "every 2–3 units" frequency belongs to **build + unit**, not E2E. Let those
catch regressions first; only then is an E2E run worth it.

## Browser-only triggers — run an E2E smoke *immediately* (don't wait for the gate)

A green `tsc` and `next build` cannot catch these. After touching any of them, run
a short targeted E2E right away:

- **auth / session / cookies / middleware / redirects** — e.g. a server-side
  sign-in route or a middleware matcher change (a green build still 307'd the
  login POST to `/login` and set no cookie until verified in-browser).
- **RLS-visible behavior** — what each role can see/do.
- **realtime / web push / service worker (PWA)**.
- **PDF rendering** — especially Thai (last-glyph clipping shows only when rendered).
- **responsive / nav** — desktop sidebar ↔ mobile bottom nav, breakpoints.

## Smoke vs sweep

- **Mid-feature = smoke**: only the flow you just touched. Assert with
  `evaluate_script` / DOM reads (and byte/page checks for PDFs) — **not**
  screenshot-only, which is the flaky part.
- **Gate = sweep**: every role, responsive breakpoints (320/375/768/1024/1440),
  and the critical pages.

## Keep Chrome MCP deterministic

- Close leftover download/blob tabs before measuring — stale tabs corrupt
  screenshots and page-count checks.
- Prefer `evaluate_script` assertions over eyeballing screenshots.
- If the profile locks up, kill stray Chrome processes and retry, rather than
  looping on the same flaky call.

## One-line rule

**Build + unit every 2–3 units; E2E at feature/phase gates *and* right after any
browser-only change.** Related: **[nextjs-supabase-ssr-auth]** (the cookie/
middleware class of browser-only bugs), **[react-pdf-thai]**.
