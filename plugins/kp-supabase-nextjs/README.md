# KP Supabase + Next.js SaaS Kit

Reusable Claude Code plugin for the recurring stack: **Next.js (App Router) +
Supabase + TypeScript + Tailwind**, extracted from production code. Skills
auto-load by task description; ships a safe, env-parameterized Supabase MCP.

## What's inside

### Skills (auto-loaded when relevant)

| Skill | Covers |
|-------|--------|
| `nextjs-supabase-ssr-auth` | @supabase/ssr four clients, middleware gate, PIN/role login, and the two cookie bugs (API→/login redirect; route-handler sign-in cookie must bind to the response) |
| `supabase-rls-schema` | RLS, `is_admin()` SECURITY DEFINER, column-guard triggers, file+MCP migration workflow, react-query/realtime |
| `react-pdf-thai` | Thai last-glyph clipping fix (`registerHyphenationCallback((w)=>[w])` + trailing-space + Sarabun), WebP-embed gotcha; includes copy-ready `thai.ts` |
| `nextjs-pwa-webpush` | hand-rolled service worker, VAPID web push, in-app notification bell |
| `thai-saas-ui-kit` | Tailwind tokens, sidebar↔bottom-nav shell, status/urgent badges, sonner/radix/lucide conventions |

Cross-references the standalone `vercel-react-best-practices` and
`supabase-postgres-best-practices` skills.

### Commands

- `/new-kp-app [description]` — scaffold a new KP-style Next.js + Supabase SaaS
  (Thai PWA): asks a short requirements round, writes `CLAUDE.md` as the plan,
  then builds using the kit's skills and conventions.
- `/setup-supabase-mcp` — bind the current repo to its own Supabase project MCP
  (verify target first, PAT-based, read-only by default).

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

## Install (local marketplace)

```
claude plugin marketplace add F:/claude-plugins/kp-marketplace
claude plugin install kp-supabase-nextjs@kp-marketplace
```

Restart the session (or `/plugin`) so the skills, command, and MCP load.

## Per-project setup

1. Set `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` for the repo (never commit).
2. Run `/setup-supabase-mcp` and confirm `get_project_url` matches the repo's `.env`.
3. Keep the MCP read-only until you explicitly need to apply a migration.

## Notes

- **Private**: a local marketplace is only on this machine. Nothing is published
  or searchable. Push to GitHub later only if you choose.
- **No secrets in the plugin**: safe to share — the MCP uses env placeholders.
