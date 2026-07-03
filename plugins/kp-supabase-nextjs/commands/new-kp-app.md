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
`react-pdf-thai`, `nextjs-pwa-webpush`, `thai-saas-ui-kit`, plus
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
  - **Language / deploy** — default Thai UI, Vercel free tier.
- Don't ask what you can infer; pick sensible defaults and state them.

## 2. Write CLAUDE.md as the source-of-truth plan (before coding)
Mirror the proven structure:
- Product summary; roles table (who sees / can do).
- Tech stack table (Next.js 15 App Router + React + TS, Tailwind v3, @supabase/ssr,
  @tanstack/react-query, lucide, sonner, radix dialog, @react-pdf/renderer,
  browser-image-compression, web-push).
- Design system tokens (palette, IBM Plex Sans Thai, status/urgent/category colors).
- Postgres data model (enums, tables, indexes) with RLS notes per table.
- **DB change workflow**: every change is a migration file AND applied via the
  Supabase MCP — **verify the target project FIRST**; regenerate types; run advisors.
- PDF Thai handling (whole-word hyphenation + trailing-space + Sarabun; no WebP in PDF).
- Image upload; notifications + web push; PWA; folder structure.
- Build phases checklist; conventions. Keep org/signatory names in `lib/constants.ts`.

Present the plan, then proceed to build all phases (unless the user wants to review
phase-by-phase).

## 3. Scaffold + build
- Bootstrap Next.js App Router + TS + Tailwind; install the stack above.
- Create the **four Supabase clients** (browser/server/admin/middleware) and the
  **middleware gate that excludes `/api/*`** from the login redirect.
- Any server-side sign-in route binds session cookies to the **response object**.
- RLS migration files: `is_admin()` SECURITY DEFINER, column-guard triggers,
  policies per table, indexes on FKs + filter columns; private Storage bucket.
- `.env` template with **BLANK** secret placeholders (user fills them).
- UI shell: desktop dark sidebar ↔ mobile bottom nav; role-aware landing.
- Apply the two cookie bugfixes and the Thai-PDF fix by default.

## 4. Supabase wiring (per project)
Tell the user to set `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` for this
repo, then run `/setup-supabase-mcp` and confirm `get_project_url` matches the
repo's `.env` BEFORE any migration. Keep the MCP read-only until a write is
explicitly requested.

## 5. Conventions (hard rules)
- Thai UI copy; **lucide icons never emoji**; **sonner toasts never `alert()`**;
  radix modals for confirm/ask.
- RLS on **every** table; role set server-side only (never trust client metadata).
- Small files (< 800 lines), immutable updates, explicit error handling, no
  `console.log` in prod.
- Get `tsc --noEmit` **and** `next build` **GREEN before any commit**. Conventional
  commits. **No attribution footer.**
- **Testing cadence** — follow the `kp-testing-cadence` skill: `tsc` every edit;
  build + unit every ~2–3 units; E2E (Chrome MCP) at feature/phase gates **and**
  immediately after any browser-only change (auth/cookie/middleware/redirect,
  RLS-visible, realtime, PWA/SW, PDF, responsive). Record this in `CLAUDE.md`.
- Never commit secrets; `.env.local` gitignored.

Start now: confirm the product summary, run the one requirements question, then
write `CLAUDE.md`.
