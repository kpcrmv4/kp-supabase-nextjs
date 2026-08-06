---
name: supabase-rls-schema
description: >
  Multi-tenant / role-based Postgres schema, Row-Level Security, and the
  file+MCP migration workflow for Supabase projects. Use when designing tables
  with RLS, writing SECURITY DEFINER helpers, guarding column-level updates with
  triggers, avoiding RLS recursion, private Storage bucket policies, or applying
  migrations via the Supabase MCP. Also covers @tanstack/react-query + Realtime
  broadcast-from-database wiring, and scheduled jobs with pg_cron + pg_net
  (instead of Vercel Hobby cron). Triggers on: RLS policy, auth.uid(),
  is_admin(), security definer, guard trigger, apply_migration, get_advisors,
  generate_typescript_types, storage policy, realtime subscription, broadcast,
  realtime.messages, pg_cron, pg_net, cron job.
metadata:
  type: reference
  stack: supabase, postgres, nextjs, react-query
---

# Supabase RLS + Schema + Migration Workflow

Standing companion to **supabase-postgres-best-practices** (indexing, query
plans) and **[nextjs-supabase-ssr-auth]** (the auth clients that set `auth.uid()`).
RLS is enabled on **every** table; the UI only hides what a role can't use — the
database enforces it.

## Migration workflow (MANDATORY — file AND applied)

Every schema change is both a checked-in file and an applied migration:

1. Write `supabase/migrations/<timestamp>_<name>.sql`. Make it **idempotent**
   where practical (`create table if not exists`, `do $$ ... exception when
   duplicate_object then null; end $$` for enums, `create policy` guarded by a
   drop or a catalog check).
2. Apply via the **project-scoped Supabase MCP** `apply_migration`. **Verify the
   target project first** with `get_project_url` — applying to the wrong project
   is a recurring, costly mistake. Prefer a PAT-based per-project MCP server over
   a shared OAuth one.
3. Run `get_advisors(security)` and `get_advisors(performance)` afterward; fix
   findings (unindexed FKs, permissive policies, `search_path` on functions).
4. Regenerate types with `generate_typescript_types` → `lib/database.types.ts`.

Idempotent enum + `updated_at` helper:

```sql
do $$ begin
  create type public.user_role as enum ('admin','member');
  exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
-- create trigger <t>_set_updated_at before update on public.<t>
--   for each row execute function public.set_updated_at();
```

## Avoid RLS recursion: the `is_admin()` SECURITY DEFINER helper

A policy on `profiles` that reads `profiles` to check the role recurses. Break it
with a `SECURITY DEFINER` function that runs as owner (bypasses RLS) and pin its
`search_path`:

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;
```

Use `public.is_admin()` inside policies instead of a subquery on the same table.

## Role bootstrap: never trust client-supplied role

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Every new account is 'member'/'janitor'. Admin is granted later by the
  -- service-role key (which runs with auth.uid() IS NULL), never from metadata.
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'member')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
```

## Column-level update guard (row RLS can't express "which columns")

RLS says *which rows*; a `BEFORE UPDATE` trigger says *which columns*. This lets a
member update only their own status/report fields while blocking reassignment or
self-approval — and lets admins and the service-role (`auth.uid() IS NULL`) pass:

```sql
create or replace function public.guard_task_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;   -- unrestricted
  if old.assignee_id is distinct from auth.uid() then
    raise exception 'not allowed to modify this task';
  end if;
  if new.assignee_id is distinct from old.assignee_id
     or new.priority is distinct from old.priority
     or new.approved_by is distinct from old.approved_by then
    raise exception 'member may not modify assignment/approval fields';
  end if;
  if new.approval = 'approved' then
    raise exception 'member may not approve';
  end if;
  return new;
end $$;

create trigger tasks_guard_update before update on public.tasks
  for each row execute function public.guard_task_update();
```

Apply the same idea to `profiles` (a self-editing member may not change `role`
or `is_active`).

## RLS policy patterns

