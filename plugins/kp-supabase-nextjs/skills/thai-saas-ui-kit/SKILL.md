---
name: thai-saas-ui-kit
description: >
  Design-system conventions and UI patterns for Thai-language admin/SaaS web apps
  built with Next.js + Tailwind. Use when setting up design tokens, a responsive
  app shell (desktop dark sidebar ↔ mobile bottom nav), status/category/urgent
  badges, toasts instead of alert(), accessible modals for confirm/ask, IBM Plex
  Sans Thai typography, print/A4 styles, and lucide icons (never emoji). Triggers
  on: Tailwind tokens, design system, bottom nav, sidebar, status badge, sonner
  toast, radix dialog confirm, Thai UI, responsive app shell, print styles.
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

## Design tokens (Tailwind)

Define tokens once in `tailwind.config.ts`; never hardcode the palette repeatedly.
Example token set (teal admin theme — swap per product):

```ts
theme: { extend: {
  colors: {
    canvas: '#EEF1EC', ink: '#16231F', card: '#FFFFFF', line: '#E7EAE4',
    brand: { DEFAULT: '#0F766E', dark: '#134E48', sidebar: '#0E3B36' },
    accent: '#22C55E',
    muted: { DEFAULT: '#7A867E', soft: '#8A968E', faint: '#9AA79F' },
    status: {
      pending: '#5A6772', pendingBg: '#EEF1F4',
      progress: '#B45309', progressBg: '#FDF1E1',
      done: '#0F7A45', doneBg: '#E4F4EC',
    },
    urgent: { DEFAULT: '#C0362C', bg: '#FDECEC' },
  },
  fontFamily: {
    sans:   ['var(--font-thai)', 'IBM Plex Sans Thai', 'system-ui', 'sans-serif'],
    looped: ['var(--font-thai-looped)', 'IBM Plex Sans Thai Looped', 'sans-serif'], // big numerals
  },
  borderRadius: { card: '16px' },
  boxShadow: {
    card: '0 1px 2px rgba(16,40,34,.04), 0 14px 30px -24px rgba(16,40,34,.3)',
    pop:  '0 12px 30px -10px rgba(0,0,0,.35)',
  },
  keyframes: { fadeUp: { from: { opacity:'0', transform:'translateY(6px)' }, to: { opacity:'1', transform:'translateY(0)' } } },
  animation: { fadeUp: 'fadeUp .3s ease' },
}}
```

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
  pending:  { label: 'ยังไม่ดำเนินงาน', cls: 'text-status-pending bg-status-pendingBg' },
  progress: { label: 'กำลังดำเนินงาน', cls: 'text-status-progress bg-status-progressBg' },
  done:     { label: 'ดำเนินการแล้ว',  cls: 'text-status-done bg-status-doneBg' },
};
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

- [ ] Palette + type + spacing live in tokens, not scattered literals.
- [ ] Desktop sidebar ↔ mobile bottom nav from one nav config; role-aware landing.
- [ ] Status/urgent from tokens; category colors from DB; legend where colored.
- [ ] lucide icons (no emoji); sonner toasts (no alert); radix confirm (no confirm()).
- [ ] Thai fonts via next/font; org/signatory strings in `lib/constants.ts`.
- [ ] Print styles hide chrome and lay out A4.
```
