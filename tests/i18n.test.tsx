import { renderHook } from '@testing-library/react-native';
import { reloadAppAsync } from 'expo';
import type { ReactNode } from 'react';
import { I18nManager } from 'react-native';

import copy from '../docs/fixtures/copy.json';
import { LocaleProvider, nativeLang, switchLanguage, useDirection } from '@/i18n/direction';
import { currencyLabel, type Lang } from '@/i18n/format';
import { pluralCategory, t, tn, type PluralCategory } from '@/i18n/strings';
import { useT } from '@/i18n/useT';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(() => Promise.resolve()) }));

type Forms = Readonly<Record<string, string>>;
const messages: Record<Lang, Readonly<Record<string, string>>> = { en: copy.en, ar: copy.ar };
const plurals: Record<Lang, Readonly<Record<string, Forms>>> = { en: copy.plurals.en, ar: copy.plurals.ar };

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const EASTERN_DIGITS = /[٠-٩۰-۹]/;
const ARABIC_LETTER = /[ء-ي]/;

function allStrings(lang: Lang): string[] {
  return [
    ...Object.values(messages[lang]),
    ...Object.values(plurals[lang]).flatMap((forms) => Object.values(forms)),
  ];
}

const wrapperFor = (lang: Lang) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <LocaleProvider lang={lang}>{children}</LocaleProvider>;
  };

describe('copy parity (en ↔ ar)', () => {
  it('has the same message keys in both languages', () => {
    expect(Object.keys(messages.ar).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it('has the same plural keys in both languages', () => {
    expect(Object.keys(plurals.ar).sort()).toEqual(Object.keys(plurals.en).sort());
  });

  it.each(Object.keys(copy.en))('"%s" uses the same placeholders in en and ar', (key) => {
    expect(placeholders(messages.ar[key]!)).toEqual(placeholders(messages.en[key]!));
  });

  it.each(Object.keys(copy.plurals.en))('plural "%s" uses the same non-count placeholders', (key) => {
    const extra = (lang: Lang) =>
      [...new Set(Object.values(plurals[lang][key]!).flatMap(placeholders))].filter((p) => p !== 'n').sort();
    expect(extra('ar')).toEqual(extra('en'));
  });

  it('gives every Arabic plural all six CLDR forms', () => {
    const all: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
    for (const forms of Object.values(plurals.ar)) expect(Object.keys(forms).sort()).toEqual([...all].sort());
  });

  it('gives every English plural one and other', () => {
    for (const forms of Object.values(plurals.en)) {
      expect(forms.one).toBeDefined();
      expect(forms.other).toBeDefined();
    }
  });

  it('has no empty or whitespace-only strings', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const s of allStrings(lang)) expect(s.trim()).not.toBe('');
    }
  });

  it('uses Western digits only (ADR-028)', () => {
    for (const s of allStrings('ar')) expect(s).not.toMatch(EASTERN_DIGITS);
  });

  it('has Arabic text in every Arabic string (nothing left untranslated)', () => {
    // The language toggle names its target language in that language's own script, and an
    // email placeholder is an address, which is Latin in either language.
    const latinByDesign = new Set(['lang.toggle', 'account.email.placeholder']);
    const untranslated = Object.entries(messages.ar).filter(
      ([key, s]) => !latinByDesign.has(key) && !ARABIC_LETTER.test(s),
    );
    expect(untranslated).toEqual([]);
    expect(messages.ar['lang.toggle']).toBe('English');
    expect(messages.en['lang.toggle']).toMatch(ARABIC_LETTER);
  });

  it('keeps the currency copy in step with the formatter', () => {
    expect(t('en', 'currency')).toBe(currencyLabel('en'));
    expect(t('ar', 'currency')).toBe(currencyLabel('ar'));
  });
});

