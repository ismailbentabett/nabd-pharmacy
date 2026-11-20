/**
 * Typed view over the shared fixture. The JSON lives in docs/fixtures so the spec, the tests
 * and the app read one source of truth (ADR-018).
 */
import raw from '../../../docs/fixtures/catalog-seed.json';
import type { Banner, Category, CategoryId } from './types';

type Pair = readonly [en: string, ar: string];

export interface BrandSeed {
  en: string;
  ar: string;
  for: readonly CategoryId[];
}

export interface CatalogSeed {
  seed: number;
  pageSize: number;
  total: number;
  perCategory: number;
  categories: readonly Category[];
  brands: readonly BrandSeed[];
  types: Readonly<Record<CategoryId, readonly Pair[]>>;
  variants: Readonly<Record<CategoryId, readonly Pair[]>>;
  descriptions: Readonly<Record<CategoryId, Pair>>;
  banners: readonly Banner[];
}

// The JSON import is typed structurally by TypeScript (string instead of the CategoryId union),
// so it is narrowed once here. tests/catalog.test.ts checks the fixture matches these assumptions.
export const SEED = raw as unknown as CatalogSeed;
