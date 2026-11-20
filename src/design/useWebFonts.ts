/**
 * Web preview only (ADR-050). On a phone the six IBM Plex files are embedded at build time by the
 * expo-font config plugin (app.config.ts), so they exist before any JS runs and this hook just
 * returns `true`. That plugin does nothing for the web build: without this, the browser fell back
 * to its default serif. On web the same six files are loaded under the same names `typography.ts`
 * asks for, and the root layout waits for them so text never swaps font after the first paint.
 *
 * Metro needs a literal `require` per file, so the paths are spelled out; `fonts.ts` owns the names.
 */
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

import { fontName } from './fonts';

const WEB_FONTS = {
  [fontName('en', 'regular')]: require('@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'),
  [fontName('en', 'medium')]: require('@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf'),
  [fontName('en', 'semibold')]: require('@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf'),
  [fontName('ar', 'regular')]: require('@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf'),
  [fontName('ar', 'medium')]: require('@expo-google-fonts/ibm-plex-sans-arabic/500Medium/IBMPlexSansArabic_500Medium.ttf'),
  [fontName('ar', 'semibold')]: require('@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold/IBMPlexSansArabic_600SemiBold.ttf'),
} as const;

function useWebFontsLoaded(): boolean {
  const [loaded, error] = useFonts(WEB_FONTS);
  // A failed load still renders: the fallback font beats a blank page.
  return loaded || error !== null;
}

const useNativeFontsLoaded = (): boolean => true;

/** `true` once the app's fonts can be used. Always `true` on a phone. */
export const useAppFontsReady: () => boolean = Platform.OS === 'web' ? useWebFontsLoaded : useNativeFontsLoaded;
