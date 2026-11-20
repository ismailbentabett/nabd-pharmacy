/**
 * The catalog on Supabase (Postgres + PostgREST). Same contract as the offline fake, so screens
 * do not know which one is live.
 *
 * Money crosses the wire as integer centimes (`price_h`) and becomes DA only here, at the boundary,
 * because the app's `Product` keeps the brief's float price shape (D-02). Every sort ends on `id`, so a page
 * boundary never shows the same product twice.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { PAGE_SIZE } from '../catalog';
import { clampSearchLimit } from '../catalog/search';
import type { Banner, Category, CategoryId, Product } from '../catalog/types';
import { toCentimes } from '../money';
import {
  BackendError,
  type CatalogApi,
  type PageRequest,
  type ProductPage,
  type ProductQuery,
  type SortKey,
} from './types';

/** One row of `public.products`, as PostgREST returns it. */
export interface ProductRow {
  id: string;
  sku: string;
  name_en: string;
  name_ar: string;
  brand_en: string;
  brand_ar: string;
  category_id: string;
  price_h: number;
  old_price_h: number | null;
  discount_pct: number;
  /** numeric(2,1); PostgREST sends it as a JSON number. */
  rating: number | string;
  reviews: number;
  in_stock: boolean;
  images: string[];
  description_en: string;
  description_ar: string;
  dominant_color: string;
  best_seller_rank: number | null;
}

export interface CategoryRow {
  id: string;
  name_en: string;
  name_ar: string;
  icon: string;
  price_min_h: number;
  price_max_h: number;
  sort: number;
}

export interface BannerRow {
  id: string;
  title_en: string;
  sub_en: string;
  cta_en: string;
  title_ar: string;
  sub_ar: string;
  cta_ar: string;
  category_id: string | null;
  tint: 'primary' | 'secondary';
  sort: number;
}

/** Only the columns `Product` needs; `search_text` stays on the server. */
export const PRODUCT_COLUMNS =
  'id, sku, name_en, name_ar, brand_en, brand_ar, category_id, price_h, old_price_h, discount_pct, ' +
  'rating, reviews, in_stock, images, description_en, description_ar, dominant_color, best_seller_rank';

const fromCentimes = (h: number) => h / 100;

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name_en,
    nameAr: row.name_ar,
    brand: row.brand_en,
    brandAr: row.brand_ar,
    category: row.category_id as CategoryId,
    price: fromCentimes(row.price_h),
    oldPrice: row.old_price_h === null ? null : fromCentimes(row.old_price_h),
    currency: 'DZD',
    rating: Number(row.rating),
    reviews: row.reviews,
    inStock: row.in_stock,
    images: row.images,
    descriptionEn: row.description_en,
    descriptionAr: row.description_ar,
    dominantColor: row.dominant_color,
  };
}

export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id as CategoryId,
    en: row.name_en,
    ar: row.name_ar,
    icon: row.icon,
    priceMin: fromCentimes(row.price_min_h),
    priceMax: fromCentimes(row.price_max_h),
  };
}

export function rowToBanner(row: BannerRow): Banner {
  return {
    id: row.id,
    en: { title: row.title_en, sub: row.sub_en, cta: row.cta_en },
    ar: { title: row.title_ar, sub: row.sub_ar, cta: row.cta_ar },
    category: row.category_id as CategoryId | null,
    tint: row.tint,
  };
}

/** Column order per sort key; mirrors COMPARATORS in fakeApi.ts. */
export const SORT_ORDER: Readonly<Record<SortKey, readonly { column: string; ascending: boolean }[]>> = {
  relevance: [{ column: 'id', ascending: true }],
  priceAsc: [
    { column: 'price_h', ascending: true },
    { column: 'id', ascending: true },
  ],
  priceDesc: [
    { column: 'price_h', ascending: false },
    { column: 'id', ascending: true },
  ],
  rating: [
    { column: 'rating', ascending: false },
    { column: 'reviews', ascending: false },
    { column: 'id', ascending: true },
  ],
  discount: [
    { column: 'discount_pct', ascending: false },
    { column: 'id', ascending: true },
  ],
};

/**
 * The filter methods of a PostgREST builder that we use. Typed narrowly (and not generically: the
 * real builder's types are too deep for a recursive constraint) so tests can pass a small fake.
 */
