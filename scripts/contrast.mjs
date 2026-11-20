#!/usr/bin/env node
// WCAG 2.x contrast checker.
// Usage: node scripts/contrast.mjs --tokens            check every text/background pair the UI uses,
//                                                       light and dark, read from src/design/palette.ts
//        node scripts/contrast.mjs #0E3B35 #C8F169      check one pair
// Exits 1 if any --tokens pair is below its minimum, so it can run in scripts/check.sh.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hex = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large/UI' : 'FAIL');

/** Reads `{ key: '#hex' }` entries of one exported object in palette.ts (no TS loader needed). */
function readPalette(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`palette.ts has no export ${name}`);
  const body = source.slice(source.indexOf('{', start), source.indexOf('\n}', start));
  const out = {};
  for (const m of body.matchAll(/^\s*(\w+):\s*(?:'(#[0-9A-Fa-f]{6})'|brand\.(\w+))/gm)) {
    out[m[1]] = m[2] ?? m[3];
  }
  return out;
}

// [foreground, background, minimum]. 4.5 = body text, 3 = large text, icons and UI parts.
const PAIRS = [
  ['textPrimary', 'bgApp', 4.5],
  ['textPrimary', 'bgSurface', 4.5],
  ['textPrimary', 'bgSunken', 4.5],
  ['textPrimary', 'bgSelected', 4.5],
  ['textMuted', 'bgApp', 4.5],
  ['textMuted', 'bgSurface', 4.5],
  ['textMuted', 'bgSunken', 4.5],
  ['textOnBrand', 'bgBrand', 4.5],
  ['textOnBrandMuted', 'bgBrand', 4.5],
  ['onAccent', 'accent', 4.5],
  ['accent', 'bgBrand', 3],
  ['danger', 'bgSurface', 4.5],
  ['danger', 'dangerSurface', 4.5],
  ['success', 'bgSurface', 4.5],
  ['success', 'successSurface', 4.5],
  ['warn', 'bgSurface', 4.5],
  ['controlOutline', 'bgSurface', 3],
  ['controlOutline', 'bgApp', 3],
  ['lineStrong', 'bgSurface', 1.5],
];

if (process.argv[2] === '--tokens') {
  const file = fileURLToPath(new URL('../src/design/palette.ts', import.meta.url));
  const src = readFileSync(file, 'utf8');
  const brand = readPalette(src, 'brand');
  const light = readPalette(src, 'lightPalette');
  const dark = readPalette(src, 'darkPalette');
  const resolve = (p, k) => {
    const v = p[k];
    if (!v) throw new Error(`token ${k} missing`);
    return v.startsWith('#') ? v : brand[v];
  };
  let failed = 0;
  for (const [scheme, p] of [['light', light], ['dark', dark]]) {
    console.log(`\n${scheme}`);
    for (const [fg, bg, min] of PAIRS) {
      const r = ratio(resolve(p, fg), resolve(p, bg));
      const ok = r >= min;
      if (!ok) failed++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${`${fg} on ${bg}`.padEnd(32)} ${r.toFixed(2).padStart(6)}:1  (min ${min})  ${min < 3 ? 'divider' : grade(r)}`);
    }
  }
  console.log(failed ? `\n${failed} pair(s) below minimum.` : '\nAll pairs pass.');
  process.exit(failed ? 1 : 0);
}

if (process.argv[2] && process.argv[3]) {
  const r = ratio(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]} on ${process.argv[3]} = ${r.toFixed(2)}:1  ${grade(r)}`);
  process.exit(0);
}
console.log('Usage: node scripts/contrast.mjs --tokens | <fg-hex> <bg-hex>');
