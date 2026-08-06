---
name: thai-saas-ui-kit
description: >
  Design-system conventions and UI patterns for Thai-language admin/SaaS web apps
  built with Next.js + Tailwind v4. Use when setting up CSS-variable design
  tokens with light + dark mode (next-themes, class strategy), a responsive
  app shell (desktop dark sidebar ↔ mobile bottom nav), status/category/urgent
  badges, toasts instead of alert(), accessible modals for confirm/ask, IBM Plex
  Sans Thai typography, print/A4 styles, and lucide icons (never emoji). Triggers
  on: Tailwind tokens, design system, dark mode, theme toggle, next-themes,
  bottom nav, sidebar, status badge, sonner toast, radix dialog confirm, Thai UI,
  responsive app shell, print styles.
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

## Responsive app shell (the core pattern)

- **Desktop (≥ 860px):** left dark sidebar (~236px, `brand.sidebar`) with nav.
- **Mobile (< 860px):** fixed **bottom nav bar** (requirement for small screens).
  Optionally raise the primary action (center item) above the bar.
- One `nav` config drives both; role decides which items show. Landing route is
  role-aware (admin → dashboard, member → own board/overview).

```tsx
// nav item shape reused by sidebar + bottom nav
type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };
```

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
- [ ] Status/urgent from tokens; category colors from DB; legend where colored.
- [ ] lucide icons (no emoji); sonner toasts (no alert); radix confirm (no confirm()).
- [ ] Thai fonts via next/font; org/signatory strings in `lib/constants.ts`.
- [ ] Print styles hide chrome and lay out A4.
```
