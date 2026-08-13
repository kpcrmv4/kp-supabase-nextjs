---
name: thai-saas-ui-kit
description: >
  Design-system conventions and UI patterns for Thai-language admin/SaaS web apps
  built with Next.js + Tailwind v4. Use when setting up CSS-variable design
  tokens with light + dark mode (next-themes, class strategy), a responsive
  app shell (desktop dark sidebar ↔ mobile 5-slot bottom nav with a raised
  center primary action and an "เพิ่มเติม" overflow bottom sheet when menus
  exceed 5), status/category/urgent badges, loading skeletons + empty + error
  states (loading.tsx / error.tsx boundaries, retry cards, pending buttons),
  toasts instead of alert(), accessible modals for confirm/ask, IBM Plex Sans
  Thai typography, Thai line-breaking with NBSP-in-formatters, color-scheme
  vs Chrome force-dark, print/A4 styles, and lucide icons (never emoji).
  Triggers on: Tailwind tokens, design system, dark mode, theme toggle,
  color-scheme, force dark, ปรับเว็บไซต์ให้เป็นสีเข้ม, Thai text wraps wrong,
  ตัดบรรทัด, nbsp, next-themes,
  bottom nav, bottom sheet, FAB, center action button, more menu, เพิ่มเติม,
  sidebar, status badge, skeleton, loading state, empty state, error state,
  loading.tsx, error.tsx, pagination UI, pager, page numbers, แสดง...จาก...รายการ,
  sonner toast, radix dialog confirm, Thai UI, responsive app shell, print styles.
metadata:
  type: reference
  stack: nextjs, tailwind, thai, radix, lucide
---

# Thai SaaS UI Kit

Opinionated, product-specific UI conventions for Thai admin apps — avoids the
generic-template look. Pairs with **vercel-react-best-practices**. Adjust the
palette per product; the *structure* is what's reusable.

## Non-negotiables

- **Icons, never emoji** — use `lucide-react` line icons.
- **Toasts, never `alert()`** — use `sonner` (one `<Toaster>` at the root).
- **Accessible modals for confirm/ask** — `@radix-ui/react-dialog`, not `confirm()`.
- **Thai copy everywhere in the UI**; keep signatory/org names in `lib/constants.ts`.
- Small files (< 800 lines), organized by feature/domain.

## Design tokens (Tailwind v4, CSS-first) — light **and** dark from day one

Tailwind v4 is CSS-first: tokens live in CSS (`@theme`), not
`tailwind.config.ts`. Every color token is **semantic** and defined as a CSS
variable with a light and a dark value — components only ever reference the
token, so dark mode is a variable swap, not a rewrite. Example set (teal admin
theme — swap values per product):

```css
/* app/globals.css */
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));   /* class strategy, driven by next-themes */

@theme inline {
  --color-canvas: var(--canvas); --color-ink: var(--ink);
  --color-card: var(--card);     --color-line: var(--line);
  --color-brand: var(--brand);   --color-brand-sidebar: var(--brand-sidebar);
  --color-accent: var(--accent);
  --color-muted: var(--muted);
  --color-status-pending: var(--status-pending);   --color-status-pending-bg: var(--status-pending-bg);
  --color-status-progress: var(--status-progress); --color-status-progress-bg: var(--status-progress-bg);
  --color-status-done: var(--status-done);         --color-status-done-bg: var(--status-done-bg);
  --color-urgent: var(--urgent); --color-urgent-bg: var(--urgent-bg);
  --font-sans:   var(--font-thai), 'IBM Plex Sans Thai', system-ui, sans-serif;
  --font-looped: var(--font-thai-looped), 'IBM Plex Sans Thai Looped', sans-serif;
  --radius-card: 16px;
}

:root {
  --canvas: #EEF1EC; --ink: #16231F; --card: #FFFFFF; --line: #E7EAE4;
  --brand: #0F766E;  --brand-sidebar: #0E3B36; --accent: #22C55E;
  --muted: #7A867E;
  --status-pending: #5A6772;  --status-pending-bg: #EEF1F4;
  --status-progress: #B45309; --status-progress-bg: #FDF1E1;
  --status-done: #0F7A45;     --status-done-bg: #E4F4EC;
  --urgent: #C0362C;          --urgent-bg: #FDECEC;
}

.dark {
  --canvas: #101613; --ink: #E8EDEA; --card: #1A211D; --line: #2A332E;
  --brand: #2DD4BF;  --brand-sidebar: #0B1512; --accent: #4ADE80;
  --muted: #8FA096;
  /* status pairs re-derived for dark: text lightened, bg = deep tinted surface */
  --status-pending: #AEB9C2;  --status-pending-bg: #232B31;
  --status-progress: #F0A860; --status-progress-bg: #33271A;
  --status-done: #5BD08E;     --status-done-bg: #172E22;
  --urgent: #F08A80;          --urgent-bg: #38201E;
}
```

