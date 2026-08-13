# Test plan — <Phase / Feature name>

> Copy to `docs/test-plan/<phase>.md`, fill the inventory first, then the rows.
> A blank cell is **not** a pass. Delete nothing to make this look finished —
> mark it `manual` or `n/a` + reason instead.

Plan reference: `CLAUDE.md` → <section>
ID prefix: `P<phase>-<FEATURE>` (e.g. `P2-ORD`)

## 0. Surface inventory (count before you assert)

| Enumerate | Source | Count | Listed |
|-----------|--------|-------|--------|
| Routes | `app/**/page.tsx`, `route.ts` | 0 | |
| Interactive elements | buttons, links, forms, inputs, selects, toggles, row actions | 0 | |
| Option values | every option / enum / radio / filter chip / sort key | 0 | |
| API surface | `route.ts` × method, + server actions | 0 | |
| Roles | incl. anonymous | 0 | |
| DB objects | tables, RPCs, triggers, RLS policies | 0 | |

**Coverage gate:** every element listed above must appear in ≥ 1 row below.
State the ratio in each feature heading.

## 1. <Feature name>  (elements 0/0 · endpoints 0/0 · options 0/0)

| ID | Trigger | Role | UI (DOM/ARIA + value) | UX (feedback/state/URL) | API (status + body) | DB (row delta, scoped org_id) | Status |
|----|---------|------|------------------------|--------------------------|---------------------|-------------------------------|--------|
| P?-???-01 | happy path | | | | | | ☐ |
| P?-???-02 | validation fail | | | | | count **unchanged** | ☐ |
| P?-???-03 | double-submit | | | disabled after 1st click | 2nd → `409` | **+1 only** | ☐ |
| P?-???-04 | unauthenticated (direct API) | anon | n/a | n/a | `401` (**not `307`**) | no new row | ☐ |
| P?-???-05 | wrong role | | button not rendered | | `403` | row unchanged, no audit row | ☐ |

Status values: `☐` not run · `pass` · `fail` · `did not run` · `manual`

## 2. Options / enum expansion (one row per value)

| ID | Option value | Expected UI | Expected API | Expected DB | Status |
|----|--------------|-------------|--------------|-------------|--------|
| | | | | | ☐ |
| | `empty` | | | | ☐ |
| | `invalid` | | `422` | unchanged | ☐ |

Boundaries to cover: `0`, `1`, `max`, `max+1`, and **> 1,000 rows** for anything
listed/paginated (`.order()` + `.range()` — see `supabase-large-data`).

## 3. Role × visibility matrix

| Object / action | admin | staff | <role> | anon |
|-----------------|-------|-------|--------|------|
| list own org | | | | `401` |
| read other org | | `404` | | `401` |
| mutate | | | | `401` |

RLS denial must be asserted **at the DB** (query as the role), not only by a
hidden button — see `supabase-rls-schema`.

## 4. State transitions (forbidden ones asserted as rejected)

| From | Event | Actor | To | Expected |
|------|-------|-------|-----|---------|
| | | | | |
| | (forbidden) | | — | `403`/`409`; row unchanged; no audit row |

## 5. Non-functional rows

| ID | Check | Target | Status |
|----|-------|--------|--------|
| | responsive: 320 / 375 / 768 / 1024 / 1440 | no overflow; sidebar ↔ bottom nav swaps | ☐ |
| | four data states | skeleton / error+retry / empty / success all reachable | ☐ |
| | list at > 1,000 rows | paginated, no silent truncation | ☐ |
| | Thai PDF | `%PDF` magic bytes + `Sarabun` embedded; last glyph not clipped | ☐ |
| | dark mode | tokens applied, contrast holds | ☐ |

## 6. Sign-off

- [ ] Inventory ratios closed (all 0/0 above replaced with real, equal numbers)
- [ ] Every row: UI + UX + API + DB filled or `n/a` + reason
- [ ] Every mutating row states a DB delta, including "unchanged"
- [ ] Report checked for `did not run` before declaring green
- [ ] Failing rows triaged against real DB/screenshot before editing any test
