# KP Supabase + Next.js SaaS Kit

Reusable Claude Code plugin for the recurring stack: **Next.js (App Router) +
Supabase + TypeScript + Tailwind**, extracted from production code. Skills
auto-load by task description; ships a safe, env-parameterized Supabase MCP.

## What's inside

### Skills (auto-loaded when relevant)

| Skill | Covers |
|-------|--------|
| `nextjs-supabase-ssr-auth` | @supabase/ssr four clients, proxy/middleware gate (`getClaims()`), rate-limited PIN login, new publishable/secret keys, and the two cookie bugs (API→/login redirect; route-handler sign-in cookie must bind to the response) |
| `supabase-rls-schema` | RLS, `is_admin()` SECURITY DEFINER, column-guard triggers, file+MCP migration workflow, realtime broadcast-from-database, pg_cron + pg_net scheduled jobs |
| `supabase-large-data` | the silent 1,000-row PostgREST cap — `.range()` discipline, page/infinite/keyset pagination, DB-side filters, RPC aggregates, virtualization, chunked exports |
| `nextjs-gotchas` | silent failures: allowedDevOrigins hydration death, Tailwind JIT vs new folders, loading.tsx breaking notFound() 404, revalidatePath layout purge, after() fan-out, NEXT_PUBLIC baked at start, Vercel-runs-UTC date drift (explicit Asia/Bangkok everywhere) |
| `kp-e2e-playwright-real-db` | Playwright against the real DB — per-role storageState (auth rate limits), org-scoped assertions, serial shared data, "did not run" reading, warm-up, hydration-signal clicks |
| `react-pdf-thai` | Thai last-glyph clipping fix (`registerHyphenationCallback((w)=>[w])` + trailing-space + Sarabun), WebP-embed gotcha; includes copy-ready `thai.ts` |
| `nextjs-pwa-webpush` | hand-rolled service worker, VAPID web push (keys generated into `.env`), in-app notification bell, app-icon badge (Badging API) |
| `thai-saas-ui-kit` | Tailwind v4 CSS-variable tokens with light+dark themes (next-themes), sidebar↔bottom-nav shell, status/urgent badges, sonner/radix/lucide conventions |
| `kp-testing-cadence` | when to run which check — `tsc` every edit, build (+pure-logic unit; never mock Supabase) every ~2–3 units, E2E (Chrome MCP) at gates + after browser-only changes |
| `kp-acceptance-test-matrix` | what a spec must assert — surface inventory (every route/button/option/endpoint/role), one row each measured at UI/UX/API/DB, negative + RLS + transition rows, traceability IDs, coverage gate; ships `TEST-PLAN-template.md` |

Cross-references the standalone `vercel-react-best-practices` and
`supabase-postgres-best-practices` skills.

### Commands

- `/new-kp-app [description]` — scaffold a new KP-style Next.js + Supabase SaaS
  (Thai PWA): asks a short requirements round (incl. Supabase OAuth-vs-PAT),
  writes `CLAUDE.md` as the plan, generates VAPID/pepper/cron secrets into
  `.env.local`, sets `vercel.json` to `sin1`, then builds using the kit's
  skills and conventions.
- `/setup-supabase-mcp` — bind the current repo to its own Supabase project MCP
  (asks OAuth vs PAT first, verifies target, read-only by default).

### MCP server

A `supabase` MCP server defined with **env placeholders only** — no secrets, no
hardcoded project ref:

```jsonc
"args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only",
         "--project-ref=${SUPABASE_PROJECT_REF}"],
"env":  { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" }
```

You supply `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` **per project** (env or
a project-scoped `.mcp.json`). Read-only by default so it can't apply to the wrong
project by accident. See `/setup-supabase-mcp`.

## Install

```
claude plugin marketplace add kpcrmv4/kp-supabase-nextjs
claude plugin install kp-supabase-nextjs@kp-marketplace
```

(For a local checkout: `claude plugin marketplace add <path-to-this-repo>`.)

Restart the session (or `/plugin`) so the skills, command, and MCP load.

## Per-project setup

1. Set `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` for the repo (never commit).
2. Run `/setup-supabase-mcp` and confirm `get_project_url` matches the repo's `.env`.
3. Keep the MCP read-only until you explicitly need to apply a migration.

## Notes

- **No secrets in the plugin**: safe to share — the MCP uses env placeholders.
