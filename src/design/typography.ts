/**
 * Type scale (docs/DESIGN.md §2). Two families, three weights, six sizes.
 *
 * Fonts are embedded natively by the `expo-font` config plugin (app.config.ts), one file per weight,
 * so the weight is chosen by `fontFamily` (the file name) and `fontWeight` is never set: on Android
 * a `fontWeight` on a single-weight family makes the OS fake a bold.
 *
 * Arabic glyphs sit taller and need more air between lines, so the Arabic scale is the Latin one
 * plus 1 px and with line height x1.15 (rounded up). All 36 styles are built once at module load.
 */
import type { TextStyle } from 'react-native';

import type { Lang } from '@/i18n/format';

import { fontName, type Weight } from './fonts';

export type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type { Weight };

const VARIANTS: readonly Variant[] = ['display', 'title', 'heading', 'body', 'label', 'caption'];
const WEIGHTS: readonly Weight[] = ['regular', 'medium', 'semibold'];

type Metrics = Readonly<{ fontSize: number; lineHeight: number }>;

const LATIN_SCALE: Readonly<Record<Variant, Metrics>> = {
  display: { fontSize: 28, lineHeight: 34 },
  title: { fontSize: 22, lineHeight: 28 },
  heading: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
};

function arabicMetrics({ fontSize, lineHeight }: Metrics): Metrics {
  return { fontSize: fontSize + 1, lineHeight: Math.ceil(lineHeight * 1.15) };
}

/** The weight each variant uses unless a component asks for another. */
export const DEFAULT_WEIGHT: Readonly<Record<Variant, Weight>> = {
  display: 'semibold',
  title: 'semibold',
  heading: 'semibold',
  body: 'regular',
  label: 'medium',
  caption: 'regular',
};

/** The embedded font for each language and weight (see fonts.ts, shared with app.config.ts). */
export const FONT_FAMILY: Readonly<Record<Lang, Readonly<Record<Weight, string>>>> = {
  en: { regular: fontName('en', 'regular'), medium: fontName('en', 'medium'), semibold: fontName('en', 'semibold') },
  ar: { regular: fontName('ar', 'regular'), medium: fontName('ar', 'medium'), semibold: fontName('ar', 'semibold') },
};

/**
 * Text grows with the system font scale up to this factor, then stops (ADR-037). Layouts must not
 * clip at 1.5x; past it a 2x setting would break rows with a fixed height (tab bar, stepper, tiles).
 */
export const MAX_FONT_SCALE = 1.5;

type StyleTable = Readonly<Record<Lang, Readonly<Record<Variant, Readonly<Record<Weight, TextStyle>>>>>>;

function buildTable(): StyleTable {
  const table = {} as Record<Lang, Record<Variant, Record<Weight, TextStyle>>>;
  for (const lang of ['en', 'ar'] as const) {
    table[lang] = {} as Record<Variant, Record<Weight, TextStyle>>;
    for (const variant of VARIANTS) {
      const metrics = lang === 'ar' ? arabicMetrics(LATIN_SCALE[variant]) : LATIN_SCALE[variant];
      table[lang][variant] = {} as Record<Weight, TextStyle>;
      for (const weight of WEIGHTS) {
        table[lang][variant][weight] = Object.freeze({ ...metrics, fontFamily: FONT_FAMILY[lang][weight] });
      }
    }
  }
  return table;
}

const STYLES = buildTable();

/** The frozen style for a variant in a language. Same object every call, so it is safe in deps. */
export function typeStyle(lang: Lang, variant: Variant, weight: Weight = DEFAULT_WEIGHT[variant]): TextStyle {
  return STYLES[lang][variant][weight];
}
