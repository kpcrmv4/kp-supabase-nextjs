---
description: Bind the current repo to its Supabase project MCP — asks OAuth vs PAT first, verifies the target, read-only by default
---

# Set up the Supabase MCP for THIS repo

Do the following, carefully:

0. **Ask the connection method FIRST — do not assume.** Use one
   `AskUserQuestion`: connect the Supabase MCP via **OAuth** or via a **PAT**
   (personal access token)?
   - **PAT (recommended default)** — project-scoped (`--project-ref`) and
     `--read-only`; works headless/CI. Cost: the PAT is an account-wide secret
     stored in env.
   - **OAuth** — no token on disk, one login for all repos. Cost: sees **every**
     project in the account (raises the wrong-project risk) and needs an
     interactive login, so it can't run headless.

   **Record the choice in the repo's `CLAUDE.md`** (a short "Supabase
   connection" section) so future sessions follow it instead of re-deciding.
   If `CLAUDE.md` already records a choice, follow it and skip the question.

1. **Verify the target before anything.** Confirm the correct project ref for the
   current repo — read it from the repo's `.env`/`.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` → the `<ref>.supabase.co` subdomain) or ask the
   user. NEVER assume or reuse a ref from another project. Applying to the wrong
   project is the #1 recurring mistake — and under OAuth (which sees all
   projects) this check is the only guardrail.

2. **Connect per the chosen method:**
   - **OAuth**: add/enable the Supabase MCP via its OAuth flow (e.g. the
     claude.ai Supabase connector or `claude mcp add` with OAuth). Nothing is
     written to the repo.
   - **PAT**: provide the env vars for this repo (pick one, never commit
     secrets) — `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`
     (Supabase Dashboard → Account → Access Tokens) via shell/session env, the
     repo's gitignored `.env.local`, or a project-scoped MCP entry:
     ```
     claude mcp add --scope project --transport stdio supabase \
       -- npx -y @supabase/mcp-server-supabase@latest \
          --read-only --project-ref=<REF> --access-token=<PAT>
     ```

3. **Stay read-only until a write is explicitly requested.** The bundled server
   ships with `--read-only`. To apply a migration, the user must explicitly opt
   into write mode for this project; then re-confirm the ref with
   `get_project_url` first.

4. **After connecting**, sanity-check with `get_project_url` and `list_tables`,
   and confirm the URL matches the repo's `.env` (and that the project region
   matches `vercel.json` — the kit defaults both to Singapore). Only then run
   migrations.

Related skills: **supabase-rls-schema** (migration workflow, RLS, pg_cron) and
**nextjs-supabase-ssr-auth** (the app-side clients).
