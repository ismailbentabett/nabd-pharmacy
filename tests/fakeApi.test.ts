/**
 * The fake backend (D-03, D-04, D-05, docs/FAKE_BACKEND.md): pages of 20, 300–800 ms, ~1 in 20 fails.
 */
import { BANNERS, CATEGORIES, getCatalog } from '@/core/catalog';
import {
  DEFAULT_CHAOS,
  FakeNetworkError,
  SORT_KEYS,
  createFakeApi,
  parseChaos,
  queryKeyOf,
  type FakeApi,
  type ProductQuery,
} from '@/core/api/fakeApi';

const instant = () => createFakeApi({ delayMs: [0, 0], chaos: 0 });

async function allPages(api: FakeApi, query: ProductQuery = {}) {
  const ids: string[] = [];
  let page = 0;
  for (;;) {
    const res = await api.getProductsPage({ page, ...query });
    ids.push(...res.items.map((p) => p.id));
    if (!res.hasMore) return { ids, pages: page + 1, total: res.total };
    page += 1;
  }
}

describe('paging (D-03)', () => {
  it('50 pages of 20 cover all 1,000 products exactly once', async () => {
    const api = instant();
    const { ids, pages, total } = await allPages(api);
    expect(pages).toBe(50);
    expect(total).toBe(1000);
    expect(ids).toHaveLength(1000);
    expect(new Set(ids).size).toBe(1000);
  });

  it('every page has 20 items and hasMore flips on the last one', async () => {
    const api = instant();
    const first = await api.getProductsPage({ page: 0 });
    const last = await api.getProductsPage({ page: 49 });
    const beyond = await api.getProductsPage({ page: 50 });
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(last.items).toHaveLength(20);
    expect(last.hasMore).toBe(false);
    expect(beyond.items).toHaveLength(0);
  });

  it('pageSize is configurable', async () => {
    const res = await instant().getProductsPage({ page: 0, pageSize: 7 });
    expect(res.items).toHaveLength(7);
  });
});

describe('filters and sort', () => {
  it('a category gives 125 products, all of that category', async () => {
    const api = instant();
    const { ids, total } = await allPages(api, { category: 'skincare' });
    expect(total).toBe(125);
    const byId = getCatalog().byId;
    expect(ids.every((id) => byId.get(id)?.category === 'skincare')).toBe(true);
  });

  it('filters combine, and countProducts agrees with total', async () => {
    const api = instant();
    const query: ProductQuery = {
      filters: { categories: ['vitamins', 'fitness'], priceMin: 50, priceMax: 150, inStockOnly: true, minRating: 4 },
    };
    const { ids, total } = await allPages(api, query);
    expect(total).toBe(api.countProducts(query));
    expect(ids).toHaveLength(total);
    for (const id of ids) {
      const p = getCatalog().byId.get(id);
      expect(['vitamins', 'fitness']).toContain(p?.category);
      expect(p?.price).toBeGreaterThanOrEqual(50);
      expect(p?.price).toBeLessThanOrEqual(150);
      expect(p?.inStock).toBe(true);
      expect(p?.rating).toBeGreaterThanOrEqual(4);
    }
  });

  it('an impossible filter returns an empty first page (the empty state)', async () => {
    const res = await instant().getProductsPage({ page: 0, filters: { priceMin: 5000 } });
    expect(res.items).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.hasMore).toBe(false);
  });

  it.each(SORT_KEYS.map((k) => [k]))('sort %s is a total order across pages', async (sort) => {
    const api = instant();
    const { ids } = await allPages(api, { sort });
    const byId = getCatalog().byId;
    const list = ids.map((id) => byId.get(id));
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      if (a === undefined || b === undefined) throw new Error('missing product');
      if (sort === 'priceAsc') expect(a.price).toBeLessThanOrEqual(b.price);
      if (sort === 'priceDesc') expect(a.price).toBeGreaterThanOrEqual(b.price);
      if (sort === 'rating') expect(a.rating).toBeGreaterThanOrEqual(b.rating);
      if (sort === 'relevance') expect(a.id < b.id).toBe(true);
    }
    expect(new Set(ids).size).toBe(1000);
  });

  it('queryKeyOf ignores the order of selected categories', () => {
    expect(queryKeyOf({ filters: { categories: ['fitness', 'vitamins'] } })).toBe(
      queryKeyOf({ filters: { categories: ['vitamins', 'fitness'] } }),
    );
    expect(queryKeyOf({ sort: 'priceAsc' })).not.toBe(queryKeyOf({ sort: 'priceDesc' }));
  });
});

