/**
 * The Category screen's `{ sort, filters }` value and the plain rules around it. The screen owns the
 * value, the filter & sort sheet edits a draft of it, and Home's category rail changes it through a
 * route param. No React here, so every rule is unit tested on its own.
 *
 * Prices: the sheet's bands are in centimes; they become DA only for the API query and the labels.
 */
import type { ProductFilters, SortKey } from '@/core/api/fakeApi';
import { CATEGORIES, categoryById, type Category, type CategoryId } from '@/core/catalog';
import { toCentimes, type Centimes } from '@/core/money';

export type FilterSortValue = { sort: SortKey; filters: ProductFilters };

/** The catalogue's own order, nothing filtered: the screen's starting value and what Reset goes back to. */
export const NO_FILTERS: FilterSortValue = { sort: 'relevance', filters: {} };

/** A price band [from, to) in centimes; a missing edge is open-ended. */
export type PriceBand = Readonly<{ from?: Centimes; to?: Centimes }>;

/** Four bands of roughly equal size over the seeded catalogue (about 370 / 275 / 210 / 145 items). */
export const PRICE_BANDS: readonly PriceBand[] = [{ to: 180000 }, { from: 180000, to: 360000 }, { from: 360000, to: 720000 }, { from: 720000 }];

/** The catalogue's ratings run from 3.4 to 4.9, so "3+" would filter nothing: 4+ keeps 87 %, 4.5+ half. */
export const RATING_STEPS: readonly number[] = [4, 4.5];

/** The API takes inclusive DA bounds; a band's open `to` edge is one centime lower. */
export function priceFilters(band: PriceBand | null): Pick<ProductFilters, 'priceMin' | 'priceMax'> {
  return {
    priceMin: band?.from === undefined ? undefined : band.from / 100,
    priceMax: band?.to === undefined ? undefined : (band.to - 1) / 100,
  };
}

/** Whether `filters` hold exactly this band (`null` = no price filter). Compared in centimes. */
export function isPriceBand(filters: ProductFilters, band: PriceBand | null): boolean {
  const from = filters.priceMin === undefined ? undefined : toCentimes(filters.priceMin);
  const to = filters.priceMax === undefined ? undefined : toCentimes(filters.priceMax) + 1;
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
