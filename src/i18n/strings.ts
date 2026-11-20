/**
 * Typed UI strings (ADR-011) with CLDR plural forms (ADR-029). The copy lives in
 * docs/fixtures/copy.json, the same "one source of truth" pattern as the catalog seed (ADR-018):
 * Metro inlines the JSON at build time and the parity test reads the same file.
 */
import copy from '../../docs/fixtures/copy.json';
import { formatCount, type Lang } from './format';

export type MessageKey = keyof typeof copy.en;
export type PluralKey = Exclude<keyof typeof copy.plurals.en, '_'>;
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type Vars = Readonly<Record<string, string | number>>;

type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

const messages: Record<Lang, Record<MessageKey, string>> = { en: copy.en, ar: copy.ar };
const plurals: Record<Lang, Record<PluralKey, PluralForms>> = {
  en: copy.plurals.en,
  ar: copy.plurals.ar,
};

/**
 * CLDR cardinal rule for integers. English: 1 → one, else other.
 * Arabic: 0 zero, 1 one, 2 two, n % 100 in 3..10 few, n % 100 in 11..99 many, else other.
 */
export function pluralCategory(lang: Lang, n: number): PluralCategory {
  const i = Math.abs(Math.trunc(n));
  if (lang === 'en') return i === 1 ? 'one' : 'other';
  if (i === 0) return 'zero';
  if (i === 1) return 'one';
  if (i === 2) return 'two';
  const mod = i % 100;
  if (mod >= 3 && mod <= 10) return 'few';
  if (mod >= 11) return 'many';
  return 'other';
}

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** `t('en', 'product.save', { p: 20 })` → "Save 20%". */
export function t(lang: Lang, key: MessageKey, vars?: Vars): string {
  return fill(messages[lang][key], vars);
}

/**
 * Count string. An explicit `zero` form wins for 0 in both languages ("No reviews yet");
 * otherwise the CLDR category's form, falling back to `other`. `{n}` gets thousands separators.
 */
export function tn(lang: Lang, key: PluralKey, n: number, vars?: Vars): string {
  const forms = plurals[lang][key];
  const form = (n === 0 && forms.zero) || forms[pluralCategory(lang, n)] || forms.other;
  return fill(form, { ...vars, n: formatCount(n) });
}