Usage stays token-only: `bg-canvas text-ink border-line bg-card` — a component
that never names a hex is automatically dark-ready.

### Dark mode rules

- **`next-themes`** with `attribute="class"`, `defaultTheme="system"`,
  `enableSystem` — persists the choice, respects OS preference, and prevents
  the wrong-theme flash on hydrate. Toggle lives in the app shell.
- Status/urgent colors get **re-derived dark pairs** (above), not the light
  bg colors on a dark surface — pastel bgs like `#FDF1E1` fail contrast on
  dark. Check badge text/bg pairs at ≥ 4.5:1 in both themes.
- The dark sidebar barely changes — deepen it slightly so it still reads as
  chrome against the dark canvas.
- **Declare `color-scheme` — or Chrome force-dark repaints you invisibly.**
  Android Chrome's "ปรับเว็บไซต์ให้เป็นสีเข้ม" (auto-dark, widely enabled in
  Thailand) recolors light surfaces **at paint time** while `getComputedStyle`
  still reports the light value — DevTools shows `#f5f5f6`, the screen shows
  dark; undebuggable from the inspector. Declaring the scheme tells Chrome the
  site handles dark itself, which opts it out of force-dark:

  ```css
  :root { color-scheme: light; }
  .dark { color-scheme: dark; }
  ```

  (plus `<meta name="color-scheme" content="light dark">`). To prove
  force-dark is the culprit, set a sentinel `--surface: lime` — if the pixels
  aren't green, something is repainting after you.
- **PWA**: keep `theme_color` in the manifest matched to the light canvas and
  set `<meta name="theme-color">` per scheme with `media` queries.
- **Print and PDF are always light** — force light tokens under
  `@media print`, and the [react-pdf-thai] path never uses theme variables.

## Typography — Thai

- **IBM Plex Sans Thai** (300–700) for body; **IBM Plex Sans Thai Looped** for
  large numerals/hero figures. Load via `next/font` into CSS vars
  (`--font-thai`, `--font-thai-looped`).
- Thai has tall ascenders/descenders — give list rows and inputs a little more
  vertical breathing room than a Latin design would.

### Thai line-breaking — NBSP belongs in the formatter

Thai puts real spaces inside things that must never split: ชื่อ นามสกุล,
`12 ส.ค. 69`, `09:00 น.`, `คงเหลือ 10 / 12`. The browser treats every space
as a break point, so narrow cards wrap mid-phrase: `ปาล์ม / เซลล์`,
`12 ส.ค. / 69`, `09:00 / น.`.

The formula that holds up:

- Emit **NBSP (` `)** inside the shared formatters — dates, times,
  quantities, full names — so one place controls wrapping app-wide, instead
  of chasing `<span>`s per screen.
- Give each formatter a **`plain` option** that emits normal spaces for
  CSV/PDF — spreadsheets and [react-pdf-thai] must not receive NBSPs.
- `whitespace-nowrap` only on short phrases that must stay whole (badge
  labels, `คงเหลือ x / y`) — never on paragraphs, which just overflows.

## Responsive app shell (the core pattern)

- **Desktop (≥ 860px):** left dark sidebar (~236px, `brand.sidebar`) with nav —
  the sidebar always shows **all** items; the 5-slot rule below is mobile-only.
- **Mobile (< 860px):** fixed **bottom nav bar** (requirement for small screens)
  with the 5-slot layout below.
- One `nav` config drives both; role decides which items show. Landing route is
  role-aware (admin → dashboard, member → own board/overview).

```tsx
// nav item shape reused by sidebar + bottom nav
type NavItem = {
  href: string; label: string; icon: LucideIcon; roles: Role[];
  primary?: boolean;   // exactly ONE item — the raised center action
};
```

