/**
 * The fake backend (D-03…D-05). Everything is local and deterministic, but it behaves like a network:
 * every call waits 300–800 ms and about 1 in 20 calls fails, so loading and error states are real.
 *
 * Delays and failures use their own seeded streams, separate from the catalog stream, so a test can
 * pin them (`delayMs: [0, 0]`, `failEvery: 3`) without touching the products.
 */
import { deriveSeed, mulberry32, type Rng } from '../rng';
import { BANNERS, CATEGORIES, PAGE_SIZE, discountPercent, getCatalog } from '../catalog';
import type { Banner, Category, CategoryId, Product } from '../catalog';

import { searchCatalog, searchTextOf } from '../catalog/search';
import { queryKeyOf } from './types';
import type { CatalogApi, PageRequest, ProductPage, ProductQuery, SortKey } from './types';

// Re-exported so existing imports from './fakeApi' keep working.
export { SORT_KEYS, queryKeyOf } from './types';
export type { PageRequest, ProductFilters, ProductPage, ProductQuery, SortKey } from './types';

export class FakeNetworkError extends Error {
  constructor(endpoint: string) {
    super(`Request to ${endpoint} failed`);
    this.name = 'FakeNetworkError';
  }
}

export interface FakeApiOptions {
  seed?: number;
  /** Inclusive range of the simulated latency. Tests pass [0, 0]. */
  delayMs?: readonly [number, number];
  /** Deterministic failures for tests: the Nth, 2Nth… request fails. Overrides `chaos`. */
  failEvery?: number;
  /** Shifts which request fails first when `failEvery` is set. */
  failOffset?: number;
  /** Probability that a request fails at runtime (0.05 ≈ 1 in 20). */
  chaos?: number;
  /**
   * Seed for the failure stream only. Defaults to `seed`, so tests stay repeatable. The app passes a
   * per-launch value: with the fixed seed, request #1 failed on every launch (ADR-048).
   */
  failureSeed?: number;
}

/** The brief's failure rate: about 1 request in 20. */
export const DEFAULT_CHAOS = 0.05;

/**
 * Reads the failure rate from a build-time string (`EXPO_PUBLIC_FAKE_API_CHAOS`). Perf builds set
 * it to 0 so a scripted 1,000-item scroll is not stopped by an error row (docs/DECISIONS.md ADR-040).
 * Anything that is not a number from 0 to 1 keeps the brief's default.
 */
export function parseChaos(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_CHAOS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_CHAOS;
}

/** Dev-only switches (debug panel) to show the error and slow states on demand. */
export interface FakeApiDebug {
  forceFailure: boolean;
  slow: boolean;
}

const DELAY_SALT = 0xde1a;
const FAILURE_SALT = 0xfa11;
const QUERY_CACHE_SIZE = 8;
/** Counts are one number each, so they get their own, larger memo and never push a page list out. */
const COUNT_CACHE_SIZE = 32;

function sameCategories(p: Product, wanted: readonly CategoryId[] | undefined): boolean {
  return wanted === undefined || wanted.length === 0 || wanted.includes(p.category);
}

function matches(p: Product, query: ProductQuery): boolean {
  const f = query.filters ?? {};
  if (query.category !== undefined && p.category !== query.category) return false;
  if (!sameCategories(p, f.categories)) return false;
  if (f.priceMin !== undefined && p.price < f.priceMin) return false;
  if (f.priceMax !== undefined && p.price > f.priceMax) return false;
  if (f.inStockOnly === true && !p.inStock) return false;
  if (f.minRating !== undefined && p.rating < f.minRating) return false;
  return true;
}

/** Every comparator falls back to id order, so the result never depends on sort stability. */
const COMPARATORS: Record<SortKey, (a: Product, b: Product) => number> = {
  relevance: (a, b) => a.id.localeCompare(b.id),
  priceAsc: (a, b) => a.price - b.price || a.id.localeCompare(b.id),
  priceDesc: (a, b) => b.price - a.price || a.id.localeCompare(b.id),
  rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews || a.id.localeCompare(b.id),
  discount: (a, b) => discountPercent(b) - discountPercent(a) || a.id.localeCompare(b.id),
};

/** The offline backend: the shared contract plus the synchronous extras only local data can offer. */
export interface FakeApi extends CatalogApi {
  readonly kind: 'fake';
  readonly debug: FakeApiDebug;
  /** Synchronous count (kept under its original name for existing callers). */
  countProducts(query: ProductQuery): number;
  countSync(query: ProductQuery): number;
}

