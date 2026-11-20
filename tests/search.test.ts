/**
 * Bilingual search (src/core/catalog/search.ts). The same steps run in SQL on Supabase, so these
 * tests pin the behaviour both backends must share.
 */
import { createFakeApi } from '@/core/api/fakeApi';
import { getCatalog } from '@/core/catalog';
import {
  clampSearchLimit,
  normalizeSearch,
  scoreProduct,
  searchCatalog,
  searchTerms,
  searchTextOf,
  SEARCH_LIMIT_DEFAULT,
  SEARCH_LIMIT_MAX,
} from '@/core/catalog/search';

const ch = (...codes: number[]) => String.fromCharCode(...codes);
const products = getCatalog().products;

describe('normalizeSearch', () => {
  it('lower-cases, folds punctuation runs to one space and trims', () => {
    expect(normalizeSearch('  Omega-3,   FISH_oil! ')).toBe('omega 3 fish oil');
  });

  it('drops Arabic diacritics and tatweel', () => {
    // "kitab" with a fatha (U+064E) and a tatweel (U+0640) in it
    const plain = ch(0x0643, 0x062a, 0x0627, 0x0628);
    const marked = ch(0x0643, 0x064e, 0x062a, 0x0640, 0x0627, 0x0628);
    expect(normalizeSearch(marked)).toBe(plain);
  });

  it('folds alef, yaa and taa marbuta variants', () => {
    // أ إ آ ٱ → ا ; ى → ي ; ة → ه
    expect(normalizeSearch(ch(0x0623, 0x0625, 0x0622, 0x0671))).toBe(ch(0x0627, 0x0627, 0x0627, 0x0627));
    expect(normalizeSearch(ch(0x0649))).toBe(ch(0x064a));
    expect(normalizeSearch(ch(0x0629))).toBe(ch(0x0647));
  });
});

describe('searchTerms', () => {
  it('returns distinct terms in first-seen order', () => {
    expect(searchTerms('Oil omega OIL')).toEqual(['oil', 'omega']);
  });

  it('is empty for blank or punctuation-only input', () => {
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms(' - , ')).toEqual([]);
  });
});

describe('scoreProduct', () => {
  it('scores 2 for a word start, 1 inside a word, 0 when any term is missing', () => {
    expect(scoreProduct('vitamin d3 drops', ['vit'])).toBe(2);
    expect(scoreProduct('multivitamin', ['vit'])).toBe(1);
    expect(scoreProduct('vitamin d3 drops', ['vit', 'zinc'])).toBe(0);
    expect(scoreProduct('vitamin d3 drops', ['vit', 'drop'])).toBe(4);
  });
});

describe('clampSearchLimit', () => {
  it('defaults, floors and clamps into 1..max', () => {
    expect(clampSearchLimit(undefined)).toBe(SEARCH_LIMIT_DEFAULT);
    expect(clampSearchLimit(0)).toBe(1);
    expect(clampSearchLimit(7.9)).toBe(7);
    expect(clampSearchLimit(10_000)).toBe(SEARCH_LIMIT_MAX);
    expect(clampSearchLimit(Number.NaN)).toBe(SEARCH_LIMIT_DEFAULT);
  });
});

describe('searchCatalog', () => {
  it('finds a product by its English brand and by its Arabic name', () => {
    const target = products[42]!;
    expect(searchCatalog(products, target.brand, 100).map((p) => p.id)).toContain(target.id);
    expect(searchCatalog(products, target.nameAr, 100).map((p) => p.id)).toContain(target.id);
  });

  it('every hit contains every term', () => {
    const hits = searchCatalog(products, 'vitamin d', 100);
    expect(hits.length).toBeGreaterThan(0);
    for (const p of hits) {
      const text = searchTextOf(p);
      expect(text).toContain('vitamin');
      expect(text).toContain('d');
    }
  });

  it('ranks by score, then reviews, then id, and is deterministic', () => {
    const a = searchCatalog(products, 'cream', 100);
    const b = searchCatalog(products, 'cream', 100);
    expect(a).toEqual(b);
    const terms = searchTerms('cream');
    for (let i = 1; i < a.length; i++) {
      const prev = scoreProduct(searchTextOf(a[i - 1]!), terms);
      const next = scoreProduct(searchTextOf(a[i]!), terms);
      expect(prev).toBeGreaterThanOrEqual(next);
      if (prev === next) expect(a[i - 1]!.reviews).toBeGreaterThanOrEqual(a[i]!.reviews);
    }
  });

  it('respects the limit and returns nothing for a blank query', () => {
    expect(searchCatalog(products, 'a', 5)).toHaveLength(5);
    expect(searchCatalog(products, '  ')).toEqual([]);
  });

  it('is what the offline backend returns', async () => {
    const api = createFakeApi({ delayMs: [0, 0], chaos: 0 });
    expect(await api.searchProducts('serum', 20)).toEqual(searchCatalog(products, 'serum', 20));
  });
});