### Bottom nav — 5 slots, raised center action, "เพิ่มเติม" overflow

The bar always renders **exactly 5 slots**:

| Slot | Content |
|------|---------|
| 1–2 | first two regular items |
| **3 (center)** | the `primary` item — the product's key feature (scan, create, report), raised above the bar |
| 4 | next regular item |
| 5 | last regular item — **or "เพิ่มเติม"** when items overflow |

Slot assignment from the role-filtered config:

```tsx
const visible = NAV.filter((i) => i.roles.includes(role));
const primary = visible.find((i) => i.primary)!;          // slot 3
const rest    = visible.filter((i) => !i.primary);
const overflow = rest.length > 4 ? rest.slice(3) : [];    // sheet items
const inBar    = rest.length > 4 ? rest.slice(0, 3) : rest; // slots 1,2,4(,5)
```

- **Center button (slot 3):** a raised circle (~60px) in `bg-brand text-white`
  with the `pop` shadow, translated up so it overlaps the bar
  (`-translate-y-1/3`), plus a `ring-4 ring-canvas` so it visually punches out
  of the bar edge; its label sits under the bar row like the other slots.
- **"เพิ่มเติม" (slot 5, only when > 5 menus):** `MoreHorizontal` icon. Tapping
  opens a **bottom sheet** (radix dialog styled as a sheet: fixed bottom,
  `rounded-t-card bg-card`, drag-handle bar, `animate-fadeUp`) listing **all
  remaining items** in a 4-column icon+label grid. Navigating closes the sheet.
- **Active states:** current route tints its slot with `text-brand`; when the
  active route lives inside the overflow sheet, the "เพิ่มเติม" slot shows the
  active tint instead.
- **Bar chrome:** `fixed bottom-0 grid grid-cols-5 h-16 bg-card border-t
  border-line` + `pb-[env(safe-area-inset-bottom)]` (iOS home indicator);
  give the page content matching bottom padding so nothing hides behind it.
- With ≤ 5 menus there is no "เพิ่มเติม" — slot 5 is just the last item. Never
  squeeze 6+ icons into the bar, and never hide the `primary` action in the
  sheet.

## Status / category / urgent badges

Drive every badge from tokens (or DB-provided colors for categories):

```tsx
const STATUS = {
  pending:  { label: 'ยังไม่ดำเนินงาน', cls: 'text-status-pending bg-status-pending-bg' },
  progress: { label: 'กำลังดำเนินงาน', cls: 'text-status-progress bg-status-progress-bg' },
  done:     { label: 'ดำเนินการแล้ว',  cls: 'text-status-done bg-status-done-bg' },
};
// Tokens carry the dark values (see above) — badges need no dark: overrides.
// DB-stored category colors need a dark-usable pair too (store bg+text per theme
// or pick colors that pass contrast on both surfaces).
// Urgent is a distinct dark red (#C0362C / bg #FDECEC) applied REGARDLESS of category —
// e.g. in a calendar, urgent chips override the category color and the legend lists it.
```

Category colors are best stored **in the DB** (`categories.color_bg`,
`color_text`) so admins can manage them; the UI just consumes them. When you show
colored items (calendar, board), include a **color legend**.

## Confirm/ask modal (Radix)

Wrap `@radix-ui/react-dialog` in a `useConfirm()` hook returning a promise, so
call sites read like `if (await confirm({ title, description, tone: 'danger' }))`.
Style overlay + content with the `pop` shadow and `card` radius.

## Toasts

`sonner` `<Toaster position="top-right" />` (or bottom-center pill). Replace every
`alert()`/`window.confirm()` with a toast or the confirm modal.

## Loading / skeleton / empty / error states

Every data view ships **four states** — loading, error, empty, success — and
the first three are designed, not left as a blank screen:

```tsx
if (isPending) return <TaskListSkeleton />;
if (isError)  return <ErrorState onRetry={refetch} />;
if (!data.length) return <EmptyState />;
return <TaskList rows={data} />;
```

- **Skeleton, not spinner, for content areas.** Shape-match the real layout
  (card grid → card skeletons; table → row skeletons) with token-based blocks:
  `bg-line animate-pulse rounded-card` — tokens keep skeletons correct in dark
  mode too. Match real row heights (Thai rows are taller) so the swap causes
  **zero layout shift**. Render 3–6 placeholder rows, not a screenful.
