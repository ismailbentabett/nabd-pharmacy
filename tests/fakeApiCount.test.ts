/**
 * The fake API's result count (C-03: the sheet's "Show 312 results"). It runs on every chip tap,
 * synchronously, so it must be a plain filter pass that never builds or evicts the sorted page
 * lists the grid is paging through.
 *
 * "Builds a list" is observed with a spy on the catalogue array's `filter`: the API builds a page
 * list with `products.filter(...).sort(...)`, and the count does not use `filter` at all.
 */
import { createFakeApi, SORT_KEYS, type ProductFilters, type ProductQuery } from '@/core/api/fakeApi';
import { CATEGORIES, getCatalog, type Product } from '@/core/catalog';

const instant = () => createFakeApi({ delayMs: [0, 0], chaos: 0 });

/** The grid's query in these tests, and one more than the 8 page lists the API keeps. */
const GRID_QUERY: ProductQuery = { sort: 'priceAsc', filters: { inStockOnly: true } };
const DRAFTS: readonly ProductFilters[] = [
  ...CATEGORIES.map((category) => ({ categories: [category.id] })),
  { minRating: 4 },
];

function spyOnListBuilds() {
  return jest.spyOn(getCatalog().products as Product[], 'filter');
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('countProducts', () => {
  it('builds no list and evicts none: the grid’s next page is still served from its cached list', async () => {
    const api = instant();
    await api.getProductsPage({ page: 0, ...GRID_QUERY });
    const builds = spyOnListBuilds();

    for (const filters of DRAFTS) api.countProducts({ filters });
    expect(DRAFTS.length).toBeGreaterThan(8);
    expect(builds).not.toHaveBeenCalled();

    const next = await api.getProductsPage({ page: 1, ...GRID_QUERY });
    expect(next.items).toHaveLength(20);
    expect(builds).not.toHaveBeenCalled();
  });

  it('control: nine other page queries do evict the list, and the spy sees it rebuilt', async () => {
    const api = instant();
    await api.getProductsPage({ page: 0, ...GRID_QUERY });
    for (const filters of DRAFTS) await api.getProductsPage({ page: 0, filters });
    const builds = spyOnListBuilds();

    await api.getProductsPage({ page: 1, ...GRID_QUERY });
    expect(builds).toHaveBeenCalledTimes(1);
  });

  it('matches a brute-force count, whatever the sort', () => {
    const api = instant();
    const { products } = getCatalog();
    for (const category of CATEGORIES) {
      const filters: ProductFilters = { categories: [category.id], inStockOnly: true, minRating: 4 };
      const expected = products.filter((p) => p.category === category.id && p.inStock && p.rating >= 4).length;
      for (const sort of SORT_KEYS) expect(api.countProducts({ sort, filters })).toBe(expected);
    }
    expect(api.countProducts({})).toBe(products.length);
  });

  it('agrees with the total the pages report for the same query', async () => {
    const api = instant();
    const query: ProductQuery = { sort: 'rating', filters: { categories: ['vitamins', 'fitness'], priceMax: 99.99 } };
    const page = await api.getProductsPage({ page: 0, ...query });
    expect(api.countProducts(query)).toBe(page.total);
  });
});
