/**
 * One product page at a time (P-01, F-04).
 *
 * Without this, a quick double tap pushed two product pages: the second press lands before the
 * first page has mounted. Every way into a product page (a Category tile, a Home best seller)
 * goes through `openProductPage`, which holds a one-slot latch:
 *
 * - set when a product navigation starts, just before the push;
 * - held while the product route is mounted (`useProductPageLatch`, called by the route);
 * - cleared when that route unmounts, whichever way the user left.
 *
 * While it is set a press does nothing at all: no hero hand-off is written (`prepare`) and
 * nothing is pushed. A push that never mounts a page (a navigation error) cannot lock the app for
 * good: an opening that has not mounted its page after OPENING_TIMEOUT_MS no longer counts.
 *
 * Plain module state, not a store: nothing renders from it, only press handlers read it.
 */
import { router as appRouter, type ImperativeRouter } from 'expo-router';
import { useEffect } from 'react';

/** A product route that has not mounted this long after its push is treated as never coming. */
export const OPENING_TIMEOUT_MS = 1000;

type Latch = Readonly<{ startedAt: number; mounted: boolean }>;

let latch: Latch | null = null;

function setLatch(next: Latch | null): void {
  latch = next;
}

/** True while a product page is opening or open: a press must not open another one. */
export function isProductOpening(): boolean {
  if (latch === null) return false;
  return latch.mounted || Date.now() - latch.startedAt < OPENING_TIMEOUT_MS;
}

export type OpenProductOptions = Readonly<{
  /** Leaves the hero hand-off (useHeroSource's `prepare`). Skipped while the latch is set. */
  prepare?: () => void;
  /** The screen's own router (`useRouter()`), if it has one; the global router otherwise. */
  router?: Pick<ImperativeRouter, 'push'>;
}>;

/** Opens the product page unless one is already opening or open. Returns whether it pushed. */
export function openProductPage(productId: string, { prepare, router = appRouter }: OpenProductOptions = {}): boolean {
  if (isProductOpening()) return false;
  prepare?.();
  setLatch({ startedAt: Date.now(), mounted: false });
  router.push({ pathname: '/product/[id]', params: { id: productId } });
  return true;
}

/** Called by the product route: the latch holds while the page is mounted and clears when it goes. */
export function useProductPageLatch(): void {
  useEffect(() => {
    const own: Latch = { startedAt: Date.now(), mounted: true };
    setLatch(own);
    return () => {
      // Only clear our own latch: a newer page may already hold it.
      if (latch === own) setLatch(null);
    };
  }, []);
}

/** Tests only: start every case with no page opening. */
export function resetProductOpenLatchForTest(): void {
  setLatch(null);
}
