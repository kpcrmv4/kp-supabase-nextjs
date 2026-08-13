---
name: kp-acceptance-test-matrix
description: >
  Turn a feature plan into an exhaustive, measurable acceptance matrix before
  writing code — every route, every button, every select option, every API
  method and every role gets a row whose expected result is asserted at all
  four layers (UI / UX / API / DB). Use when writing or reviewing a plan, spec,
  phase, or CLAUDE.md task list; when asked "how do we know this works?"; when
  a feature was called done but only the happy path was checked; or when a
  green E2E run still missed a broken option. Covers surface inventory, the
  observable-predicate rule (no prose acceptance criteria), per-option and
  per-role expansion, the negative/RLS matrix, state-transition tables,
  traceability IDs, and the coverage gate. Triggers on: test plan, แผนเทส,
  acceptance criteria, spec coverage, definition of done, test matrix, every
  button, every endpoint, every option, measurable outcome, verify against
  spec, what should this return, DoD, regression checklist.
metadata:
  type: reference
  stack: nextjs-app-router, supabase, playwright, testing
---

# Acceptance test matrix (spec → measurable rows)

The third leg of the testing triad: **[kp-testing-cadence]** decides *when* to
run a check, **[kp-e2e-playwright-real-db]** is *how* to run it reliably — this
skill is **what to assert, and how to know nothing was missed**.

Write the matrix **with the plan, before the code**. A plan whose acceptance
criteria are prose ("บันทึกได้", "แสดงผลถูกต้อง") cannot fail — and something
that cannot fail cannot verify anything.

## 1. Inventory the surface first — you cannot cover what you never listed

"ทุกปุ่ม / ทุก API" is a *counting* claim. Enumerate before asserting, straight
from the code, and write the counts down:

| Enumerate | From | Count |
|-----------|------|-------|
| Routes | `app/**/page.tsx`, `layout.tsx`, `route.ts` | e.g. 7 |
| Interactive elements per route | JSX `<button>`, `<a>`, `<form>`, `<input>`, `<select>`, toggles, menu items, row actions | e.g. 23 |
| Option values | every `<option>` / enum / radio / filter chip / sort key — **each value is its own row** | e.g. 14 |
| API surface | each `route.ts` × each exported method, plus every server action | e.g. 11 |
| Roles | every role in the system (+ anonymous) | e.g. 4 |
| DB objects touched | tables, RPCs, triggers, RLS policies | e.g. 6 |

Row actions inside a list count **once per action**, not once per list. A
dropdown with 5 options is 5 rows, not 1 — that is exactly where "green build,
one broken option" hides.

## 2. Every row asserts at four layers

A row is not done until each layer is either asserted or explicitly marked
`n/a` with a reason. **A row that changes state MUST have a DB assertion** — UI
confirmation is not proof that anything was written.

| Layer | What counts as measurable | Example |
|-------|---------------------------|---------|
| **UI** | a DOM/ARIA query with a value: text, count, attribute, visibility | `getByRole('row')` count `20`; badge text `ค้างชำระ` |
| **UX** | observable feedback state: `disabled`, `aria-busy`, toast text, focus, URL, the four data states (skeleton/error/empty/success) | button `disabled` while pending; toast `บันทึกแล้ว`; URL → `/orders/<id>` |
| **API** | HTTP status + body shape/field values (+ headers where they matter) | `POST /api/orders` → `201`, `body.id` is uuid; unauthenticated → **`401`, not `307`** |
| **DB** | row delta queried with the service-role client, scoped `org_id` | `orders` `+1` row with `status='pending'`, `org_id=TEST_ORG`; `audit_log` `+1` |

The API layer is where silent redirects get caught: an unauthenticated API call
must answer `401`, and a redirect to `/login` is a bug, not a pass
(**[nextjs-supabase-ssr-auth]**).

## 3. The observable-predicate rule

Expected results are predicates a machine can evaluate — not sentences a human
can nod at.

| ❌ Not measurable | ✅ Measurable |
|---|---|
| บันทึกสำเร็จ | `201`; `orders` +1 (`status='pending'`); toast `บันทึกแล้ว`; แถวใหม่อยู่บนสุดของตาราง |
| แสดง error ถ้าของไม่พอ | `422` `body.error='QTY_EXCEEDS_STOCK'`; `orders` count **ไม่เปลี่ยน**; inline text ใต้ field `จำนวนเกินสต็อก` |
| หน้าโหลดเร็ว | LCP < 2.5s บน `/orders` (1,000 แถว), หลัง warm-up |
| staff เห็นเฉพาะของตัวเอง | staff: `GET /api/orders` → เฉพาะ `org_id=A`; แถวของ org B → `404`; SQL as staff role คืน 0 แถวจาก org B |

Two habits make rows measurable: state a **number or exact string**, and state
the **negative half** ("count ไม่เปลี่ยน") — most silent bugs are a write that
happened when it shouldn't have, or didn't when it should.

