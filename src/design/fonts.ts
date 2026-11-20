/**
 * The font files, in one place. `app.config.ts` embeds them natively with the expo-font config
 * plugin, and `typography.ts` names them in styles. Both read this table, so a weight cannot be
 * embedded under one name and asked for under another.
 *
 * Plain data with no React Native import: the config loader reads this file in Node.
 */

/** File-name part for each weight, as published in the @expo-google-fonts packages. */
export const WEIGHT_FILE = {
  regular: '400Regular',
  medium: '500Medium',
  semibold: '600SemiBold',
} as const;

export type Weight = keyof typeof WEIGHT_FILE;

const FAMILY = {
  en: { pkg: 'ibm-plex-sans', name: 'IBMPlexSans' },
  ar: { pkg: 'ibm-plex-sans-arabic', name: 'IBMPlexSansArabic' },
} as const;

type FontLang = keyof typeof FAMILY;

/** The name Android registers an embedded font under: its file name without `.ttf`. */
export function fontName(lang: FontLang, weight: Weight): string {
  return `${FAMILY[lang].name}_${WEIGHT_FILE[weight]}`;
}

/** Every font file the app ships, for the expo-font config plugin. */
export function fontFiles(): string[] {
  const files: string[] = [];
  for (const lang of Object.keys(FAMILY) as FontLang[]) {
    for (const weight of Object.keys(WEIGHT_FILE) as Weight[]) {
      const file = WEIGHT_FILE[weight];
      files.push(`./node_modules/@expo-google-fonts/${FAMILY[lang].pkg}/${file}/${fontName(lang, weight)}.ttf`);
    }
  }
  return files;
}
