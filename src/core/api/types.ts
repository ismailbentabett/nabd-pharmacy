/**
 * The catalog contract both backends implement: the offline fake (`fakeApi.ts`) and Supabase
 * (`supabaseApi.ts`). Screens only ever see `CatalogApi`, so swapping the backend is one line in
 * `src/state/api.ts` and no screen changes.
 */
import type { Banner, Category, CategoryId, Product } from '../catalog/types';

export type SortKey = 'relevance' | 'priceAsc' | 'priceDesc' | 'rating' | 'discount';
export const SORT_KEYS: readonly SortKey[] = ['relevance', 'priceAsc', 'priceDesc', 'rating', 'discount'];

export interface ProductFilters {
  /** Empty or missing = every category. */
  categories?: readonly CategoryId[];
  /** SAR, inclusive. */
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  /** e.g. 4 = "4 stars and up". */
  minRating?: number;
}

export interface ProductQuery {
  category?: CategoryId;
  sort?: SortKey;
  filters?: ProductFilters;
}

export interface PageRequest extends ProductQuery {
  /** 0-based. */
  page: number;
  pageSize?: number;
}

export interface ProductPage {
  items: Product[];
  page: number;
  hasMore: boolean;
  /** Number of products matching the query (all pages). */
  total: number;
}

/** Stable string key for a query, used for result caches and as part of React Query keys. */
export function queryKeyOf(query: ProductQuery): string {
  const f = query.filters ?? {};
  return JSON.stringify([
    query.category ?? null,
    query.sort ?? 'relevance',
    [...(f.categories ?? [])].sort(),
    f.priceMin ?? null,
    f.priceMax ?? null,
    f.inStockOnly === true,
    f.minRating ?? null,
  ]);
}

/** A failed backend call, with the endpoint it came from. The UI shows one retry state for all of them. */
export class BackendError extends Error {
  readonly endpoint: string;
  /** Postgres / PostgREST code when the server gave one (e.g. `22023`, `PGRST116`). */
  readonly code: string | undefined;

  constructor(endpoint: string, message: string, code?: string) {
    super(`Request to ${endpoint} failed: ${message}`);
    this.name = 'BackendError';
    this.endpoint = endpoint;
    this.code = code;
  }
}

export interface CatalogApi {
  /** Which backend is live; shown on the Account screen so a demo is honest about it. */
  readonly kind: 'fake' | 'supabase';
  getProductsPage(request: PageRequest): Promise<ProductPage>;
  /** How many products match (all pages); drives the sheet's "Show 312 products" button. */
  fetchCount(query: ProductQuery): Promise<number>;
  /** Instant count when the data is on the device (fake backend only). */
  countSync?: (query: ProductQuery) => number;
  getBestSellers(): Promise<readonly Product[]>;
  getProductById(id: string): Promise<Product>;
  getBanners(): Promise<readonly Banner[]>;
  getCategories(): Promise<readonly Category[]>;
  /** Bilingual search. Same normalisation and ranking on both backends. */
  searchProducts(query: string, limit?: number): Promise<readonly Product[]>;
}
