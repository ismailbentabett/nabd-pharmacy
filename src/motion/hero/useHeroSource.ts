/**
 * The tile side of the shared-element hero (P-01). Wiring a tile takes three lines:
 *
 *   const { ref, hiddenStyle, open } = useHeroSource(product.id);
 *   const uri = productImageUri(product.id, 1, imageSize);        // what the tile displays
 *   <PressableScale onPress={() => open(uri)} …>
 *     <Animated.View ref={ref} style={[styles.imageBox, hiddenStyle]}>
 *       <ProductImage productId={product.id} displaySize={imageSize} … />
 *     </Animated.View>
 *   </PressableScale>
 *
 * Destructure the result: the ref only goes to the view, it is never read during render.
 * A screen that navigates on press itself (its own router, its own tests) checks
 * `isProductOpening()`, calls `prepare(uri)` and then pushes through `openProductPage`
 * (openProduct.ts), all in the same handler.
 *
 * How it works, step by step:
 * 1. `open(uri)` goes through the one-page latch (openProduct.ts): while a product page is opening
 *    or open it does nothing. Otherwise it writes the hand-off entry (registry.ts), asks the UI
 *    thread to measure the image box, and pushes the product route, all in the same JS tick. The
 *    press itself never waits.
 * 2. The measurement runs on the UI thread before the product page's first frame (UI jobs run in
 *    order), so the page starts its hero exactly on top of the tile.
 * 3. While the hero is out, the product page sets `hidden` to 1 and the tile's image box turns
 *    invisible; it sets it back to 0 in the frame the hero lands on the tile again.
 * 4. Unmount or recycling (FlashList reuses this component for another product) releases the
 *    entry and clears the rect, so the page never flies back into a cell that now shows something
 *    else: it fades.
 */
import { useEffect } from 'react';
import type { View } from 'react-native';
import { measure, useAnimatedRef, useAnimatedStyle, useSharedValue, type AnimatedRef, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { toRect, type Rect } from './heroMath';
import { openProductPage } from './openProduct';
import { registerHeroSource, releaseHeroSource } from './registry';

function captureRect(ref: AnimatedRef<View>, rect: SharedValue<Rect | null>): void {
  'worklet';
  rect.set(toRect(measure(ref)));
}

export type HeroSourceHandle = Readonly<{
  ref: AnimatedRef<View>;
  /** Spread onto the image box: invisible while the hero is out (opacity only, UI thread). */
  hiddenStyle: ReturnType<typeof useAnimatedStyle>;
  /** Leave the hand-off and measure the tile; the caller pushes the product route right after. */
  prepare: (imageUri: string) => void;
  /** `prepare`, then push the product route; does nothing while a product page is opening or open. */
  open: (imageUri: string) => void;
}>;

export function useHeroSource(productId: string): HeroSourceHandle {
  const ref = useAnimatedRef<View>();
  const rect = useSharedValue<Rect | null>(null);
  const hidden = useSharedValue(0);

  useEffect(() => () => releaseHeroSource(productId, { rect, hidden }), [productId, rect, hidden]);

  const hiddenStyle = useAnimatedStyle(() => ({ opacity: hidden.get() === 1 ? 0 : 1 }));

  const prepare = (imageUri: string) => {
    registerHeroSource(productId, { uri: imageUri, ref, rect, hidden });
    scheduleOnUI(captureRect, ref, rect);
  };

  const open = (imageUri: string) => {
    openProductPage(productId, { prepare: () => prepare(imageUri) });
  };

  return { ref, hiddenStyle, prepare, open };
}
