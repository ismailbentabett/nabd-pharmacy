/**
 * Colour scheme plumbing. Components read colours through `useColors()` or `makeStyles()`, never
 * from `palette.ts` directly, so dark mode (G-10) is a provider change, not a refactor.
 *
 * The root layout feeds the system scheme into `ThemeProvider` (ADR-053). Both sheets are built at
 * module load, so switching scheme picks another sheet; it never builds styles in render (ADR-032).
 */
import { createContext, use, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { darkPalette, lightPalette, type Palette } from './palette';

export type Scheme = 'light' | 'dark';

const PALETTES: Readonly<Record<Scheme, Palette>> = { light: lightPalette, dark: darkPalette };

/** What `StyleSheet.create` accepts. RN 0.88 no longer exports a named type for it. */
type StyleSheetInput = Parameters<typeof StyleSheet.create>[0];

const SchemeContext = createContext<Scheme>('light');

export function ThemeProvider({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return <SchemeContext value={scheme}>{children}</SchemeContext>;
}

export function useScheme(): Scheme {
  return use(SchemeContext);
}

/** The palette for the current scheme. The object identity is stable per scheme. */
export function useColors(): Palette {
  return PALETTES[use(SchemeContext)];
}

/**
 * Build a style sheet from the palette once per scheme, at module load. Both sheets exist up front,
 * so render never creates styles and the returned object keeps the same identity between renders
 * (memoised children are not invalidated by a new `style` object).
 *
 *   const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.bgSurface } }));
 *   function Card() { const styles = useStyles(); ... }
 */
export function makeStyles<T extends StyleSheetInput>(factory: (colors: Palette) => T) {
  const sheets: Readonly<Record<Scheme, Readonly<T>>> = {
    light: StyleSheet.create(factory(lightPalette)),
    dark: StyleSheet.create(factory(darkPalette)),
  };
  return function useStyles(): Readonly<T> {
    return sheets[use(SchemeContext)];
  };
}
