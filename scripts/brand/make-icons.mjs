/**
 * Renders the Nabd app icons from one geometric mark.
 *
 * The mark is a lime disc with a pine pulse line (one heartbeat) cut through it. Geometry lives in a
 * 100 x 100 box, the same numbers as `src/design/BrandMark.tsx`: disc radius 40 centred, pulse
 * stroke 7 with round caps and joins through PULSE. Each icon is written as SVG and rasterised by
 * resvg, so the pulse is one stroked path with true round joins (no seams where segments meet).
 *
 * resvg is not an app dependency. Run from the repo root:
 *   npm i --no-save @resvg/resvg-js && node scripts/brand/make-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const PINE = '#0E3B35'; // brand.primary
const LIME = '#C8F169'; // brand.accent
const WHITE = '#FFFFFF';

const PULSE = [[21, 53], [35, 53], [41, 43], [47, 69], [56, 29], [63, 59], [67, 53], [79, 53]];
const PULSE_STROKE = 7;
const DISC_RADIUS = 40;
const PULSE_PATH = PULSE.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
const OUT = 'assets/images/';

/**
 * The mark on a px x px canvas; `scale` is its size relative to the canvas. `cut` punches the pulse
 * out of the disc (transparent) instead of painting it: the Android monochrome layer needs that,
 * because the launcher tints every opaque pixel.
 */
function svg(px, scale, { disc = LIME, line = PINE, bg = null, cut = false } = {}) {
  const off = 50 - 50 / scale; // grow the viewBox so the 100-unit mark fills `scale` of it
  const box = 100 / scale;
  const stroke = `d="${PULSE_PATH}" stroke-width="${PULSE_STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const body = cut
    ? `<mask id="m"><rect x="${off}" y="${off}" width="${box}" height="${box}" fill="#fff"/><path ${stroke} stroke="#000"/></mask>
       <circle cx="50" cy="50" r="${DISC_RADIUS}" fill="${disc}" mask="url(#m)"/>`
    : `<circle cx="50" cy="50" r="${DISC_RADIUS}" fill="${disc}"/><path ${stroke} stroke="${line}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${off} ${off} ${box} ${box}">
    ${bg ? `<rect x="${off}" y="${off}" width="${box}" height="${box}" fill="${bg}"/>` : ''}${body}</svg>`;
}

function write(name, source) {
  const png = new Resvg(source, { fitTo: { mode: 'original' } }).render().asPng();
  writeFileSync(OUT + name, png);
}

// iOS / store icon: full-bleed pine, no transparency.
write('icon.png', svg(1024, 0.92, { bg: PINE }));
// Android adaptive icon: the mark stays inside the 66/108 safe circle.
write('android-icon-foreground.png', svg(512, 0.74));
write('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${PINE}"/></svg>`);
write('android-icon-monochrome.png', svg(432, 0.74, { disc: WHITE, cut: true }));
// Splash: the mark alone; the pine background comes from app.config.ts.
write('splash-icon.png', svg(512, 1));
// Web tab icon.
write('favicon.png', svg(196, 0.96, { bg: PINE }));
// The same full icon as SVG for the landing page and README.
writeFileSync(OUT + 'icon.svg', svg(1024, 0.92, { bg: PINE }));
console.log('icons written to', OUT);
