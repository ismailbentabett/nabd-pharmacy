/**
 * Hand-off desk between a grid tile and the product page (P-01).
 *
 * A tile that opens a product leaves an entry here under the product id: the exact image URL it is
 * showing (so the hero starts as the cached tile image, no blank frame), a ref to its image box (so
 * the page can measure it again when closing), its last measured rect, and its "hidden" switch
 * (the tile hides while the hero is out and shows again the moment it lands back).
 *
 * The product page reads the entry once when it mounts and then takes it off the desk
 * (`consumeHeroSource`): a hand-off is good for one opening. Without that, opening the same product
 * later from somewhere that left no hand-off (a deep link) would fly from a stale rect on a tab
 * that is not even on screen.
 *
 * `rect` and `hidden` are shared values that belong to the tile, so both screens read and write them
 * on the UI thread, never through React state. No entry (deep link, recycled tile, reduced motion)
 * means the page simply fades.
 *
 * A JS Map, not a store: nothing renders from it, and it holds at most one entry per pressed tile.
 */
import type { View } from 'react-native';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';

import type { Rect } from './heroMath';

export type HeroSource = Readonly<{
  /** The URL the tile displays; the gallery's first image is drawn on top of it. */
  uri: string;
  ref: AnimatedRef<View>;
  /** Set on the UI thread when the tile is pressed; null if it could not be measured. */
  rect: SharedValue<Rect | null>;
  /** 1 while the hero is out of the tile. The tile's image box is invisible then. */
  hidden: SharedValue<number>;
}>;

/** The two values a tile owns and a product page may still be holding. */
export type HeroOwner = Pick<HeroSource, 'rect' | 'hidden'>;

const sources = new Map<string, HeroSource>();

export function registerHeroSource(productId: string, source: HeroSource): void {
  sources.set(productId, source);
}

export function readHeroSource(productId: string): HeroSource | null {
  return sources.get(productId) ?? null;
}

/** The product page has taken this hand-off: remove it, unless a newer press has replaced it. */
export function consumeHeroSource(productId: string, source: HeroSource): void {
  if (sources.get(productId) === source) sources.delete(productId);
}

/**
 * Called when a tile unmounts or is recycled for another product. Removes the entry if this tile
 * still owns it, and always disarms the tile's own values: a null rect makes a page that is still
 * open fade out instead of flying into a cell that now shows another product, and the tile is
 * shown again so a recycled cell is never left invisible.
 */
export function releaseHeroSource(productId: string, owner: HeroOwner): void {
  if (sources.get(productId)?.hidden === owner.hidden) sources.delete(productId);
  owner.rect.set(null);
  owner.hidden.set(0);
}

/** Tests only: forget every entry so cases do not leak into each other. */
export function resetHeroRegistryForTest(): void {
  sources.clear();
}
