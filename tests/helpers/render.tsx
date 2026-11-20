/**
 * Shared test helpers. Screens and components render inside the same providers the app uses
 * (language + colour scheme + a React Query cache), so tests see the real direction, copy and
 * palette. A test that brings its own QueryClientProvider still wins: the nearest provider is used.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { ThemeProvider } from '@/design/theme';
import { LocaleProvider } from '@/i18n/direction';
import type { Lang } from '@/i18n/format';

export type RenderOptions = { lang?: Lang; scheme?: 'light' | 'dark' };

/**
 * The providers go in as a `wrapper`, so `rerender(newUi)` keeps them and updates the same
 * component instance (refs and shared values survive, as they would on a device).
 */
export async function renderWithProviders(ui: ReactElement, { lang = 'en', scheme = 'light' }: RenderOptions = {}) {
  // One cache per render call (not per wrapper render), so a rerender keeps what was fetched.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const Providers = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider lang={lang}>
        <ThemeProvider scheme={scheme}>{children}</ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Providers });
}

/** Gesture Handler's native button reports a finished press as `onButtonPress`; this fires it. */
export async function pressNative(testID: string) {
  // fireEvent is async and wraps itself in act (RNTL 14); awaiting it keeps act scopes from overlapping.
  await fireEvent(screen.getByTestId(testID), 'buttonPress', { nativeEvent: {} });
}
