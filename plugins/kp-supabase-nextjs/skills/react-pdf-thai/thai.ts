// Copy-ready: Thai font + hyphenation setup for @react-pdf/renderer.
// Drop into lib/pdf/thai.ts. Put Sarabun TTFs in public/fonts/.
// Call registerThaiFonts() once before rendering any <Document> with Thai text.
import { Font } from '@react-pdf/renderer';

let registered = false;

/**
 * Register Sarabun (a complete Thai font) and — crucially — a hyphenation
 * callback that returns each token unchanged.
 *
 * Without this, @react-pdf/renderer treats a spaceless Thai line as one
 * unbreakable "word" and CLIPS the final glyph when it overflows. Returning the
 * whole word as its own single break-unit lets the layout engine wrap lines
 * correctly, which is exactly the "ตัดคำภาษาไทยตัวสุดท้ายหาย" problem.
 *
 * Pair this with a trailing-space buffer on every <Text> line (a <T> wrapper),
 * lineHeight >= 1.5, and JPEG/PNG images (never WebP — react-pdf can't embed it).
 */
export function registerThaiFonts(): void {
  if (registered) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: `${origin}/fonts/Sarabun-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/Sarabun-Medium.ttf`, fontWeight: 500 },
      { src: `${origin}/fonts/Sarabun-SemiBold.ttf`, fontWeight: 600 },
      { src: `${origin}/fonts/Sarabun-Bold.ttf`, fontWeight: 700 },
    ],
  });

  // Whole-word (no mid-word hyphenation). Do NOT char-split.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
