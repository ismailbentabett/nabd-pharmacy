/**
 * Raw colour values: the only place in the app where hex codes live (docs/DESIGN.md §2).
 * No React Native imports, so `app.config.ts` can read the same values for the splash screen and icon.
 * Components never import these directly; they read the active palette through `useColors()` or
 * `makeStyles()` in `theme.tsx`.
 *
 * Nabd brand: deep pine (trust, clinical calm) + one electric lime accent (the "pulse").
 * Every text/background pair below is checked by `node scripts/contrast.mjs --tokens`.
 */
export const brand = {
  /** Deep pine: brand surfaces, primary text. */
  primary: '#0E3B35',
  /** Lighter pine: secondary brand fills (banner art, pressed brand states). */
  secondary: '#17564C',
  /** Electric lime: fill only (CTA, badge, active indicator), never text on light backgrounds. */
  accent: '#C8F169',
} as const;

export const lightPalette = {
  bgApp: '#F4F6F3',
  bgSurface: '#FFFFFF',
  bgSunken: '#E9EEEA',
  /** The selected-state fill (active tab pill). Reads as a shape on white; pine on it stays AAA. */
  bgSelected: '#D5E4DD',
  textPrimary: '#0E3B35',
  textMuted: '#56675F',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: '#BFD3CB',
  lineHairline: '#E1E7E3',
  lineStrong: '#C6D1CB',
  /** Outline of an off/unchecked control (radio ring, switch track): 3:1 on app and surface (WCAG 1.4.11). */
  controlOutline: '#7A8C85',
  danger: '#C42B3A',
  dangerSurface: '#FBE9EB',
  success: '#17784A',
  successSurface: '#E5F4EC',
  warn: '#B45309',
  /** Fill only (CTA, badge), never text: pine on lime is AAA, lime on white is not legible. */
  accent: brand.accent,
  onAccent: '#0E3B35',
  skeletonBase: '#E5EBE7',
  skeletonHighlight: '#F2F5F3',
  scrim: '#0E3B35',
  /** Brand-coloured surfaces (the Home header, banner art). Pine in both schemes; `scrim` is not. */
  bgBrand: '#0E3B35',
  /** The launch veil. Always the native splash's pine, so the handover is invisible in both schemes. */
  bgSplash: brand.primary,
  imagePlaceholder: '#E6ECE8',
} as const;

export type Palette = { readonly [K in keyof typeof lightPalette]: string };

export const darkPalette: Palette = {
  bgApp: '#071D19',
  bgSurface: '#0E2B26',
  bgSunken: '#0A2420',
  bgSelected: '#1C4840',
  textPrimary: '#E7F1EC',
  textMuted: '#A6BCB3',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: '#BFD3CB',
  lineHairline: '#1D3D37',
  lineStrong: '#2B5149',
  controlOutline: '#6A8A80',
  danger: '#FF6B78',
  dangerSurface: '#3A1620',
  success: '#4ADE9A',
  successSurface: '#0F3326',
  warn: '#F2B84B',
  accent: brand.accent,
  onAccent: '#071D19',
  skeletonBase: '#13352F',
  skeletonHighlight: '#1C443C',
  scrim: '#000000',
  bgBrand: '#123F38',
  bgSplash: brand.primary,
  imagePlaceholder: '#15362F',
};
