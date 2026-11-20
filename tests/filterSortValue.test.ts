/**
 * The Category screen's `{ sort, filters }` rules (C-03, H-03): price bands, category toggles, the
 * active-filter count, the title's single category, and what the route param from Home does.
 */
import { createFakeApi } from '@/core/api/fakeApi';
import { CATEGORIES, getCatalog } from '@/core/catalog';
import { toCentimes } from '@/core/money';
import {
  activeFilterCount,
  ALL_CATEGORIES,
  asRouteCategory,
  isPriceBand,
  NO_FILTERS,
  PRICE_BANDS,
  priceFilters,
  singleCategory,
  toggleCategory,
  withRouteCategory,
  type FilterSortValue,
} from '@/features/category/filterSortValue';

describe('price bands', () => {
  it('turn into inclusive DA bounds, the open top edge one centime lower', () => {
    expect(priceFilters(null)).toEqual({ priceMin: undefined, priceMax: undefined });
    expect(priceFilters({ to: 180000 })).toEqual({ priceMin: undefined, priceMax: 1799.99 });
    expect(priceFilters({ from: 180000, to: 360000 })).toEqual({ priceMin: 1800, priceMax: 3599.99 });
    expect(priceFilters({ from: 720000 })).toEqual({ priceMin: 7200, priceMax: undefined });
  });

  it('are recognised again from the filters they produce, and only that band is', () => {
    for (const band of PRICE_BANDS) {
      const filters = priceFilters(band);
      expect(isPriceBand(filters, band)).toBe(true);
      expect(isPriceBand(filters, null)).toBe(false);
      for (const other of PRICE_BANDS) if (other !== band) expect(isPriceBand(filters, other)).toBe(false);
    }
    expect(isPriceBand({}, null)).toBe(true);
    expect(isPriceBand({ priceMin: 12.5 }, null)).toBe(false);
  });

  it('as API filters, hold exactly the products whose centime price is in [from, to): every product once', () => {
    const api = createFakeApi({ delayMs: [0, 0], chaos: 0 });
    const { products } = getCatalog();
    const inBand = (price: number, band: (typeof PRICE_BANDS)[number]) => {
      const h = toCentimes(price);
      return (band.from === undefined || h >= band.from) && (band.to === undefined || h < band.to);
    };
    const perBand = PRICE_BANDS.map((band) => api.countProducts({ filters: priceFilters(band) }));
    expect(perBand).toEqual(PRICE_BANDS.map((band) => products.filter((p) => inBand(p.price, band)).length));
    expect(perBand.reduce((sum, n) => sum + n, 0)).toBe(products.length);
  });
});

describe('toggleCategory', () => {
  const [first, second, third] = CATEGORIES.map((c) => c.id);
  if (!first || !second || !third) throw new Error('The catalogue needs three categories');

  it('adds a category that is off and removes one that is on', () => {
    expect(toggleCategory(undefined, first)).toEqual([first]);
    expect(toggleCategory([first], second)).toEqual([first, second]);
    expect(toggleCategory([first, second], first)).toEqual([second]);
    expect(toggleCategory([first], first)).toEqual([]);
  });

  it('keeps the catalogue order whatever the tap order, so equal choices make equal queries', () => {
    expect(toggleCategory([third], first)).toEqual([first, third]);
    expect(toggleCategory(toggleCategory([third], second), first)).toEqual([first, second, third]);
  });
});

describe('activeFilterCount', () => {
  it('counts filter groups, not values, and never counts the sort', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ categories: [] })).toBe(0);
    expect(activeFilterCount({ categories: ['vitamins', 'skincare'] })).toBe(1);
    expect(activeFilterCount({ priceMin: 10, priceMax: 50 })).toBe(1);
    expect(activeFilterCount({ categories: ['vitamins'], priceMax: 50, inStockOnly: true, minRating: 4 })).toBe(4);
    expect(activeFilterCount({ inStockOnly: false })).toBe(0);
  });
});

describe('singleCategory', () => {
  it('names the category only when exactly one is selected', () => {
    expect(singleCategory({ categories: ['vitamins'] })?.en).toBe('Vitamins');
    expect(singleCategory({ categories: ['vitamins', 'skincare'] })).toBeUndefined();
    expect(singleCategory({ categories: [] })).toBeUndefined();
    expect(singleCategory({})).toBeUndefined();
  });
});

describe('the category param from Home', () => {
  it('accepts a known category id or "all", and nothing else', () => {
    expect(asRouteCategory('vitamins')).toBe('vitamins');
    expect(asRouteCategory(['skincare', 'vitamins'])).toBe('skincare');
    expect(asRouteCategory(ALL_CATEGORIES)).toBe('all');
    expect(asRouteCategory('nope')).toBeUndefined();
    expect(asRouteCategory([])).toBeUndefined();
    expect(asRouteCategory(undefined)).toBeUndefined();
  });

  const current: FilterSortValue = { sort: 'priceDesc', filters: { categories: ['skincare', 'vitamins'], inStockOnly: true, priceMax: 49.99 } };

  it('a category id replaces the category filter and keeps the rest', () => {
    expect(withRouteCategory(current, 'hair-care')).toEqual({ ...current, filters: { ...current.filters, categories: ['hair-care'] } });
    expect(withRouteCategory(NO_FILTERS, 'vitamins')).toEqual({ sort: 'relevance', filters: { categories: ['vitamins'] } });
  });

  it('"all" removes the category filter and keeps the rest; no request changes nothing', () => {
    expect(withRouteCategory(current, ALL_CATEGORIES)).toEqual({ sort: 'priceDesc', filters: { inStockOnly: true, priceMax: 49.99 } });
    expect(withRouteCategory(current, undefined)).toBe(current);
    expect(current.filters.categories).toEqual(['skincare', 'vitamins']); // the input is never changed
  });
});
