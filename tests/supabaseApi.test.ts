/**
 * The Supabase catalog adapter, without a network: a recording fake stands in for the PostgREST
 * builder, so each test checks the exact filters/sorts sent and how rows come back as `Product`s.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { applyFilters, createSupabaseApi, rowToBanner, rowToProduct, SORT_ORDER, type FilterBuilder, type ProductRow } from '@/core/api/supabaseApi';
import { BackendError, SORT_KEYS } from '@/core/api/types';
import { BANNERS, discountPercent, getCatalog, pickBestSellers } from '@/core/catalog';
import type { Product } from '@/core/catalog';
import { toCentimes } from '@/core/money';

type Call = [method: string, ...args: unknown[]];
type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

/** A chainable stand-in for a PostgREST query: records every call, resolves to `result` when awaited. */
function fakeQuery(result: Result) {
  const calls: Call[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'not', 'maybeSingle']) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.then = (resolve: (r: Result) => unknown) => resolve({ data: null, error: null, count: null, ...result });
  return { query, calls };
}

function fakeClient(result: Result) {
  const { query, calls } = fakeQuery(result);
  const tables: string[] = [];
  const rpcs: [string, unknown][] = [];
  const client = {
    from: (table: string) => {
      tables.push(table);
      return query;
    },
    rpc: (name: string, args: unknown) => {
      rpcs.push([name, args]);
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls, tables, rpcs };
}

/** The row Postgres holds for a catalog product (what supabase/seed.sql inserts). */
function rowOf(p: Product, rank: number | null = null): ProductRow {
  return {
    id: p.id,
    sku: p.sku,
    name_en: p.name,
    name_ar: p.nameAr,
    brand_en: p.brand,
    brand_ar: p.brandAr,
    category_id: p.category,
    price_h: toCentimes(p.price),
    old_price_h: p.oldPrice === null ? null : toCentimes(p.oldPrice),
    discount_pct: discountPercent(p),
    // numeric(2,1) can arrive as a string from some PostgREST versions; both must work.
    rating: p.rating.toFixed(1),
    reviews: p.reviews,
    in_stock: p.inStock,
    images: [...p.images],
    description_en: p.descriptionEn,
    description_ar: p.descriptionAr,
    dominant_color: p.dominantColor,
    best_seller_rank: rank,
  };
}

const products = getCatalog().products;

describe('rowToProduct', () => {
  it('turns every seeded row back into exactly the offline product (money, rating, images)', () => {
    for (const p of products) expect(rowToProduct(rowOf(p))).toEqual(p);
  });

  it('keeps a null old price null', () => {
    const p = products.find((x) => x.oldPrice === null)!;
    expect(rowToProduct(rowOf(p)).oldPrice).toBeNull();
  });
});

describe('rowToBanner', () => {
  it('round-trips the seeded banners', () => {
    for (const [i, b] of BANNERS.entries()) {
      const back = rowToBanner({
        id: b.id,
        title_en: b.en.title,
        sub_en: b.en.sub,
        cta_en: b.en.cta,
        title_ar: b.ar.title,
        sub_ar: b.ar.sub,
        cta_ar: b.ar.cta,
        category_id: b.category,
        tint: b.tint,
        sort: i,
      });
      expect(back).toEqual(b);
    }
  });
});

describe('applyFilters', () => {
  const record = () => {
    const calls: Call[] = [];
    const builder: FilterBuilder = {
      eq: (...a) => (calls.push(['eq', ...a]), builder),
      in: (...a) => (calls.push(['in', ...a]), builder),
      gte: (...a) => (calls.push(['gte', ...a]), builder),
      lte: (...a) => (calls.push(['lte', ...a]), builder),
    };
    return { builder, calls };
  };

  it('sends nothing for an empty query', () => {
    const { builder, calls } = record();
    expect(applyFilters(builder, {})).toBe(builder);
    expect(calls).toEqual([]);
  });

  it('maps every filter to its column, with prices in centimes', () => {
    const { builder, calls } = record();
    applyFilters(builder, {
      category: 'vitamins',
      filters: { categories: ['skincare', 'fitness'], priceMin: 49.95, priceMax: 100, inStockOnly: true, minRating: 4 },
    });
    expect(calls).toEqual([
      ['eq', 'category_id', 'vitamins'],
      ['in', 'category_id', ['skincare', 'fitness']],
      ['gte', 'price_h', 4995],
      ['lte', 'price_h', 10000],
      ['eq', 'in_stock', true],
      ['gte', 'rating', 4],
    ]);
  });

  it('ignores an empty category list and inStockOnly false', () => {
    const { builder, calls } = record();
    applyFilters(builder, { filters: { categories: [], inStockOnly: false } });
    expect(calls).toEqual([]);
  });
});

describe('SORT_ORDER', () => {
  it('covers every sort key and always ends on id, so pages never overlap', () => {
    for (const key of SORT_KEYS) {
      const order = SORT_ORDER[key];
      expect(order.at(-1)).toEqual({ column: 'id', ascending: true });
    }
  });
});

describe('createSupabaseApi', () => {
  it('reports itself as the supabase backend', () => {
    expect(createSupabaseApi(fakeClient({}).client).kind).toBe('supabase');
  });

  it('asks for one page by range, with an exact count, and computes hasMore from it', async () => {
    const rows = products.slice(20, 40).map((p) => rowOf(p));
    const { client, calls, tables } = fakeClient({ data: rows, count: 1000 });
    const page = await createSupabaseApi(client).getProductsPage({ page: 1, sort: 'priceAsc' });

    expect(tables).toEqual(['products']);
    expect(calls[0]?.[0]).toBe('select');
    expect(calls[0]?.[2]).toEqual({ count: 'exact' });
    expect(calls.filter((c) => c[0] === 'order')).toEqual([
      ['order', 'price_h', { ascending: true }],
      ['order', 'id', { ascending: true }],
    ]);
    expect(calls.at(-1)).toEqual(['range', 20, 39]);
    expect(page).toEqual({ items: products.slice(20, 40), page: 1, hasMore: true, total: 1000 });
  });

  it('says there is no more on the last page', async () => {
    const rows = products.slice(0, 7).map((p) => rowOf(p));
    const { client } = fakeClient({ data: rows, count: 7 });
    const page = await createSupabaseApi(client).getProductsPage({ page: 0 });
    expect(page.hasMore).toBe(false);
    expect(page.total).toBe(7);
  });

  it('turns a PostgREST error into a BackendError with its code', async () => {
    const { client } = fakeClient({ error: { message: 'boom', code: '57014' } });
    const failure = createSupabaseApi(client).getProductsPage({ page: 0 });
    await expect(failure).rejects.toBeInstanceOf(BackendError);
    await expect(failure).rejects.toMatchObject({ endpoint: 'products', code: '57014' });
  });

  it('counts with a head request and the same filters', async () => {
    const { client, calls } = fakeClient({ count: 312 });
    const count = await createSupabaseApi(client).fetchCount({ filters: { inStockOnly: true } });
    expect(count).toBe(312);
    expect(calls).toEqual([
      ['select', 'id', { count: 'exact', head: true }],
      ['eq', 'in_stock', true],
    ]);
  });

  it('loads best sellers by rank', async () => {
    const best = pickBestSellers(products);
    const { client, calls } = fakeClient({ data: best.map((p, i) => rowOf(p, i + 1)) });
    expect(await createSupabaseApi(client).getBestSellers()).toEqual(best);
    expect(calls).toContainEqual(['not', 'best_seller_rank', 'is', null]);
    expect(calls).toContainEqual(['order', 'best_seller_rank', { ascending: true }]);
  });

  it('throws not-found for a missing product id', async () => {
    const { client } = fakeClient({ data: null });
    await expect(createSupabaseApi(client).getProductById('p-9999')).rejects.toMatchObject({ code: 'PGRST116' });
  });

  it('searches through the search_products function with a clamped limit, and skips blank queries', async () => {
    const hit = products[3]!;
    const { client, rpcs } = fakeClient({ data: [rowOf(hit)] });
    const api = createSupabaseApi(client);
    expect(await api.searchProducts('   ')).toEqual([]);
    expect(rpcs).toEqual([]);
    expect(await api.searchProducts('omega', 500)).toEqual([hit]);
    expect(rpcs).toEqual([['search_products', { query: 'omega', max_results: 100 }]]);
  });
});
