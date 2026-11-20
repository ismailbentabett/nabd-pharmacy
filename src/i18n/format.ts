/**
 * Number and currency formatting. Western digits in both languages, 2 decimals,
 * `,` thousands. Written without Intl or regex and marked as worklets so the animated cart total can
 * format on the UI thread with exactly the same output as the JS side.
 */
import type { Halalas } from '@/core/money';

export type Lang = 'en' | 'ar';

function groupThousands(whole: number): string {
  'worklet';
  const digits = String(whole);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    out += digits[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) out += ',';
  }
  return out;
}

/** 4995 → "49.95". */
export function formatAmount(halalas: Halalas): string {
  'worklet';
  const rounded = Math.round(halalas);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const cents = abs % 100;
  return `${sign}${groupThousands((abs - cents) / 100)}.${cents < 10 ? '0' : ''}${cents}`;
}

// Worklet functions are not hoisted once the worklets Babel plugin rewrites them: declare a callee
// above every worklet that calls it.
export function currencyLabel(lang: Lang): string {
  'worklet';
  return lang === 'ar' ? 'ر.س' : 'SAR';
}

/** 4995 → "49.95 SAR" / "49.95 ر.س". */
export function formatSar(halalas: Halalas, lang: Lang): string {
  'worklet';
  return `${formatAmount(halalas)} ${currencyLabel(lang)}`;
}

/** 1234 → "1,234". */
export function formatCount(n: number): string {
  'worklet';
  return groupThousands(Math.max(0, Math.floor(n)));
}
