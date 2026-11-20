/**
 * The catalog is generated once, on first use, and then shared. ~1,000 small objects; the
 * product page looks products up by id in O(1) without waiting for any page to load.
 */
import { generateCatalog, pickBestSellers } from './generate';
import { SEED } from './seed';
import type { Banner, Category, CategoryId, Product } from './types';

export type { Banner, BannerCopy, Category, CategoryId, Product } from './types';
export { discountPercent, generateCatalog, pickBestSellers, productId } from './generate';
export { IMAGE_BUCKETS, imageBucket, imageUri } from './images';

interface CatalogIndex {
  products: readonly Product[];
  byId: ReadonlyMap<string, Product>;
  bestSellers: readonly Product[];
}

let cached: CatalogIndex | null = null;

export function getCatalog(): CatalogIndex {
  if (cached === null) {
    const products = generateCatalog(SEED);
    cached = {
      products,
      byId: new Map(products.map((p) => [p.id, p])),
      bestSellers: pickBestSellers(products),
    };
  }
  return cached;
}

/** Synchronous lookup for UI that already has an id (grid → product, cart rows). */
export function findProduct(id: string): Product | undefined {
  return getCatalog().byId.get(id);
}

export const CATEGORIES: readonly Category[] = SEED.categories;
export const BANNERS: readonly Banner[] = SEED.banners;
export const PAGE_SIZE = SEED.pageSize;

export function categoryById(id: CategoryId): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
