---
name: supabase-large-data
description: >
  Pagination and large-dataset patterns for Supabase + Next.js. PostgREST
  silently caps every select() at 1,000 rows — no error, the data is just
  truncated — so any table that can grow past a few hundred rows needs these
  patterns from day one. Use when building list pages, infinite scroll,
  server-side search/filter, dashboard aggregates/counts, admin tables, or
  PDF/exports over long date ranges. Covers .range() + .order() discipline,
  page-based and useInfiniteQuery pagination, count strategies, keyset (cursor)
  pagination, pushing filters to the DB, RPC/view aggregates, list
  virtualization, and chunked exports. Triggers on: 1000 rows, max rows,
  pagination, range(), useInfiniteQuery, keyset, cursor pagination, count
  exact, aggregate, ข้อมูลไม่ครบ, virtualized list.
metadata:
  type: reference
  stack: supabase, nextjs, react-query
---

# Supabase beyond 1,000 rows

Companion to **[supabase-rls-schema]** (indexes, RLS) — this skill is about
**never fetching or rendering an unbounded set**. The database filters,
paginates, and aggregates; the client only ever holds one page.

## 🔴 The 1,000-row trap

PostgREST's default `max-rows` is **1,000**. A `select()` without `.range()`
returns at most 1,000 rows **silently** — no error, no warning. Apps "work" in
dev, then quietly show incomplete lists, wrong dashboard numbers, and truncated
reports once real data grows.

Rules that prevent it:

- **Every list query has `.order()` + `.range()`.** No exceptions — an
  unordered paginated query returns nondeterministic pages.
- Raising `max-rows` in the dashboard is **not** the fix — it just moves the
  cliff and slows every request. Paginate instead.
- Anything that must see "all rows" (counts, sums, exports) is done **in the
  database** (aggregate/RPC) or **in chunks**, never with one giant select.

## Page-based pagination (admin tables)

```ts
const PAGE = 50;
export async function fetchTasksPage(page: number, filters: Filters) {
  const from = page * PAGE, to = from + PAGE - 1;
  let q = supabase
    .from('tasks')
    .select('*', { count: 'exact' })         // count for the pager UI
    .order('assigned_date', { ascending: false })
    .order('id', { ascending: false })       // tie-breaker → stable pages
    .range(from, to);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.q) q = q.ilike('title', `%${filters.q}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: data, count: count ?? 0 };
}
```

- `count: 'exact'` is fine up to tens of thousands of rows; for very large
  tables use `'estimated'` (fast, close enough for a pager) or `'planned'`.
- Keep `page`, `filters` in the react-query key:
  `qk.tasks(page, filters)` — never refetch-all-and-slice on the client.

## Infinite scroll (`useInfiniteQuery`)

```ts
const PAGE = 30;
useInfiniteQuery({
  queryKey: qk.taskFeed(filters),
  queryFn: async ({ pageParam = 0 }) => {
    const { data, error } = await supabase
      .from('tasks').select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(pageParam, pageParam + PAGE - 1);
    if (error) throw error;
    return data;
  },
  getNextPageParam: (last, pages) =>
    last.length < PAGE ? undefined : pages.length * PAGE,
  initialPageParam: 0,
});
```

## Keyset (cursor) pagination — for tables in the tens of thousands+

Offset pagination degrades linearly (`offset 50000` scans 50k rows). Keyset
seeks by the last row's sort key instead — constant cost at any depth:

```ts
let q = supabase.from('tasks').select('*')
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(PAGE);
if (cursor)   // cursor = { created_at, id } of the last row of the prev page
  q = q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
```

Needs a composite index on `(created_at desc, id desc)`. Trade-off: no "jump to
page N" — pair it with infinite scroll, not a numbered pager.

## Filter and search in the database, never in JS

Fetching rows and filtering client-side both breaks past 1,000 rows **and**
throws away the indexes. Push every predicate down:

- Equality/sets: `.eq()`, `.in()`; dates: `.gte()/.lte()`.
- Text search: `.ilike('title', '%x%')` for small tables; for real search use
  Postgres full-text (`.textSearch()`) with a `tsvector` column + GIN index.
- Cross-table filters: filter through a join/inner select or a view, not by
  fetching both tables.

## Dashboard numbers: aggregate in the DB

Counting/summing fetched rows is wrong the moment a set passes 1,000. Use a
head-count per status, or one RPC for the whole stat block:

```ts
// cheap count, no rows transferred
const { count } = await supabase.from('tasks')
  .select('*', { count: 'exact', head: true }).eq('status', 'pending');
```

```sql
create or replace function public.task_stats()
returns table (status text, total bigint)
language sql stable as $$
  select status::text, count(*) from public.tasks group by status;
$$;
```

`supabase.rpc('task_stats')` returns a handful of rows regardless of table
size. Same idea for per-person stats, monthly summaries, charts.

## Rendering long lists

Even a correctly paginated feed can accumulate thousands of DOM nodes with
infinite scroll. Virtualize with `@tanstack/react-virtual` once a list can
exceed a few hundred rendered items; keep row height stable (Thai text — see
[thai-saas-ui-kit] spacing note).

## Realtime + pagination

The broadcast/invalidate pattern ([supabase-rls-schema]) stays the same:
invalidate the list's **key prefix** (`qk.tasks`) and react-query refetches
only the pages currently mounted. Never append realtime payload rows into a
paginated cache by hand — invalidation is simpler and can't drift.

## PDF reports and exports

A month of data can exceed 1,000 rows too. For `@react-pdf` reports and CSV
exports, loop `.range()` in chunks server-side until a short page comes back —
or better, aggregate in SQL first and render the summary. Never build an
export from a single un-ranged select.

## Checklist

- [ ] Every list query has `.order()` (with `id` tie-breaker) + `.range()`.
- [ ] Pager UIs use `count: 'exact'` (or `'estimated'` on very large tables).
- [ ] Tables that can reach tens of thousands of rows use keyset pagination.
- [ ] All filters/search run in the DB; search columns indexed (GIN for FTS).
- [ ] Dashboard stats come from head-counts or an RPC, never fetched rows.
- [ ] Long lists virtualized; realtime invalidates keys, never patches pages.
- [ ] Exports/PDFs chunk with `.range()` or aggregate in SQL.