## 4. Expand each row over options, roles, and failure modes

For every enumerated element, generate rows across three axes. Skipping an axis
is a decision to record, not an oversight to discover later.

**Options axis** — one row per value, plus `empty`, `invalid/out-of-range`, and
the boundary (0, 1, max, max+1, and >1,000 rows for anything paginated —
**[supabase-large-data]**).

**Role axis** — every role × anonymous. What each role sees, and what each role
is *refused*. RLS denial is asserted at the DB too, not only in the UI
(**[supabase-rls-schema]**); hiding a button is not access control.

**Failure axis** — for every mutating endpoint: unauthenticated, wrong role,
not-found, validation failure, duplicate/conflict, and concurrent double-submit
(double-click must not create two rows).

For status/enum fields, add a transition table — **forbidden transitions must be
asserted as rejected**, not merely absent from the UI:

| From | Event | To | Expected |
|------|-------|-----|---------|
| `pending` | approve (admin) | `approved` | `200`; row `status='approved'`; `approved_by` = admin id |
| `pending` | approve (staff) | — | `403`; row **unchanged**; no audit row |
| `approved` | approve again | — | `409`; exactly one `audit_log` row total |

## 5. Traceability — give every row an ID

Number rows off the plan item so a gap is greppable instead of remembered:
`P2-ORD-07` = phase 2, orders feature, row 7. Use the ID as the test-title
prefix:

```ts
test('P2-ORD-07 staff cannot approve — 403, row unchanged', async () => { /* ... */ });
```

Then the run report maps back to the plan directly, and `86 did not run` is
readable as *which* rows are unverified (**[kp-e2e-playwright-real-db]**).
Rows too expensive to automate are still rows: mark them `manual` with the exact
steps — never delete a row to make a matrix look complete.

## 6. The coverage gate

Before calling a feature done, the matrix must satisfy:

- **Inventory closed** — every element counted in §1 appears in ≥1 row; the
  ratio is stated (`23/23 elements`, `11/11 endpoints`, `14/14 options`).
- **Four layers per row** — asserted, or `n/a` + reason.
- **Every mutating row has a DB delta**, including the "must NOT change" ones.
- **Every endpoint has an unauth row** and a wrong-role row.
- **Every role appears** in at least the rows where visibility differs.
- **Every row has a status**: `pass` / `fail` / `did not run` / `manual`.
  Unfilled is not a pass.

`tsc` and `next build` green mean nothing here — none of the four layers is
checked by either (**[nextjs-gotchas]**).

## 7. Template

Ship the matrix as `docs/test-plan/<phase>.md` next to the plan, one table per
feature. Copy-ready starter: **`TEST-PLAN-template.md`** in this skill folder.

```md
### P2-ORD — Create order  (elements 6/6 · endpoints 2/2 · options 4/4)

| ID | Trigger | Role | UI | UX | API | DB | Status |
|----|---------|------|----|----|-----|----|--------|
| P2-ORD-01 | ปุ่ม "สร้างออเดอร์" (happy) | staff | แถวใหม่บนสุด, count 20→21 | toast `บันทึกแล้ว`; ปุ่ม disabled ระหว่างส่ง; → `/orders/<id>` | `POST /api/orders` `201`, `body.id` uuid | `orders` +1 (`status='pending'`, `org_id=TEST_ORG`); `audit_log` +1 | ☐ |
| P2-ORD-02 | จำนวน = 0 | staff | inline `จำนวนต้องมากกว่า 0` | ไม่มี toast; ปุ่มกลับ enabled | `422` `body.error='QTY_MIN'` | `orders` count **เท่าเดิม** | ☐ |
| P2-ORD-03 | double-click ส่ง 2 ครั้ง | staff | มี 1 แถวใหม่ | ปุ่ม disabled หลังคลิกแรก | 2nd → `409` | `orders` +1 **เท่านั้น** | ☐ |
| P2-ORD-04 | เรียก API ตรง ไม่ล็อกอิน | anon | n/a (ไม่มี UI) | n/a | `401` (**ไม่ใช่ 307**) | ไม่มีแถวใหม่ | ☐ |
```

## Checklist

- [ ] Surface inventoried and **counted** (routes, elements, options, endpoints, roles, DB objects) before any row is written.
- [ ] Matrix written **with the plan**, before implementation.
- [ ] Every row: UI + UX + API + DB asserted, or `n/a` + reason.
- [ ] Every expected result is a number/exact string, not prose.
- [ ] Every mutating row states the DB delta — including "count unchanged".
- [ ] Each select/enum/filter value has its own row; boundaries + >1,000 rows covered.
- [ ] Every endpoint has unauth (`401`, not `307`) and wrong-role (`403`) rows; RLS denial asserted at DB level.
- [ ] Forbidden state transitions asserted as rejected, not just hidden.
- [ ] Rows carry IDs used as test-title prefixes; `manual` rows kept with steps.
- [ ] Coverage ratios stated and closed; no row left blank at sign-off.
