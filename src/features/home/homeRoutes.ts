/**
 * Where Home sends the user. One place for the route strings, so the banners, the category rail,
 * the search field and the best sellers cannot drift apart.
 *
 * Category is a tab: `navigate` switches to it (and updates its filter) instead of stacking a second
 * copy. Product is a stacked screen over the tabs, so it is pushed and Back returns to Home.
 */
import { router } from 'expo-router';

import type { CategoryId } from '@/core/catalog';
import { openProductPage } from '@/motion/hero/openProduct';

/**
 * The Category tab, filtered to one category, or to all products when `category` is null.
 * "All" is sent explicitly as `category=all`, which clears the tab's category filter
 * (filterSortValue.ts). A bare `navigate('/category')` would leave whatever category the user
 * picked last in place, so "All" from Home would not show everything.
 */
export function openCategory(category: CategoryId | null): void {
  router.navigate({ pathname: '/category', params: { category: category ?? 'all' } });
}

/**
 * The product page, through the one-page latch (openProduct.ts): a double tap pushes one page.
 * `prepare` is the card's hero hand-off; it only runs when the page really opens.
 */
export function openProduct(id: string, prepare?: () => void): void {
  openProductPage(id, { prepare });
}

/** The search page: a pushed stack screen, so Back returns to Home with its scroll intact. */
export function openSearch(): void {
  router.push('/search');
}
