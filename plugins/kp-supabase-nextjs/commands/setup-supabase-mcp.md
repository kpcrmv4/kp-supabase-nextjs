---
description: Bind the current repo to its own Supabase project MCP (verify target first, PAT-based, read-only by default)
---

# Set up the Supabase MCP for THIS repo

The bundled `supabase` MCP server reads two env vars so it never hardcodes a
project or token:

- `SUPABASE_PROJECT_REF` — the project ref for **this** repo (differs per project)
- `SUPABASE_ACCESS_TOKEN` — a personal access token (Supabase Dashboard → Account → Access Tokens)

Do the following, carefully:

1. **Verify the target before anything.** Confirm the correct project ref for the
   current repo — read it from the repo's `.env`/`.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` → the `<ref>.supabase.co` subdomain) or ask the
   user. NEVER assume or reuse a ref from another project. Applying to the wrong
   project is the #1 recurring mistake.

2. **Provide the env vars** for this repo (pick one, do not commit secrets):
   - Shell/session env, or
   - The repo's own gitignored `.env.local`, or
   - A project-scoped MCP entry:
     ```
     claude mcp add --scope project --transport stdio supabase \
       -- npx -y @supabase/mcp-server-supabase@latest \
          --read-only --project-ref=<REF> --access-token=<PAT>
     ```

3. **Stay read-only until a write is explicitly requested.** The server ships with
   `--read-only`. To apply a migration, the user must explicitly opt into write
   mode for this project; then re-confirm the ref with `get_project_url` first.

4. **After connecting**, sanity-check with `get_project_url` and `list_tables`,
   and confirm the URL matches the repo's `.env`. Only then run migrations.

Related skills: **supabase-rls-schema** (migration workflow, RLS) and
**nextjs-supabase-ssr-auth** (the app-side clients).