export interface FilterBuilder {
  eq(column: string, value: unknown): FilterBuilder;
  in(column: string, values: readonly unknown[]): FilterBuilder;
  gte(column: string, value: unknown): FilterBuilder;
  lte(column: string, value: unknown): FilterBuilder;
}

/** Adds the query's filters. Every PostgREST filter returns the same builder type it was called on. */
export function applyFilters<T>(builder: T, query: ProductQuery): T {
  const f = query.filters ?? {};
  let b = builder as unknown as FilterBuilder;
  if (query.category !== undefined) b = b.eq('category_id', query.category);
  if (f.categories !== undefined && f.categories.length > 0) b = b.in('category_id', f.categories);
  if (f.priceMin !== undefined) b = b.gte('price_h', toCentimes(f.priceMin));
  if (f.priceMax !== undefined) b = b.lte('price_h', toCentimes(f.priceMax));
  if (f.inStockOnly === true) b = b.eq('in_stock', true);
  if (f.minRating !== undefined) b = b.gte('rating', f.minRating);
  return b as unknown as T;
}

interface PostgrestFailure {
  message: string;
  code?: string;
}

function fail(endpoint: string, error: PostgrestFailure): never {
  throw new BackendError(endpoint, error.message, error.code);
}

export interface SupabaseApi extends CatalogApi {
  readonly kind: 'supabase';
}

export function createSupabaseApi(supabase: SupabaseClient): SupabaseApi {
  const products = () => supabase.from('products');

  return {
    kind: 'supabase',

    async getProductsPage({ page, pageSize = PAGE_SIZE, ...query }: PageRequest): Promise<ProductPage> {
      const from = page * pageSize;
      let builder = applyFilters(
        products().select(PRODUCT_COLUMNS, { count: 'exact' }),
        query,
      );
      for (const { column, ascending } of SORT_ORDER[query.sort ?? 'relevance']) {
        builder = builder.order(column, { ascending });
      }
      const { data, error, count } = await builder.range(from, from + pageSize - 1);
      if (error) fail('products', error);
      const rows = (data ?? []) as unknown as ProductRow[];
      const total = count ?? from + rows.length;
      return {
        items: rows.map(rowToProduct),
        page,
        hasMore: from + rows.length < total,
        total,
      };
    },

    async fetchCount(query: ProductQuery): Promise<number> {
      const { count, error } = await applyFilters(
        products().select('id', { count: 'exact', head: true }),
        query,
      );
      if (error) fail('products/count', error);
      return count ?? 0;
    },

    async getBestSellers(): Promise<readonly Product[]> {
      const { data, error } = await products()
        .select(PRODUCT_COLUMNS)
        .not('best_seller_rank', 'is', null)
        .order('best_seller_rank', { ascending: true });
      if (error) fail('best-sellers', error);
      return ((data ?? []) as unknown as ProductRow[]).map(rowToProduct);
    },

    async getProductById(id: string): Promise<Product> {
      const { data, error } = await products().select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
      if (error) fail(`products/${id}`, error);
      if (data === null) throw new BackendError(`products/${id}`, 'not found', 'PGRST116');
      return rowToProduct(data as unknown as ProductRow);
    },

    async getBanners(): Promise<readonly Banner[]> {
      const { data, error } = await supabase
        .from('banners')
        .select('id, title_en, sub_en, cta_en, title_ar, sub_ar, cta_ar, category_id, tint, sort')
        .order('sort', { ascending: true });
      if (error) fail('banners', error);
      return ((data ?? []) as unknown as BannerRow[]).map(rowToBanner);
    },

    async getCategories(): Promise<readonly Category[]> {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_en, name_ar, icon, price_min_h, price_max_h, sort')
        .order('sort', { ascending: true });
      if (error) fail('categories', error);
      return ((data ?? []) as unknown as CategoryRow[]).map(rowToCategory);
    },

    async searchProducts(query: string, limit?: number): Promise<readonly Product[]> {
      if (query.trim() === '') return [];
      const { data, error } = await supabase.rpc('search_products', {
        query,
        max_results: clampSearchLimit(limit),
      });
      if (error) fail('search', error);
      return ((data ?? []) as unknown as ProductRow[]).map(rowToProduct);
    },
  };
}
