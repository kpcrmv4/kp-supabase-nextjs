---
name: react-pdf-thai
description: >
  Render correct Thai-language PDFs with @react-pdf/renderer, fixing the
  notorious last-glyph clipping on wrapped Thai lines (Thai has no inter-word
  spaces, so the layout engine treats a line as one unbreakable word and cuts the
  final character). Use whenever generating PDF documents/reports that contain
  Thai text — official forms, per-record reports, period summaries. Covers Thai
  font registration (Sarabun), the whole-word hyphenation callback, the
  trailing-space buffer, line-height guidance, one-page density tuning, and the
  WebP-image gotcha (@react-pdf embeds only JPEG/PNG/SVG). Triggers on: react-pdf,
  @react-pdf/renderer, Thai PDF, ตัดคำไทย, ตัวอักษรท้ายหาย, Sarabun, Font.register.
metadata:
  type: reference
  stack: react-pdf, nextjs, thai
---

# Thai PDFs with @react-pdf/renderer

`@react-pdf/renderer` cannot break Thai (there are no spaces between words) and
**clips the final glyph of any wrapped line** — the classic
"ตัดคำภาษาไทยตัวสุดท้ายหาย" bug. This is the proven fix, extracted from a working
production report. Combine with **vercel-react-best-practices** for the React
side.

## The fix has three parts

### 1. Register a complete Thai font (Sarabun)

Sarabun is the official Thai government font (open license) and matches formal
report styling. Put the TTFs in `public/fonts/` and register with an absolute
URL (react-pdf needs a resolvable `src`).

```ts
// lib/pdf/thai.ts  — see thai.ts in this skill folder for the full file
import { Font } from '@react-pdf/renderer';

let registered = false;
export function registerThaiFonts(): void {
  if (registered) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: `${origin}/fonts/Sarabun-Regular.ttf`,  fontWeight: 400 },
      { src: `${origin}/fonts/Sarabun-Medium.ttf`,   fontWeight: 500 },
      { src: `${origin}/fonts/Sarabun-SemiBold.ttf`, fontWeight: 600 },
      { src: `${origin}/fonts/Sarabun-Bold.ttf`,     fontWeight: 700 },
    ],
  });
  // 2. Whole-word hyphenation — never split/hyphenate a token.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
```

### 2. `registerHyphenationCallback((word) => [word])` — the key line

The default callback splits words for Latin hyphenation. For Thai, returning the
**whole word unchanged** tells the layout engine "this token is one unit," which
combined with the trailing-space buffer stops the last-glyph clip. Do **not**
char-split the string (returning each character) — that produces ugly mid-word
wraps and still mismeasures. Whole-word is the proven approach.

### 3. Trailing-space buffer on every Thai `Text`

Append a hair/space character to each text line so the engine reserves room for
the final glyph. Wrap all text in one helper so you can't forget:

```tsx
const PAD = ' '; // single trailing space buffer
const T = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <Text style={style}>{children}{PAD}</Text>
);
// use <T> for EVERY Thai string in the document, including table cells.
```

## Density / one-page tuning

Reports often must fit **one A4 page** without feeling cramped
("ชิดกันเกินไป"). Tunable levers, in order of impact:

- `fontSize` 10–11 for body, 9 for dense tables.
- `lineHeight` **≥ 1.5** (1.55 is a good default) — too tight re-triggers clipping.
- Page `padding` ~36 (loosen from a cramped 24–28).
- Cap embedded images per section (e.g. `MAX_IMG = 4`) so photos don't push to a
  second page.
- Prefer fixed column widths in tables over `flex` so Thai wrapping is predictable.

Balance: shrinking font/line-height fits more but risks clipping; keep
`lineHeight ≥ 1.5` and add spacing elsewhere first.

## 🔴 WebP image gotcha

`@react-pdf/renderer` embeds **JPEG, PNG, and SVG only** — **not WebP**. If your
upload pipeline outputs WebP (common with `browser-image-compression`), PDF image
embedding fails silently or errors. Options:

- Compress to **JPEG** for anything destined for a PDF, or
- Convert WebP→JPEG/PNG before passing to `<Image>`, and derive the content-type
  from the actual bytes, not the filename.

## Registration timing

Call `registerThaiFonts()` once before rendering the document (e.g. at the top of
the component that builds the `<Document>`, or in a module-level effect). The
`registered` guard makes it safe to call repeatedly.

## Verify, don't assume

After generating, actually check the output:
- Open the produced PDF and read wrapped Thai lines end-to-end — the last
  character must be present.
- Count pages programmatically if "one page" is a requirement (parse the blob).
- Confirm times render as intended (e.g. `HH:MM`, drop seconds if the form wants it).

## Checklist

- [ ] Sarabun (or another complete Thai font) registered with resolvable `src`.
- [ ] `Font.registerHyphenationCallback((word) => [word])` present.
- [ ] Every Thai `Text` goes through the trailing-space wrapper.
- [ ] `lineHeight ≥ 1.5`; page padding not cramped.
- [ ] Images are JPEG/PNG/SVG (never WebP).
- [ ] Output visually verified for last-glyph clipping and page count.
```
