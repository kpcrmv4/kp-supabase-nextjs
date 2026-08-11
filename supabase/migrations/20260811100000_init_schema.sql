-- KP ราคารับซื้อของเก่า — initial schema
-- Tables + RLS + SECURITY DEFINER RPCs. Customer side reads ONLY through RPCs
-- (anon has zero table grants); admin writes go through RLS policies.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.price_list_status as enum ('draft','scheduled','published','archived');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin','staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;
revoke execute on function public.is_admin() from public, anon;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Every new account starts as 'staff'; admin is promoted server-side only.
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- customer_groups
create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  password_hash text,
  password_version integer not null default 1,
  is_active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- products
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  unit text not null default 'กก.',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_id_idx on public.products(category_id);

create table if not exists public.product_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  min_qty numeric(12,2) not null default 0,
  max_qty numeric(12,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_tiers_product_id_idx on public.product_tiers(product_id);

-- -------------------------------------------------------------- price lists
create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.customer_groups(id) on delete cascade,
  status public.price_list_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists price_lists_group_status_idx
  on public.price_lists(group_id, status, published_at desc);
create index if not exists price_lists_created_by_idx on public.price_lists(created_by);

create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  tier_id uuid references public.product_tiers(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  unique nulls not distinct (price_list_id, product_id, tier_id)
);
create index if not exists price_list_items_product_idx
  on public.price_list_items(product_id, tier_id);
create index if not exists price_list_items_tier_idx on public.price_list_items(tier_id);

-- ------------------------------------------------- rate-limit attempt log
create table if not exists public.group_access_attempts (
  id bigint generated always as identity primary key,
  slug text not null,
  client_key text not null default '',
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists group_access_attempts_slug_idx
  on public.group_access_attempts(slug, created_at);
create index if not exists group_access_attempts_key_idx
  on public.group_access_attempts(client_key, created_at);

-- ------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','customer_groups','product_categories','products','price_lists']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------ RLS
alter table public.profiles enable row level security;
alter table public.customer_groups enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_tiers enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
alter table public.group_access_attempts enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- admin-only CRUD on domain tables — one policy per action, never `for all`
do $$
declare t text;
begin
  foreach t in array array['customer_groups','product_categories','products',
                           'product_tiers','price_lists','price_list_items']
  loop
    execute format('drop policy if exists %I_admin_select on public.%I', t, t);
    execute format('create policy %I_admin_select on public.%I
      for select to authenticated using ((select public.is_admin()))', t, t);
    execute format('drop policy if exists %I_admin_insert on public.%I', t, t);
    execute format('create policy %I_admin_insert on public.%I
      for insert to authenticated with check ((select public.is_admin()))', t, t);
    execute format('drop policy if exists %I_admin_update on public.%I', t, t);
    execute format('create policy %I_admin_update on public.%I
      for update to authenticated using ((select public.is_admin()))
      with check ((select public.is_admin()))', t, t);
    execute format('drop policy if exists %I_admin_delete on public.%I', t, t);
    execute format('create policy %I_admin_delete on public.%I
      for delete to authenticated using ((select public.is_admin()))', t, t);
  end loop;
end $$;

drop policy if exists group_access_attempts_admin_select on public.group_access_attempts;
create policy group_access_attempts_admin_select on public.group_access_attempts
  for select to authenticated using ((select public.is_admin()));

-- =====================================================================
-- RPCs — admin side (authenticated only)
-- =====================================================================

-- Set/reset a group's viewing password. Bumping password_version invalidates
-- every customer session cookie issued for the old password.
create or replace function public.admin_set_group_password(p_group_id uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if length(coalesce(p_password, '')) < 4 then raise exception 'password_too_short'; end if;
  update public.customer_groups
     set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')),
         password_version = password_version + 1,
         updated_at = now()
   where id = p_group_id;
  if not found then raise exception 'group_not_found'; end if;
end $$;
revoke execute on function public.admin_set_group_password(uuid, text) from public, anon;
grant execute on function public.admin_set_group_password(uuid, text) to authenticated;

-- One transactional save for the pricing editor. p_action: draft|publish|schedule.
-- p_list_id updates an existing draft/scheduled list in place (draft workflow).
create or replace function public.save_price_list(
  p_group_id uuid, p_items jsonb, p_action text,
  p_publish_at timestamptz default null, p_note text default '',
  p_list_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_list_id uuid;
  v_status public.price_list_status;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_action not in ('draft','publish','schedule') then raise exception 'bad_action'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items';
  end if;
  if p_action = 'schedule' and (p_publish_at is null or p_publish_at <= now()) then
    raise exception 'bad_publish_at';
  end if;

  v_status := case p_action when 'publish' then 'published'
                            when 'schedule' then 'scheduled'
                            else 'draft' end::public.price_list_status;

  if p_list_id is not null then
    update public.price_lists
       set status = v_status,
           publish_at = case when p_action = 'schedule' then p_publish_at else null end,
           published_at = case when p_action = 'publish' then now() else null end,
           note = p_note, updated_at = now()
     where id = p_list_id and group_id = p_group_id
       and status in ('draft','scheduled')
     returning id into v_list_id;
    if v_list_id is null then raise exception 'list_not_editable'; end if;
    delete from public.price_list_items where price_list_id = v_list_id;
  else
    insert into public.price_lists (group_id, status, publish_at, published_at, note, created_by)
    values (p_group_id, v_status,
            case when p_action = 'schedule' then p_publish_at end,
            case when p_action = 'publish' then now() end,
            p_note, auth.uid())
    returning id into v_list_id;
  end if;

  insert into public.price_list_items (price_list_id, product_id, tier_id, price)
  select v_list_id, (x->>'product_id')::uuid, (x->>'tier_id')::uuid, (x->>'price')::numeric
  from jsonb_array_elements(p_items) x;
  get diagnostics v_count = row_count;

  return jsonb_build_object('ok', true, 'list_id', v_list_id, 'items', v_count);
end $$;
revoke execute on function public.save_price_list(uuid, jsonb, text, timestamptz, text, uuid) from public, anon;
grant execute on function public.save_price_list(uuid, jsonb, text, timestamptz, text, uuid) to authenticated;

-- Current price per (product, tier) for the pricing editor prefill.
create or replace function public.admin_current_prices(p_group_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', l.product_id, 'tier_id', l.tier_id,
           'price', l.price, 'prev_price', l.prev_price)), '[]'::jsonb)
  from (
    select i.product_id, i.tier_id, i.price,
           row_number() over (partition by i.product_id, i.tier_id order by pl.published_at desc) rn,
           lead(i.price) over (partition by i.product_id, i.tier_id order by pl.published_at desc) prev_price
    from public.price_list_items i
    join public.price_lists pl on pl.id = i.price_list_id
    where pl.group_id = p_group_id and pl.status = 'published'
  ) l
  where l.rn = 1 and public.is_admin();
$$;
revoke execute on function public.admin_current_prices(uuid) from public, anon;
grant execute on function public.admin_current_prices(uuid) to authenticated;

-- =====================================================================
-- RPCs — customer side (anon). Errors are returned as {ok:false} instead of
-- raised so the attempt log survives the transaction.
-- =====================================================================

create or replace function public.verify_group_password(
  p_slug text, p_password text, p_client_key text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_group public.customer_groups%rowtype;
  v_fails integer;
begin
  select count(*) into v_fails
  from public.group_access_attempts
  where created_at > now() - interval '15 minutes' and success = false
    and (slug = p_slug or (p_client_key <> '' and client_key = p_client_key));
  if v_fails >= 8 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into v_group
  from public.customer_groups
  where slug = p_slug and is_active;

  if found and v_group.password_hash is not null
     and v_group.password_hash = extensions.crypt(p_password, v_group.password_hash) then
    insert into public.group_access_attempts (slug, client_key, success)
    values (p_slug, coalesce(p_client_key,''), true);
    return jsonb_build_object('ok', true, 'group_id', v_group.id,
                              'name', v_group.name,
                              'password_version', v_group.password_version);
  end if;

  insert into public.group_access_attempts (slug, client_key, success)
  values (p_slug, coalesce(p_client_key,''), false);
  return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
end $$;
revoke execute on function public.verify_group_password(text, text, text) from public;
grant execute on function public.verify_group_password(text, text, text) to anon, authenticated;

-- Whole customer board in one call. Re-validates group + password_version on
-- EVERY request — changing the password or deactivating the group cuts access
-- immediately even for holders of a signed cookie.
create or replace function public.get_group_overview(p_group_id uuid, p_password_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_group record;
  v_items jsonb;
  v_published_at timestamptz;
begin
  select id, name, is_active, password_version into v_group
  from public.customer_groups where id = p_group_id;
  if not found or not v_group.is_active or v_group.password_version <> p_password_version then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select max(published_at) into v_published_at
  from public.price_lists where group_id = p_group_id and status = 'published';

  select jsonb_agg(jsonb_build_object(
           'product_id', p.id, 'product_name', p.name, 'unit', p.unit,
           'category_name', coalesce(c.name, 'อื่นๆ'),
           'category_sort', coalesce(c.sort_order, 999999),
           'tier_id', l.tier_id, 'tier_label', t.label,
           'price', l.price, 'prev_price', l.prev_price,
           'published_at', l.published_at)
         order by coalesce(c.sort_order, 999999), coalesce(c.name, 'อื่นๆ'),
                  p.name, coalesce(t.min_qty, -1), coalesce(t.sort_order, 0))
    into v_items
  from (
    select i.product_id, i.tier_id, i.price, pl.published_at,
           row_number() over (partition by i.product_id, i.tier_id order by pl.published_at desc) rn,
           lead(i.price) over (partition by i.product_id, i.tier_id order by pl.published_at desc) prev_price
    from public.price_list_items i
    join public.price_lists pl on pl.id = i.price_list_id
    where pl.group_id = p_group_id and pl.status = 'published'
  ) l
  join public.products p on p.id = l.product_id and p.is_active
  left join public.product_categories c on c.id = p.category_id
  left join public.product_tiers t on t.id = l.tier_id
  where l.rn = 1;

  return jsonb_build_object('ok', true, 'group_name', v_group.name,
                            'published_at', v_published_at,
                            'items', coalesce(v_items, '[]'::jsonb));
end $$;
revoke execute on function public.get_group_overview(uuid, integer) from public;
grant execute on function public.get_group_overview(uuid, integer) to anon, authenticated;

-- Last 30 published prices for one product/tier (sparkline detail).
create or replace function public.get_price_history(
  p_group_id uuid, p_password_version integer, p_product_id uuid, p_tier_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ok boolean;
  v_points jsonb;
begin
  select true into v_ok from public.customer_groups
  where id = p_group_id and is_active and password_version = p_password_version;
  if v_ok is not true then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select jsonb_agg(jsonb_build_object('published_at', x.published_at, 'price', x.price)
                   order by x.published_at)
    into v_points
  from (
    select pl.published_at, i.price
    from public.price_list_items i
    join public.price_lists pl on pl.id = i.price_list_id
    where pl.group_id = p_group_id and pl.status = 'published'
      and i.product_id = p_product_id and i.tier_id is not distinct from p_tier_id
    order by pl.published_at desc
    limit 30
  ) x;

  return jsonb_build_object('ok', true, 'points', coalesce(v_points, '[]'::jsonb));
end $$;
revoke execute on function public.get_price_history(uuid, integer, uuid, uuid) from public;
grant execute on function public.get_price_history(uuid, integer, uuid, uuid) to anon, authenticated;

-- =====================================================================
-- Scheduled publisher — called by pg_cron only (no client grants at all)
-- =====================================================================
create or replace function public.publish_due_price_lists()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.price_lists
     set status = 'published', published_at = now(), updated_at = now()
   where status = 'scheduled' and publish_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.publish_due_price_lists() from public, anon, authenticated;