export function createFakeApi(options: FakeApiOptions = {}): FakeApi {
  const seed = options.seed ?? 20261116;
  const [minDelay, maxDelay] = options.delayMs ?? [300, 800];
  const chaos = options.chaos ?? DEFAULT_CHAOS;
  const delayRng: Rng = mulberry32(deriveSeed(seed, DELAY_SALT));
  const failureRng: Rng = mulberry32(deriveSeed(options.failureSeed ?? seed, FAILURE_SALT));
  const debug: FakeApiDebug = { forceFailure: false, slow: false };
  const results = new Map<string, readonly Product[]>();
  const counts = new Map<string, number>();
  let requestCount = 0;

  function shouldFail(): boolean {
    requestCount += 1;
    if (debug.forceFailure) return true;
    if (options.failEvery !== undefined && options.failEvery > 0) {
      return (requestCount + (options.failOffset ?? 0)) % options.failEvery === 0;
    }
    return failureRng() < chaos;
  }

  function wait(): Promise<void> {
    const ms = minDelay + delayRng() * (maxDelay - minDelay);
    const total = debug.slow ? ms * 4 : ms;
    if (total <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, total));
  }

  /** Simulated round trip: decide the outcome up front (deterministic order), then wait, then answer. */
  async function request<T>(endpoint: string, answer: () => T, canFail = true): Promise<T> {
    const fails = canFail && shouldFail();
    await wait();
    if (fails) throw new FakeNetworkError(endpoint);
    return answer();
  }

  function resultsFor(query: ProductQuery): readonly Product[] {
    const key = queryKeyOf(query);
    const hit = results.get(key);
    if (hit) return hit;
    const list = getCatalog()
      .products.filter((p) => matches(p, query))
      .sort(COMPARATORS[query.sort ?? 'relevance']);
    if (results.size >= QUERY_CACHE_SIZE) {
      const oldest = results.keys().next().value;
      if (oldest !== undefined) results.delete(oldest);
    }
    results.set(key, list);
    return list;
  }

  let searchTexts: Map<string, string> | null = null;
  function searchTextFor(p: Product): string {
    if (searchTexts === null) {
      searchTexts = new Map(getCatalog().products.map((x) => [x.id, searchTextOf(x)]));
    }
    return searchTexts.get(p.id) ?? searchTextOf(p);
  }

  function countSync(query: ProductQuery): number {
    const key = queryKeyOf({ category: query.category, filters: query.filters });
    const hit = counts.get(key);
    if (hit !== undefined) return hit;
    let count = 0;
    for (const p of getCatalog().products) if (matches(p, query)) count += 1;
    if (counts.size >= COUNT_CACHE_SIZE) {
      const oldest = counts.keys().next().value;
      if (oldest !== undefined) counts.delete(oldest);
    }
    counts.set(key, count);
    return count;
  }

  return {
    kind: 'fake',
    debug,

    getProductsPage({ page, pageSize = PAGE_SIZE, ...query }: PageRequest): Promise<ProductPage> {
      return request('products', () => {
        const all = resultsFor(query);
        const start = page * pageSize;
        return {
          items: all.slice(start, start + pageSize),
          page,
          hasMore: start + pageSize < all.length,
          total: all.length,
        };
      });
    },

    /**
     * How many products a query would return; drives the sheet's "Show 312 products" button.
     * Synchronous on purpose. A count does not depend on the order, so it is one filter pass with no
     * sort, memoised apart from the page lists: tapping through filter chips never evicts the list
     * the grid is paging through.
     */
    countProducts: countSync,
    countSync,

    /** The same count as a call, for code that must also work against a real backend. Never fails. */
    fetchCount(query: ProductQuery): Promise<number> {
      return Promise.resolve(countSync(query));
    },

    getBestSellers(): Promise<readonly Product[]> {
      return request('best-sellers', () => getCatalog().bestSellers);
    },

    getProductById(id: string): Promise<Product> {
      return request(`products/${id}`, () => {
        const product = getCatalog().byId.get(id);
        if (!product) throw new Error(`No product ${id}`);
        return product;
      });
    },

    getBanners(): Promise<readonly Banner[]> {
      return request('banners', () => BANNERS, false);
    },

    /** Static and instant: categories ship with the app. */
    getCategories(): Promise<readonly Category[]> {
      return Promise.resolve(CATEGORIES);
    },

    /** Same normalisation and ranking as the SQL `search_products` (src/core/catalog/search.ts). */
    searchProducts(query: string, limit?: number): Promise<readonly Product[]> {
      return request('search', () => searchCatalog(getCatalog().products, query, limit, searchTextFor));
    },
  };
}

