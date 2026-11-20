/**
 * Bilingual product search, shared by the offline backend and mirrored in SQL
 * (`public.normalize_search` + `public.search_products`). Both sides must give the same results for
 * the same query, so the steps below match the SQL one for one:
 *
 *   1. lower-case
 *   2. drop Arabic diacritics (harakat U+064B–U+065F, superscript alef U+0670) and tatweel U+0640
 *   3. fold letter variants: أ إ آ ٱ → ا, ى → ي, ة → ه   ("فيتامين" matches "فيتامين" typed any way)
 *   4. punctuation and whitespace runs → one space, then trim
 *
 * Ranking: every term must appear; a term that starts a word scores 2, one inside a word scores 1;
 * ties go to more reviews, then id.
 */
import type { Product } from './types';

const ch = (code: number) => String.fromCharCode(code);

/** Built from code points so no invisible combining character sits in the source. */
const DIACRITICS = new RegExp(`[${ch(0x064b)}-${ch(0x065f)}${ch(0x0670)}${ch(0x0640)}]`, 'g');
const PUNCTUATION_AND_SPACE = /[-_.,/+()&%'"!?:;\s]+/g;

const LETTER_FOLDS: Readonly<Record<string, string>> = {
  [ch(0x0623)]: ch(0x0627), // أ → ا
  [ch(0x0625)]: ch(0x0627), // إ → ا
  [ch(0x0622)]: ch(0x0627), // آ → ا
  [ch(0x0671)]: ch(0x0627), // ٱ → ا
  [ch(0x0649)]: ch(0x064a), // ى → ي
  [ch(0x0629)]: ch(0x0647), // ة → ه
};
const FOLDABLE = new RegExp(`[${Object.keys(LETTER_FOLDS).join('')}]`, 'g');

export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(FOLDABLE, (c) => LETTER_FOLDS[c] ?? c)
    .replace(PUNCTUATION_AND_SPACE, ' ')
    .trim();
}

/** Distinct, non-empty terms of a query, in first-seen order. */
export function searchTerms(query: string): string[] {
  const normalized = normalizeSearch(query);
  if (normalized === '') return [];
  return [...new Set(normalized.split(' '))].filter((t) => t !== '');
}

/** The text a product is searched by; same columns as the SQL `search_text`. */
export function searchTextOf(p: Product): string {
  return normalizeSearch(`${p.name} ${p.brand} ${p.nameAr} ${p.brandAr}`);
}

/** Score for one product, or 0 when a term is missing. */
export function scoreProduct(text: string, terms: readonly string[]): number {
  const padded = ` ${text}`;
  let score = 0;
  for (const term of terms) {
    if (!text.includes(term)) return 0;
    score += padded.includes(` ${term}`) ? 2 : 1;
  }
  return score;
}

/** Byte-order compare, the same as Postgres `collate "C"` for our ASCII ids. */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const SEARCH_LIMIT_DEFAULT = 40;
export const SEARCH_LIMIT_MAX = 100;

export function clampSearchLimit(limit: number | undefined): number {
  const value = limit ?? SEARCH_LIMIT_DEFAULT;
  return Math.max(1, Math.min(Number.isFinite(value) ? Math.floor(value) : SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX));
}

/**
 * Searches a product list. `textOf` lets the caller pass memoised search texts; by default they
 * are computed on the fly (1,000 products is ~1 ms).
 */
export function searchCatalog(
  products: readonly Product[],
  query: string,
  limit?: number,
  textOf: (p: Product) => string = searchTextOf,
): Product[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const hits: { product: Product; score: number }[] = [];
  for (const product of products) {
    const score = scoreProduct(textOf(product), terms);
    if (score > 0) hits.push({ product, score });
  }
  hits.sort(
    (a, b) =>
      b.score - a.score || b.product.reviews - a.product.reviews || compareIds(a.product.id, b.product.id),
  );
  return hits.slice(0, clampSearchLimit(limit)).map((h) => h.product);
}
