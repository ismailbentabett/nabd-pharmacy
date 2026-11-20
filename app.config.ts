import type { ExpoConfig } from 'expo/config';

import { fontFiles } from './src/design/fonts.ts';
import { brand, lightPalette } from './src/design/palette.ts';
import { withShortObjectPaths } from './plugins/withShortObjectPaths.ts';

/**
 * App config. Typed so a wrong key fails `tsc`, not the native build.
 *
 * - New Architecture is the only architecture on SDK 58, so there is no flag for it.
 * - Fonts are embedded natively by the expo-font config plugin: no async font loading, no flash of
 *   system font on cold start (F-07). On Android the family name is the file name without `.ttf`.
 * - R8 minify + resource shrinking keep the release APK small and start-up fast (F-07, F-10).
 * - withShortObjectPaths keeps the Android native build under the Windows path limit (ADR-040).
 */
const config: ExpoConfig = {
  name: 'Nabd',
  slug: 'nabd-pharmacy',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'nabd',
  userInterfaceStyle: 'automatic',
  backgroundColor: lightPalette.bgApp,
  android: {
    package: 'com.nabd.pharmacy',
    adaptiveIcon: {
      backgroundColor: brand.primary,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // The product page is a custom gesture-driven route; the system predictive-back animation would
    // fight it. Back is handled by the router and our own transition.
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: 'com.nabd.pharmacy',
    supportsTablet: false,
  },
  web: { favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: brand.primary,
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
      },
    ],
    'expo-image',
    [
      'expo-font',
      {
        fonts: fontFiles(),
      },
    ],
    'expo-localization',
    [
      'expo-build-properties',
      {
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          enablePngCrunchInReleaseBuilds: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default withShortObjectPaths(config);