describe('pluralCategory', () => {
  it.each([
    [0, 'zero'],
    [1, 'one'],
    [2, 'two'],
    [3, 'few'],
    [10, 'few'],
    [11, 'many'],
    [99, 'many'],
    [100, 'other'],
    [101, 'other'],
    [102, 'other'],
    [103, 'few'],
    [111, 'many'],
    [1000, 'other'],
  ] as const)('ar %i → %s', (n, expected) => {
    expect(pluralCategory('ar', n)).toBe(expected);
  });

  it.each([
    [0, 'other'],
    [1, 'one'],
    [2, 'other'],
    [21, 'other'],
    [1000, 'other'],
  ] as const)('en %i → %s', (n, expected) => {
    expect(pluralCategory('en', n)).toBe(expected);
  });
});

describe('t / tn', () => {
  it('fills placeholders', () => {
    expect(t('en', 'product.save', { p: 20 })).toBe('Save 20%');
  });

  it('leaves an unknown placeholder visible instead of printing "undefined"', () => {
    expect(t('en', 'product.save')).toBe(copy.en['product.save']);
  });

  it('prefers an explicit zero form', () => {
    expect(tn('en', 'product.reviews', 0)).toBe('No reviews yet');
    expect(tn('ar', 'product.reviews', 0)).toBe(copy.plurals.ar['product.reviews'].zero);
  });

  it('falls back to "other" for 0 when English has no zero form', () => {
    expect(tn('en', 'category.count', 0)).toBe('0 products');
  });

  it('formats the count with thousands separators', () => {
    expect(tn('en', 'category.count', 1000)).toBe('1,000 products');
    expect(tn('ar', 'category.count', 1000)).toBe('1,000 منتج');
  });

  it('picks the Arabic form by CLDR category', () => {
    expect(tn('ar', 'category.count', 1)).toBe('منتج واحد');
    expect(tn('ar', 'category.count', 2)).toBe('منتجان');
    expect(tn('ar', 'category.count', 3)).toBe('3 منتجات');
    expect(tn('ar', 'category.count', 11)).toBe('11 منتجاً');
    expect(tn('ar', 'category.count', 100)).toBe('100 منتج');
  });
});

describe('direction and translator hooks', () => {
  it('runs left-to-right in English by default (the Jest native layer is LTR)', async () => {
    expect(nativeLang).toBe('en');
    const { result } = await renderHook(() => useDirection());
    expect(result.current).toEqual({ lang: 'en', isRTL: false, dir: 1, start: 'left' });
  });

  it('mirrors under the Arabic provider', async () => {
    const { result } = await renderHook(() => useDirection(), { wrapper: wrapperFor('ar') });
    expect(result.current).toMatchObject({ isRTL: true, dir: -1, start: 'right' });
  });

  it('returns the translator for the current language with a stable identity', async () => {
    const { result, rerender } = await renderHook(() => useT(), { wrapper: wrapperFor('ar') });
    const first = result.current;
    expect(first.lang).toBe('ar');
    expect(first.t('currency')).toBe('ر.س');
    await rerender({});
    expect(result.current).toBe(first);
  });
});

describe('switchLanguage', () => {
  let allowRTL: jest.SpyInstance;
  let forceRTL: jest.SpyInstance;

  beforeEach(() => {
    jest.mocked(reloadAppAsync).mockClear();
    allowRTL = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => undefined);
    forceRTL = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing when the language is already active (no reload loop)', async () => {
    await switchLanguage('en');
    expect(allowRTL).not.toHaveBeenCalled();
    expect(forceRTL).not.toHaveBeenCalled();
    expect(reloadAppAsync).not.toHaveBeenCalled();
  });

  it('allows and forces RTL, then reloads, when switching to Arabic', async () => {
    await switchLanguage('ar');
    expect(allowRTL).toHaveBeenCalledWith(true);
    expect(forceRTL).toHaveBeenCalledWith(true);
    expect(reloadAppAsync).toHaveBeenCalledWith('language:ar');
    expect(forceRTL.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(reloadAppAsync).mock.invocationCallOrder[0]!,
    );
  });
});
