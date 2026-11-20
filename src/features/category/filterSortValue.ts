/**
 * The Category screen's `{ sort, filters }` value and the plain rules around it. The screen owns the
 * value, the filter & sort sheet edits a draft of it, and Home's category rail changes it through a
 * route param. No React here, so every rule is unit tested on its own.
 *
 * Prices: the sheet's bands are in halalas; they become SAR only for the API query and the labels.
 */
import type { ProductFilters, SortKey } from '@/core/api/fakeApi';
import { CATEGORIES, categoryById, type Category, type CategoryId } from '@/core/catalog';
import { toHalalas, type Halalas } from '@/core/money';

export type FilterSortValue = { sort: SortKey; filters: ProductFilters };

/** The catalogue's own order, nothing filtered: the screen's starting value and what Reset goes back to. */
export const NO_FILTERS: FilterSortValue = { sort: 'relevance', filters: {} };

/** A price band [from, to) in halalas; a missing edge is open-ended. */
export type PriceBand = Readonly<{ from?: Halalas; to?: Halalas }>;

/** Four bands of roughly equal size over the seeded catalogue (about 370 / 280 / 210 / 150 items). */
export const PRICE_BANDS: readonly PriceBand[] = [{ to: 5000 }, { from: 5000, to: 10000 }, { from: 10000, to: 20000 }, { from: 20000 }];

/** The catalogue's ratings run from 3.4 to 4.9, so "3+" would filter nothing: 4+ keeps 87 %, 4.5+ half. */
export const RATING_STEPS: readonly number[] = [4, 4.5];

/** The API takes inclusive SAR bounds; a band's open `to` edge is one halala lower. */
export function priceFilters(band: PriceBand | null): Pick<ProductFilters, 'priceMin' | 'priceMax'> {
  return {
    priceMin: band?.from === undefined ? undefined : band.from / 100,
    priceMax: band?.to === undefined ? undefined : (band.to - 1) / 100,
  };
}

/** Whether `filters` hold exactly this band (`null` = no price filter). Compared in halalas. */
export function isPriceBand(filters: ProductFilters, band: PriceBand | null): boolean {
  const from = filters.priceMin === undefined ? undefined : toHalalas(filters.priceMin);
  const to = filters.priceMax === undefined ? undefined : toHalalas(filters.priceMax) + 1;
  return from === band?.from && to === band?.to;
}

/** Adds or removes one category, keeping the catalogue's order so equal choices make equal queries. */
export function toggleCategory(selected: readonly CategoryId[] | undefined, id: CategoryId): CategoryId[] {
  const current = selected ?? [];
  return CATEGORIES.filter((c) => current.includes(c.id) !== (c.id === id)).map((c) => c.id);
}

/** How many filter groups are on (category, price, stock, rating). Sort is not a filter. */
export function activeFilterCount(filters: ProductFilters): number {
  let count = 0;
  if (filters.categories !== undefined && filters.categories.length > 0) count += 1;
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) count += 1;
  if (filters.inStockOnly === true) count += 1;
  if (filters.minRating !== undefined) count += 1;
  return count;
}

/** The selected category when exactly one is selected: its name becomes the screen title. */
export function singleCategory(filters: ProductFilters): Category | undefined {
  const ids = filters.categories ?? [];
  return ids.length === 1 && ids[0] !== undefined ? categoryById(ids[0]) : undefined;
}

/** Home's "All" entry opens the tab with `?category=all`: every category. */
export const ALL_CATEGORIES = 'all';

/** What Home can ask for through the `category` param. */
export type RouteCategory = CategoryId | typeof ALL_CATEGORIES;

/** A route param as a request: a known category id or 'all'; undefined for anything else (missing, a list, an unknown id). */
export function asRouteCategory(param: string | string[] | undefined): RouteCategory | undefined {
  const raw = Array.isArray(param) ? param[0] : param;
  if (raw === ALL_CATEGORIES) return ALL_CATEGORIES;
  return CATEGORIES.find((category) => category.id === raw)?.id;
}

/**
 * What arriving from Home does to the value: a category id selects that one category, 'all' clears
 * the category filter. The sort and the other filters stay as they were either way.
 */
export function withRouteCategory(value: FilterSortValue, requested: RouteCategory | undefined): FilterSortValue {
  if (requested === undefined) return value;
  if (requested !== ALL_CATEGORIES) return { ...value, filters: { ...value.filters, categories: [requested] } };
  const filters = { ...value.filters };
  delete filters.categories;
  return { ...value, filters };
}
