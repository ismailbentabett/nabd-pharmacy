/**
 * The only text component screens use. It picks the font file for the current language and weight,
 * the colour from the palette, and aligns to the reading start so Arabic lines up on the right
 * without any `isRTL` checks in callers.
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useLocale } from '@/i18n/direction';

import type { Palette } from './palette';
import { useColors } from './theme';
import { MAX_FONT_SCALE, typeStyle, type Variant, type Weight } from './typography';

export type Tone = 'primary' | 'muted' | 'onBrand' | 'onBrandMuted' | 'onAccent' | 'danger' | 'success' | 'warn';

const TONE_COLOR: Readonly<Record<Tone, keyof Palette>> = {
  primary: 'textPrimary',
  muted: 'textMuted',
  onBrand: 'textOnBrand',
  onBrandMuted: 'textOnBrandMuted',
  onAccent: 'onAccent',
  danger: 'danger',
  success: 'success',
  warn: 'warn',
};

/** Prices and quantities use fixed-width digits so totals do not jitter when they change. */
const NUMERIC: TextStyle = { fontVariant: ['tabular-nums'] };

export type TextProps = RNTextProps & {
  variant?: Variant;
  weight?: Weight;
  tone?: Tone;
  numeric?: boolean;
  /** Logical alignment; `start` follows the reading direction. */
  align?: 'start' | 'center' | 'end';
};

export function Text({
  variant = 'body',
  weight,
  tone = 'primary',
  numeric = false,
  align = 'start',
  style,
  maxFontSizeMultiplier = MAX_FONT_SCALE,
  ...rest
}: TextProps) {
  const { lang } = useLocale();
  const colors = useColors();
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typeStyle(lang, variant, weight),
        { color: colors[TONE_COLOR[tone]], textAlign: align },
        numeric && NUMERIC,
        style,
      ]}
    />
  );
}