```sql
alter table public.tasks enable row level security;

-- read for all authenticated (everyone sees the work)
create policy tasks_select on public.tasks
  for select to authenticated using (true);

-- admin full write
create policy tasks_admin_write on public.tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- member may update rows they own (column limits enforced by the trigger above)
create policy tasks_member_update on public.tasks
  for update to authenticated
  using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());

-- child table gated through the parent
create policy task_photos_write on public.task_photos
  for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid()));

-- per-user private rows (notifications, push subscriptions)
create policy notifications_own on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**Indexing** (per supabase-postgres-best-practices): index every FK plus columns
used in `where`/`order by` — e.g. `tasks(assignee_id)`, `tasks(status)`,
`tasks(assigned_date)`, `notifications(user_id, is_read)`.

## Private Storage bucket

Keep uploads in a **private** bucket; mirror table RLS in the bucket policies;
serve via **signed URLs**. Path convention: `tasks/{task_id}/{before|after}/{uuid}.ext`.
Store the `storage_path` in a `*_photos` table (a separate row per photo ⇒
unbounded photos per set).

## Client data layer — react-query + Realtime (Broadcast)

- Server state lives in `@tanstack/react-query`; never mirror it into a client
  store. Centralize query keys (`qk.tasks`, `qk.notifications(userId)`).
- Paginated lists: see **[supabase-large-data]** — invalidate key prefixes,
  never patch pages by hand.

Use **broadcast from database**, not `postgres_changes`. `postgres_changes`
re-checks RLS per change × per subscriber on a single-threaded pipeline — it
degrades as users/writes grow, and Supabase recommends broadcast for new apps.
Broadcast authorizes once at subscribe time via RLS on `realtime.messages`,
and topics map cleanly to this kit's two cases: a shared `tasks` board and a
per-user `user:{id}` notification feed.

Migration (trigger + topic policy — fits the file+MCP workflow above):

```sql
create or replace function public.tasks_broadcast()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.broadcast_changes(
    'tasks',                       -- topic
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, new, old);
  return null;
end $$;

create trigger tasks_broadcast
  after insert or update or delete on public.tasks
  for each row execute function public.tasks_broadcast();

create policy tasks_topic_read on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'tasks' and extension = 'broadcast');
```

Per-user feed: topic `'user:' || new.user_id` in the trigger, and the policy
checks `realtime.topic() = 'user:' || auth.uid()::text`.

Client — private channel, set auth first, payload is only a signal:

```ts
await supabase.realtime.setAuth();
const ch = supabase
  .channel('tasks', { config: { private: true } })
  .on('broadcast', { event: 'INSERT' }, invalidate)
  .on('broadcast', { event: 'UPDATE' }, invalidate)
  .on('broadcast', { event: 'DELETE' }, invalidate)
  .subscribe();
return () => { supabase.removeChannel(ch); };
// invalidate = () => queryClient.invalidateQueries({ queryKey: qk.tasks })
```

`postgres_changes` remains acceptable for a quick prototype only — do not
ship it in a product expected to grow.

## Scheduled jobs — pg_cron + pg_net (not Vercel cron)

Vercel's free (Hobby) tier allows **2 cron jobs, each once per day**, with
loose timing — useless for anything recurring. Default to **pg_cron** in the
database; it's SQL, so it lives in a migration like everything else:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- SQL-only jobs need no HTTP at all (cleanup, pruning, roll-ups):
select cron.schedule('prune-login-attempts', '0 */6 * * *',
  $$ delete from public.login_attempts where created_at < now() - interval '1 day' $$);

-- Jobs that must run app code call a protected route via pg_net:
select cron.schedule('notify-overdue-tasks', '*/15 * * * *', $$
  select net.http_post(
    url     := 'https://<app>.vercel.app/api/cron/overdue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || '<CRON_SECRET>'),
    body    := '{}'::jsonb);
  $$);
```

- `cron.schedule` with an existing job name **updates** it — idempotent, safe
  to re-run in migrations.
- 🔴 **pg_cron runs in UTC.** Thai time is UTC+7: 08:00 น. ไทย = `0 1 * * *`.
- Every `/api/cron/*` route must verify the `CRON_SECRET` bearer header
  (generated into `.env` at scaffold — see `/new-kp-app`) before doing work.
- Prefer pure-SQL jobs over HTTP whenever the work is data-only.
- Vercel cron is still fine for ≤ 2 once-a-day, timing-insensitive jobs.

## Checklist

- [ ] RLS enabled on every table; policies scoped `to authenticated`.
- [ ] `is_admin()` (and any role helper) is `SECURITY DEFINER` with `set search_path`.
- [ ] Column-level rules enforced by `BEFORE UPDATE` triggers, not by hope.
- [ ] Role assigned server-side only; `handle_new_user` ignores client metadata.
- [ ] Migration is a file **and** applied via MCP to the **verified** project.
- [ ] `get_advisors` run and clean; `database.types.ts` regenerated.
- [ ] FKs and filter columns indexed; Storage bucket private + signed URLs.
- [ ] Realtime uses broadcast-from-database (private channels + `realtime.messages` policies).
- [ ] Recurring jobs on pg_cron (UTC! Thai = UTC+7); `/api/cron/*` verifies `CRON_SECRET`.
- [ ] List queries paginated per [supabase-large-data] — nothing relies on the 1,000-row default.
```