describe('failures (D-05)', () => {
  it('failEvery makes exactly every Nth request fail with FakeNetworkError', async () => {
    const api = createFakeApi({ delayMs: [0, 0], failEvery: 3 });
    const outcomes: string[] = [];
    for (let page = 0; page < 6; page++) {
      try {
        await api.getProductsPage({ page });
        outcomes.push('ok');
      } catch (e) {
        expect(e).toBeInstanceOf(FakeNetworkError);
        outcomes.push('fail');
      }
    }
    expect(outcomes).toEqual(['ok', 'ok', 'fail', 'ok', 'ok', 'fail']);
  });

  it('failOffset moves the first failure', async () => {
    const api = createFakeApi({ delayMs: [0, 0], failEvery: 3, failOffset: 2 });
    await expect(api.getProductsPage({ page: 0 })).rejects.toThrow('Request to products failed');
  });

  it('banners and categories never fail', async () => {
    const api = createFakeApi({ delayMs: [0, 0], failEvery: 1 });
    await expect(api.getBanners()).resolves.toHaveLength(BANNERS.length);
    await expect(api.getCategories()).resolves.toBe(CATEGORIES);
  });

  it('chaos 0.05 fails roughly 1 in 20, with the same pattern for the same seed', async () => {
    const pattern = async () => {
      const api = createFakeApi({ delayMs: [0, 0] });
      const out: boolean[] = [];
      for (let i = 0; i < 1000; i++) {
        out.push(
          await api.getBestSellers().then(
            () => true,
            () => false,
          ),
        );
      }
      return out;
    };
    const first = await pattern();
    const failures = first.filter((ok) => !ok).length;
    expect(failures).toBeGreaterThan(25);
    expect(failures).toBeLessThan(80);
    expect(await pattern()).toEqual(first);
  });

  it('failureSeed moves which requests fail but leaves the products alone (ADR-048)', async () => {
    const outcomes = async (failureSeed: number) => {
      const api = createFakeApi({ delayMs: [0, 0], failureSeed });
      const out: boolean[] = [];
      for (let i = 0; i < 200; i++) {
        out.push(await api.getBestSellers().then(() => true, () => false));
      }
      return out;
    };
    expect(await outcomes(1)).not.toEqual(await outcomes(2));
    const a = createFakeApi({ delayMs: [0, 0], chaos: 0, failureSeed: 1 });
    const b = createFakeApi({ delayMs: [0, 0], chaos: 0, failureSeed: 2 });
    expect(await a.getProductsPage({ page: 0 })).toEqual(await b.getProductsPage({ page: 0 }));
  });

  it('chaos 0 never fails', async () => {
    const api = instant();
    for (let i = 0; i < 200; i++) await api.getBestSellers();
  });

  it('the debug switch forces failures on demand', async () => {
    const api = instant();
    api.debug.forceFailure = true;
    await expect(api.getProductsPage({ page: 0 })).rejects.toBeInstanceOf(FakeNetworkError);
    api.debug.forceFailure = false;
    await expect(api.getProductsPage({ page: 0 })).resolves.toMatchObject({ page: 0 });
  });

  it('an unknown product id rejects', async () => {
    await expect(instant().getProductById('p-9999')).rejects.toThrow('No product p-9999');
    await expect(instant().getProductById('p-0007')).resolves.toMatchObject({ id: 'p-0007' });
  });
});

describe('latency (D-04)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('every request takes between 300 and 800 ms', async () => {
    jest.useFakeTimers();
    const api = createFakeApi({ chaos: 0 });
    for (let i = 0; i < 40; i++) {
      let settled = false;
      const pending = api.getProductsPage({ page: 0 }).then(() => {
        settled = true;
      });
      await jest.advanceTimersByTimeAsync(299);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(501);
      expect(settled).toBe(true);
      await pending;
    }
  });

  it('slow mode multiplies the delay by 4', async () => {
    jest.useFakeTimers();
    const api = createFakeApi({ chaos: 0, delayMs: [500, 500] });
    api.debug.slow = true;
    let settled = false;
    const pending = api.getBestSellers().then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await pending;
  });
});

describe('build-time failure rate (ADR-040)', () => {
  it('keeps the brief default of 1 in 20 when the variable is unset or blank', () => {
    expect(DEFAULT_CHAOS).toBe(0.05);
    expect(parseChaos(undefined)).toBe(0.05);
    expect(parseChaos('')).toBe(0.05);
    expect(parseChaos('   ')).toBe(0.05);
  });

  it('accepts any number from 0 to 1, so the perf build can turn failures off', () => {
    expect(parseChaos('0')).toBe(0);
    expect(parseChaos('0.2')).toBe(0.2);
    expect(parseChaos('1')).toBe(1);
  });

  it('ignores values that are not a probability', () => {
    for (const raw of ['-0.1', '1.5', 'off', 'NaN', 'Infinity', '5%']) {
      expect(parseChaos(raw)).toBe(0.05);
    }
  });
});
