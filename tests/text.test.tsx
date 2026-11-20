/**
 * `Text` is the one place where language, palette and font scale meet. These tests render it the
 * way screens do, inside the language and scheme providers, and read the style React Native gets.
 */
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

import { darkPalette, lightPalette } from '@/design/palette';
import { Text, type TextProps } from '@/design/Text';
import { ThemeProvider } from '@/design/theme';
import { MAX_FONT_SCALE } from '@/design/typography';
import { LocaleProvider } from '@/i18n/direction';
import type { Lang } from '@/i18n/format';

async function renderText(props: TextProps & { children: ReactNode }, lang: Lang = 'en', scheme: 'light' | 'dark' = 'light') {
  await render(
    <LocaleProvider lang={lang}>
      <ThemeProvider scheme={scheme}>
        <Text testID="t" {...props} />
      </ThemeProvider>
    </LocaleProvider>,
  );
  const element = screen.getByTestId('t');
  return { element, style: StyleSheet.flatten(element.props.style) as TextStyle };
}

describe('Text', () => {
  it('uses IBM Plex Sans in English and IBM Plex Sans Arabic in Arabic', async () => {
    expect((await renderText({ children: 'Vitamins' }, 'en')).style.fontFamily).toBe('IBMPlexSans_400Regular');
    expect((await renderText({ children: 'فيتامينات' }, 'ar')).style.fontFamily).toBe('IBMPlexSansArabic_400Regular');
  });

  it('sets the Arabic size one step up from the Latin one', async () => {
    const en = (await renderText({ children: 'Total', variant: 'heading' }, 'en')).style;
    const ar = (await renderText({ children: 'الإجمالي', variant: 'heading' }, 'ar')).style;
    expect(ar.fontSize).toBe((en.fontSize ?? 0) + 1);
    expect(ar.fontFamily).toBe('IBMPlexSansArabic_600SemiBold');
  });

  it('aligns to the reading start by default, in both languages', async () => {
    expect((await renderText({ children: 'a' }, 'en')).style.textAlign).toBe('start');
    expect((await renderText({ children: 'ا' }, 'ar')).style.textAlign).toBe('start');
    expect((await renderText({ children: 'a', align: 'end' }, 'ar')).style.textAlign).toBe('end');
  });

  it('takes its colour from the tone and the current scheme', async () => {
    expect((await renderText({ children: 'a' })).style.color).toBe(lightPalette.textPrimary);
    expect((await renderText({ children: 'a', tone: 'muted' })).style.color).toBe(lightPalette.textMuted);
    expect((await renderText({ children: 'a', tone: 'danger' }, 'en', 'dark')).style.color).toBe(darkPalette.danger);
  });

  it('uses fixed-width digits only when numeric', async () => {
    expect((await renderText({ children: '12.50', numeric: true })).style.fontVariant).toEqual(['tabular-nums']);
    expect((await renderText({ children: 'Price' })).style.fontVariant).toBeUndefined();
  });

  it('caps the system font scale by default, and lets one place choose its own cap', async () => {
    expect((await renderText({ children: 'a' })).element.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    expect((await renderText({ children: 'a', maxFontSizeMultiplier: 1.2 })).element.props.maxFontSizeMultiplier).toBe(1.2);
  });

  it('lets a caller style win over the defaults', async () => {
    const { style } = await renderText({ children: 'a', tone: 'muted', style: { color: lightPalette.textPrimary } });
    expect(style.color).toBe(lightPalette.textPrimary);
  });
});