- **Spinners only for small inline waits**: a pending button shows a spinner
  inside the button, `disabled` to block double-submit; mutations surface
  failure as a sonner error toast (Thai copy), success as a quiet toast or none.
- **Error state = friendly Thai message + retry.** A card with a lucide icon,
  "โหลดข้อมูลไม่สำเร็จ", and a "ลองใหม่" button wired to `refetch()`. Never
  print raw error/stack text into the UI — log it server-side instead.
- **Empty state ≠ error.** Icon + one Thai sentence + a CTA when the user can
  act (e.g. "ยังไม่มีงาน — สร้างงานแรก"); filtered-to-empty lists say the
  filter found nothing and offer to clear it.
- **App Router boundaries:** `loading.tsx` per route segment renders the page
  skeleton; `error.tsx` (client) wraps the segment with the retry card via
  `reset()`. Pick **one** skeleton owner per view — route-level `loading.tsx`
  or component-level `isPending` — never both stacked.
- **Pagination polish** ([supabase-large-data]): pass `placeholderData:
  keepPreviousData` so page changes keep showing the previous page instead of
  flashing skeletons; infinite scroll appends a small bottom loader row only.

## Pagination UI

Data side (`.range()`, counts, keyset, infinite) lives in
**[supabase-large-data]** — this is the visible pager convention:

- **Desktop tables: pager row under the table.** Left side shows the range in
  Thai — `แสดง 1–50 จาก 1,234 รายการ` (numbers via
  `toLocaleString('th-TH')`; total from `count`). Right side: `ChevronLeft` /
  `ChevronRight` buttons + page numbers (current ±2 with `…` ellipsis, first/
  last always reachable). Active page = `bg-brand text-white`; bound buttons
  `disabled`, not hidden.
- **Page size** select (25/50/100) only on admin tables that need it; default
  50 and persist the choice.
- **Mobile: no numbered pager.** Prefer infinite scroll (`useInfiniteQuery` +
  bottom loader row); if a discrete pager is unavoidable, use only
  ก่อนหน้า / ถัดไป chips with the range text between. Touch targets ≥ 44px.
- **Page state lives in the URL** (`?page=2` via searchParams) so refresh,
  back, and shared links land on the same page. Changing any filter/search
  resets to page 1 (and the URL). Infinite feeds skip URL state.
- Page transitions keep previous data (`keepPreviousData` — see the states
  section above): the table stays put, no skeleton flash between pages.
- Empty page guard: if a page beyond the last (stale URL, deleted rows) comes
  back empty, snap to the last valid page instead of showing an empty table.

## Print / A4

For printable reports rendered as HTML (vs the PDF path — see **[react-pdf-thai]**):
hide chrome with `@media print` (`[data-noprint]{display:none}`), set A4 page
size, and lay out sheets with fixed widths so Thai wraps predictably.

## Checklist

- [ ] Palette + type + spacing live in CSS-variable tokens, not scattered literals.
- [ ] Dark mode: next-themes (class, system default), dark values for every token
      incl. status/urgent pairs; badges pass contrast in both themes.
- [ ] `theme-color` meta per scheme; print + PDF forced light.
- [ ] Desktop sidebar ↔ mobile bottom nav from one nav config; role-aware landing.
- [ ] Bottom nav = 5 slots: one `primary` raised center action; > 5 menus → slot 5
      is "เพิ่มเติม" opening a bottom sheet with the rest; active tint follows the
      route (incl. routes inside the sheet); safe-area padding applied.
- [ ] Status/urgent from tokens; category colors from DB; legend where colored.
- [ ] lucide icons (no emoji); sonner toasts (no alert); radix confirm (no confirm()).
- [ ] Every data view has all four states: shape-matched skeleton (no layout
      shift), Thai error card + retry, designed empty state, success.
- [ ] Mutations: pending buttons disabled + inline spinner; failures toast in Thai.
- [ ] Page transitions keep previous data (`keepPreviousData`), no skeleton flash.
- [ ] Pager: Thai range text (`แสดง x–y จาก z รายการ`), page in URL, filter
      resets to page 1; mobile uses infinite scroll or ก่อนหน้า/ถัดไป only.
- [ ] Thai fonts via next/font; org/signatory strings in `lib/constants.ts`.
- [ ] Print styles hide chrome and lay out A4.
```
