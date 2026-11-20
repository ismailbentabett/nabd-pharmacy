/**
 * The hero's React side effects, kept apart from its worklets (useHeroTransition.ts):
 *
 * - The hand-off is consumed once (single use, registry.ts), also when it is not flown.
 * - The open starts at once for a crossfade. For a flight it starts when the tile's image is drawn
 *   in the hero (`markImageReady`, called by the gallery) or at READY_DEADLINE_MS, whichever comes
 *   first: a missing image never holds the page back for long.
 * - Android's Back key (and the gesture-navigation back swipe, which sends the same event) runs the
 *   same close as the header button and is consumed, so the route is popped only when the hero has
 *   landed on its tile.
 * - Leaving any other way (the header's cart icon) never leaves the tile invisible.
 *
 * `start` and `close` are worklets the hero recreates on every render. The effects read them through
 * `useEffectEvent`, so they subscribe once and the deadline timer is armed once, instead of
 * re-running whenever the page renders.
 */
import { useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { consumeHeroSource, type HeroSource } from './registry';

/** The longest the hero waits for the tile image to be drawn before it opens anyway. */
export const READY_DEADLINE_MS = 150;

export type HeroLifecycleInputs = Readonly<{
  productId: string;
  /** The hand-off entry read when the page mounted, flown or not. */
  entry: HeroSource | null;
  /** True when the page flies from a tile; false for the crossfade. */
  flies: boolean;
  /** Worklet: open, if nothing has started the transition yet. */
  start: () => void;
  /** Worklet: close, unless a close is already running. */
  close: () => void;
  /** The tile's hidden switch, or null when there is no tile. */
  srcHidden: SharedValue<number> | null;
}>;

export function useHeroLifecycle({ productId, entry, flies, start, close, srcHidden }: HeroLifecycleInputs): void {
  const startOnUI = useEffectEvent(() => scheduleOnUI(start));
  const closeOnUI = useEffectEvent(() => scheduleOnUI(close));

  useEffect(() => {
    if (entry !== null) consumeHeroSource(productId, entry);
  }, [productId, entry]);

  useEffect(() => {
    if (!flies) {
      startOnUI();
      return undefined;
    }
    const timer = setTimeout(() => startOnUI(), READY_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [flies]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOnUI();
      return true;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => () => srcHidden?.set(0), [srcHidden]);
}
