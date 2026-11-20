/**
 * Root layout: the providers every screen needs, then a stack holding the tabs and the product page.
 *
 * - The native splash stays up until the first tab screen has laid out (its root calls
 *   `onFirstScreenLayout`), so the first thing the user sees is a usable screen, not a blank one (F-07).
 *   `LaunchVeil` draws the same splash on top and lifts it with motion (ADR-052). If no screen gets
 *   there (a crash, a hang), both still go after `SPLASH_MAX_WAIT_MS`, so the app can never be
 *   stuck behind them.
 * - Fonts are embedded natively by the expo-font config plugin, so there is no async font gate on a
 *   phone. The web preview loads the same files first (`useAppFontsReady`, ADR-050) and shows the
 *   launch veil meanwhile; the routes mount once the fonts are in, under the same veil.
 * - The product route is a transparent modal with no native animation: the shared-element hero
 *   transition draws its own motion on the UI thread and must not race a native slide (P-01, F-04).
 * - `LucideProvider` gives every icon the app's one stroke width (DESIGN §7: no mixed strokes), so no
 *   component passes `strokeWidth`. Only the stroke is set here: size and colour belong to each icon.
 * - `ErrorBoundary` is expo-router's per-route crash screen. Exported from the root layout, it catches
 *   a render error anywhere in the app. It renders *instead of* this layout, so it brings its own
 *   providers (theme, locale, icon stroke, gesture root) and hides the splash itself.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LucideProvider } from 'lucide-react-native';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { makeStyles, type Scheme, ThemeProvider } from '@/design/theme';
import { useAppFontsReady } from '@/design/useWebFonts';
import { size } from '@/design/tokens';
import { LocaleProvider, nativeLang } from '@/i18n/direction';
import { useT } from '@/i18n/useT';
import { MotionPreferenceSync } from '@/motion/motionPreference';
import { queryClient } from '@/state/queryClient';
import { ErrorState } from '@/ui/ErrorState';
import { LaunchVeil, revealApp } from '@/ui/LaunchVeil';

/** Longest the splash may stay up if Home never reports its first layout. */
const SPLASH_MAX_WAIT_MS = 5000;

// Both calls can reject (no native splash in some environments); that is not an error worth a red box.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => undefined);
  revealApp();
}, SPLASH_MAX_WAIT_MS);

const rootStyle = { flex: 1 } as const;

/**
 * The tabs sit under every other route. A cold start straight onto a product link
 * (`/product/<id>`) still gets the tabs mounted beneath it, so Back has somewhere to go.
 * expo-router 58 reads `anchor` (the older `initialRouteName` is deprecated).
 */
export const unstable_settings = { anchor: '(tabs)' };

/** The system light/dark setting (G-10). `null`/`unspecified` (no preference) means light. */
function useSystemScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export default function RootLayout() {
  const fontsReady = useAppFontsReady();
  const scheme = useSystemScheme();
  return (
    <GestureHandlerRootView style={rootStyle}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider scheme={scheme}>
          <LocaleProvider lang={nativeLang}>
            <LucideProvider strokeWidth={size.iconStroke}>
              <MotionPreferenceSync />
              {fontsReady ? (
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="search" options={{ animation: 'fade_from_bottom' }} />
                  <Stack.Screen
                    name="product/[id]"
                    options={{ presentation: 'transparentModal', animation: 'none', headerShown: false }}
                  />
                </Stack>
              ) : null}
              <LaunchVeil />
            </LucideProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const scheme = useSystemScheme();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={rootStyle}>
      <ThemeProvider scheme={scheme}>
        <LocaleProvider lang={nativeLang}>
          <LucideProvider strokeWidth={size.iconStroke}>
            <CrashScreen onRetry={retry} />
          </LucideProvider>
        </LocaleProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function CrashScreen({ onRetry }: { onRetry: () => Promise<void> }) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.screen}>
      <ErrorState
        onRetry={() => {
          void onRetry();
        }}
        title={t('state.crash.title')}
        body={t('state.crash.body')}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: c.bgApp },
}));
