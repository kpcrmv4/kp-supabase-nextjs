---
description: Scaffold a new KP-style Next.js + Supabase SaaS (Thai PWA) — plans CLAUDE.md first, then builds
argument-hint: [short product description, optional]
---

You are starting a NEW project in the current working directory, using the
**KP Supabase + Next.js SaaS Kit** conventions. Follow this exactly; do not skip
the planning step.

## 0. Load the kit
As you work, pull these skills (they auto-load by topic — reference them
explicitly if needed): `nextjs-supabase-ssr-auth`, `supabase-rls-schema`,
`supabase-large-data`, `nextjs-gotchas`, `react-pdf-thai`, `nextjs-pwa-webpush`,
`thai-saas-ui-kit`, `kp-e2e-playwright-real-db`, plus
`vercel-react-best-practices` and `supabase-postgres-best-practices`.

## 1. Gather requirements (ONE short round)
- Product summary: if `$ARGUMENTS` is non-empty, use it as the summary; otherwise
  ask the user for it in one sentence.
- Then use **one AskUserQuestion round** (multiSelect where sensible) to confirm:
  - **Roles** — admin + one or more end-user roles; who sees/does what.
  - **Auth style** — PIN keypad, username/password, or both (default: both — PIN
    for staff, user/pass for admin).
  - **Features** (multiSelect) — Thai PDF reports, PWA + web push, in-app
    notifications, image upload (compress → WebP/JPEG), realtime board,
    per-person stats/dashboard.
  - **Supabase connection** — MCP via OAuth (no token on disk, account-wide
    scope) or PAT-based per-project MCP (project-scoped + read-only, token in
    env; default). Record the answer in `CLAUDE.md` — do NOT assume PAT.
- Don't ask what you can infer; pick sensible defaults and state them —
  defaults include: Thai UI, Vercel free (Hobby) tier with functions in
  `sin1`, Supabase project in Singapore (`ap-southeast-1`) so the DB sits next
  to the functions, dark mode included.

## 2. Write CLAUDE.md as the source-of-truth plan (before coding)
Mirror the proven structure:
- Product summary; roles table (who sees / can do).
- Tech stack table (Next.js 16 App Router + React + TS — `proxy.ts`, not
  `middleware.ts` — Tailwind v4 CSS-first, latest @supabase/ssr,
  @tanstack/react-query, next-themes, lucide, sonner, radix dialog,
  @react-pdf/renderer, browser-image-compression, web-push).
- Design system tokens (CSS variables, light + dark values, IBM Plex Sans Thai,
  status/urgent/category colors) per `thai-saas-ui-kit`.
- Postgres data model (enums, tables, indexes) with RLS notes per table.
- **Supabase connection choice** (OAuth or PAT, from step 1) so later sessions
  know how this repo talks to Supabase.
- **DB change workflow**: every change is a migration file AND applied via the
  Supabase MCP — **verify the target project FIRST**; regenerate types; run advisors.
- **Data-scale rules** (`supabase-large-data`): every list query `.order()` +
  `.range()`; dashboard numbers via head-count/RPC; exports chunked. The
  1,000-row PostgREST cap is a silent truncation — design for it now.
