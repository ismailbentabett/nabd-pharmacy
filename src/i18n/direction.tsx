/**
 * Language and layout direction. The only module that touches `I18nManager` (lint: no-direct-i18nmanager).
 *
 * Android decides the layout direction before any JS runs (the `forceRTL`/`allowRTL` flags it persists
 * itself), and React Native keeps that direction for the life of the JS runtime. So the language is
 * derived from the native direction instead of being stored separately: text and layout can never
 * disagree, and a failed flip cannot cause a reload loop (ADR-031). Switching language = set the flags,
 * then reload the JS runtime (ADR-005).
 */
import { reloadAppAsync } from 'expo';
import { createContext, use, type ReactNode } from 'react';
import { I18nManager, Platform, View } from 'react-native';

import type { Lang } from './format';

export type Direction = Readonly<{
  /** Multiply every horizontal offset, swipe threshold and slide-in distance by this. */
  dir: 1 | -1;
  isRTL: boolean;
  /** The physical side where reading starts, for the rare API that only takes left/right. */
  start: 'left' | 'right';
}>;

export type Locale = Direction & Readonly<{ lang: Lang }>;

function localeFor(lang: Lang): Locale {
  const isRTL = lang === 'ar';
  return Object.freeze({ lang, isRTL, dir: isRTL ? -1 : 1, start: isRTL ? 'right' : 'left' });
}

/** One frozen object per language, so consumers get a stable identity and never re-render for it. */
const LOCALES: Readonly<Record<Lang, Locale>> = { en: localeFor('en'), ar: localeFor('ar') };

/**
 * Web preview only (ADR-049). react-native-web's `I18nManager` is a stub that always reports LTR, so
 * on web the language lives in localStorage. `LocaleProvider` puts a `dir` attribute on the app's
 * root view, which react-native-web's logical styles (`start`/`end`, row direction) follow, and
 * `<html dir/lang>` is set for the browser and screen readers. Never runs on a phone.
 */
const WEB_LANG_KEY = 'lang';

function readWebLang(): Lang {
  try {
    return globalThis.localStorage?.getItem(WEB_LANG_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

function applyWebDirection(lang: Lang): void {
  const root = globalThis.document?.documentElement;
  if (root === undefined) return;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  root.lang = lang;
}

/** The language this JS runtime runs in. Read once: `I18nManager.isRTL` cannot change until a reload. */
export const nativeLang: Lang =
  Platform.OS === 'web' ? readWebLang() : I18nManager.isRTL ? 'ar' : 'en';

if (Platform.OS === 'web') applyWebDirection(nativeLang);

const LocaleContext = createContext<Locale>(LOCALES[nativeLang]);

/**
 * The app runs on the context default (the native direction) and does not need this provider.
 * Tests use it to render a screen in the other language without a native flip.
 */
export function LocaleProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const content = <LocaleContext value={LOCALES[lang]}>{children}</LocaleContext>;
  if (Platform.OS !== 'web') return content;
  // Web preview only (ADR-049): react-native-web resolves `start`/`end` styles from the nearest
  // `dir` attribute, not from I18nManager. `dir` is a DOM prop that React Native's types don't know.
  const dirProp = { dir: lang === 'ar' ? 'rtl' : 'ltr' } as object;
  return (
    <View style={webRootStyle} {...dirProp}>
      {content}
    </View>
  );
}

const webRootStyle = { flex: 1 } as const;

export function useLocale(): Locale {
  return use(LocaleContext);
}

export function useDirection(): Direction {
  return use(LocaleContext);
}

/**
 * Persist the native direction for `next`, then reload the JS runtime so every native view
 * (horizontal scrollers, `textAlign: 'auto'`, stack transitions, Android back) picks it up.
 * The caller commits a pending cart undo and shows the veil first (ADR-005); the cart itself is
 * already persisted on every change. `allowRTL(false)` matters as much as `forceRTL(false)`: on a
 * phone set to Arabic, Android would otherwise keep laying the English UI out right-to-left.
 */
export async function switchLanguage(next: Lang): Promise<void> {
  if (next === nativeLang) return;
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(WEB_LANG_KEY, next);
    } catch {
      // Storage blocked: the reload below comes back in the same language.
    }
    await reloadAppAsync(`language:${next}`);
    return;
  }
  const rtl = next === 'ar';
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  await reloadAppAsync(`language:${next}`);
}
