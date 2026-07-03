# KP Supabase + Next.js — Claude Code Plugin

A Claude Code **plugin marketplace** containing `kp-supabase-nextjs`: a reusable
kit for the recurring stack — **Next.js (App Router) + Supabase + TypeScript +
Tailwind**, a Thai-friendly PWA SaaS. Extracted from production code so the
patterns (and the bugs already paid for) come along for free.

> This repo is both the marketplace (`.claude-plugin/marketplace.json`) and the
> plugin (`plugins/kp-supabase-nextjs/`).

## Install

```bash
claude plugin marketplace add kpcrmv4/kp-supabase-nextjs
claude plugin install kp-supabase-nextjs@kp-marketplace
```

Restart the session (or `/plugin`) so skills, commands, and the MCP load.

## What's inside

### Skills (auto-load by task description)

| Skill | Covers |
|-------|--------|
| `nextjs-supabase-ssr-auth` | @supabase/ssr four clients, middleware gate, PIN/role login, and two cookie bugs: API→`/login` redirect, and route-handler sign-in cookies that must bind to the response |
| `supabase-rls-schema` | RLS, `is_admin()` SECURITY DEFINER, column-guard triggers, file + MCP migration workflow, react-query/realtime |
| `react-pdf-thai` | Thai last-glyph clipping fix (`registerHyphenationCallback((w)=>[w])` + trailing-space + Sarabun), WebP-embed gotcha; ships copy-ready `thai.ts` |
| `nextjs-pwa-webpush` | hand-rolled service worker, VAPID web push, in-app notification bell |
| `thai-saas-ui-kit` | Tailwind tokens, sidebar ↔ bottom-nav shell, status/urgent badges, sonner/radix/lucide conventions |

### Commands

- `/new-kp-app [description]` — scaffold a new project: asks a short requirements
  round, writes `CLAUDE.md` as the plan, then builds with the kit.
- `/setup-supabase-mcp` — bind the current repo to its own Supabase project MCP
  (verify target first, PAT-based, read-only by default).

### MCP server

A `supabase` MCP defined with **env placeholders only** — no secrets, no
hardcoded project ref:

```jsonc
"args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only",
         "--project-ref=${SUPABASE_PROJECT_REF}"],
"env":  { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" }
```

Supply `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` **per project** (env or a
project-scoped `.mcp.json`). Read-only by default so it can't apply to the wrong
project by accident.

## Per-project Supabase setup

1. Set `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` for the repo (never commit).
2. Run `/setup-supabase-mcp`; confirm `get_project_url` matches the repo's `.env`.
3. Keep the MCP read-only until you explicitly need to apply a migration.

## Notes

- **No secrets in this repo** — the MCP uses env placeholders, so it's safe to
  share or make public.
- Full plugin docs: [`plugins/kp-supabase-nextjs/README.md`](plugins/kp-supabase-nextjs/README.md).

## License

[MIT](LICENSE) © KP (kpcrmv4)