- Realtime = broadcast-from-database; scheduled work = pg_cron (UTC; Vercel
  Hobby cron is limited to 2 once-daily jobs — don't plan around it).
- PDF Thai handling (whole-word hyphenation + trailing-space + Sarabun; no WebP in PDF).
- Image upload; notifications (in-app bell + web push + app-icon badge); PWA;
  folder structure.
- Build phases checklist; conventions. Keep org/signatory names in `lib/constants.ts`.

Present the plan, then proceed to build all phases (unless the user wants to review
phase-by-phase).

## 3. Scaffold + build
- Bootstrap Next.js App Router + TS + Tailwind v4; install the stack above.
- Create the **four Supabase clients** (browser/server/admin/middleware) and the
  **`proxy.ts` gate that excludes `/api/*`** from the login redirect.
- Any server-side sign-in route binds session cookies to the **response object**;
  the PIN route is **rate-limited** from day one.
- RLS migration files: `is_admin()` SECURITY DEFINER, column-guard triggers,
  policies per table, indexes on FKs + filter columns; private Storage bucket;
  broadcast triggers + `realtime.messages` policies; pg_cron jobs as needed.
- `vercel.json` with `{ "regions": ["sin1"] }` — functions must sit in the same
  region as the Supabase project (Singapore).
- `next.config` with `allowedDevOrigins: ['localhost', '127.0.0.1', '*.localhost']`
  (Next 16 dev blocks cross-origin chunks → silent hydration death; `nextjs-gotchas`).
- `.env.local`: **generate** what is generatable — VAPID key pair
  (`npx web-push generate-vapid-keys --json`), `PIN_PEPPER`, `CRON_SECRET`
  (random 32 bytes each) — and leave the Supabase URL/keys as **BLANK**
  placeholders for the user. Never overwrite existing values (regenerated
  VAPID keys kill every push subscription). Remind the user to copy the same
  VAPID/pepper/cron values into Vercel env vars at deploy.
- UI shell: desktop dark sidebar ↔ mobile 5-slot bottom nav (raised center
  `primary` action; "เพิ่มเติม" bottom sheet when menus exceed 5); role-aware
  landing; light/dark tokens + next-themes toggle from the start.
- Apply the two cookie bugfixes and the Thai-PDF fix by default.

## 4. Supabase wiring (per project)
Follow the connection choice recorded in `CLAUDE.md` (step 1):
- **PAT**: user sets `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` for this
  repo, then run `/setup-supabase-mcp`.
- **OAuth**: connect the Supabase MCP via its OAuth flow; no token on disk.
Either way: confirm `get_project_url` matches the repo's `.env` BEFORE any
migration (OAuth sees **all** projects — this check is what prevents applying
to the wrong one), and keep the MCP read-only until a write is explicitly
requested.

## 5. Conventions (hard rules)
- Thai UI copy; **lucide icons never emoji**; **sonner toasts never `alert()`**;
  radix modals for confirm/ask.
- RLS on **every** table; role set server-side only (never trust client metadata).
- **Every list query `.order()` + `.range()`** — nothing may rely on the
  1,000-row default (`supabase-large-data`).
- **Every data view ships four states** — skeleton / error+retry / empty /
  success (`thai-saas-ui-kit`); pending buttons disabled with inline spinner.
- Small files (< 800 lines), immutable updates, no `console.log` in prod.
- **Destructure `error` from every Supabase call** — unchecked errors are
  silent no-ops (`nextjs-supabase-ssr-auth`).
- **Every API endpoint has a reachable UI** — an endpoint with no button is an
  endpoint nobody tests — and its allowed roles must **match** where the UI
  actually sits.
- **Log every trap into `CLAUDE.md` the moment it's found** — the second
  encounter must cost nothing.
- On Windows: never edit Thai-text files via PowerShell pipes (silent mojibake
  in PS 5.1) — use the agent's Edit/Write tools, or .NET
  `WriteAllText(..., UTF8Encoding(false))` if a script is unavoidable.
- Get `tsc --noEmit` **and** `next build` **GREEN before any commit**. Conventional
  commits. **No attribution footer.**
- **Testing cadence** — follow the `kp-testing-cadence` skill: `tsc` every edit;
  build + unit every ~2–3 units; E2E (Chrome MCP) at feature/phase gates **and**
  immediately after any browser-only change (auth/cookie/middleware/redirect,
  RLS-visible, realtime, PWA/SW, PDF, responsive). Record this in `CLAUDE.md`.
- Never commit secrets; `.env.local` gitignored.

Start now: confirm the product summary, run the one requirements question, then
write `CLAUDE.md`.
