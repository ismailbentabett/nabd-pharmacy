/**
 * The add-to-cart choreography (P-03, F-02, F-03). How it works, in the order the user feels it:
 *
 *   0 ms    press: the button dips natively (PressableScale), the cart count goes up, the badge
 *           bumps and a "confirm" haptic plays. All of that is before any of the code below.
 *   0-120   the label crossfades from "Add to cart" to a check + "Added", lifting 8 pt.
 *   0-220   a thumb of the product image lifts off the button and curves into the header's cart
 *           icon, shrinking and fading as it arrives (flyPath.ts).
 *   220     landing: the icon swells and springs back ("catches" it) and a "success" haptic plays.
 *   1320    the label returns to "Add to cart".
 *
 * Every step is a Reanimated animation started by one worklet, `play`, on the UI thread; no React
 * state changes per frame. Pressing again restarts it from the button: every press that adds
 * something (the stepper's quantity, or what still fits under the per-item limit) gets its own
 * flight; a press that adds nothing (limit reached) plays none. If a view cannot be measured,
 * nothing flies but the label and the badge still answer.
 *
 * Reduced motion (G-09): the label crossfades without lifting and the thumb never flies; the badge
 * dip (CartBadge) and the haptic remain the confirmation. "Added" stays up for the same hold.
 */
import type { View } from 'react-native';
import {
  cancelAnimation,
  measure,
  ReduceMotion,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { haptics } from '@/motion/haptics';
import { ADDED_HOLD_MS, spatialFast, timingMicro, timingReducedFade, timingStandard } from '@/motion/springs';

import { arcControl, arcPoint, centreOn, flightOpacity, flightScale, thumbOrigin, type Point } from './flyPath';

/** Size of the flying thumb, in dp. */
export const THUMB = 56;
/** How far the cart icon swells when the thumb lands in it. */
export const CATCH_SCALE = 1.18;
/** How far the two labels travel while they swap. */
const LABEL_SHIFT = 8;

export type AddToCartMotionOptions = Readonly<{
  /** The header's cart icon box: where the thumb lands. */
  cartIconRef: AnimatedRef<View>;
  /** The header's cart icon scale, owned by the product screen. */
  cartCatch: SharedValue<number>;
  reduceMotion: boolean;
  isRTL: boolean;
}>;

export function useAddToCartMotion({ cartIconRef, cartCatch, reduceMotion, isRTL }: AddToCartMotionOptions) {
  const barRef = useAnimatedRef<View>();
  const buttonRef = useAnimatedRef<View>();
  const added = useSharedValue(0);
  const flight = useSharedValue(0);
  const flying = useSharedValue(false);
  const from = useSharedValue<Point>({ x: 0, y: 0 });
  const to = useSharedValue<Point>({ x: 0, y: 0 });

  function landed(finished?: boolean): void {
    'worklet';
    // A newer press restarted the flight; that one will land instead.
    if (finished !== true) return;
    flying.set(false);
    cartCatch.set(withSequence(withTiming(CATCH_SCALE, timingMicro), withSpring(1, spatialFast)));
    scheduleOnRN(haptics.success);
  }

  function fly(): void {
    'worklet';
    const bar = measure(barRef);
    const button = measure(buttonRef);
    const cart = measure(cartIconRef);
    if (bar === null || button === null || cart === null) return;
    const origin = thumbOrigin(bar, THUMB, isRTL);
    from.set(centreOn(button, origin, THUMB));
    to.set(centreOn(cart, origin, THUMB));
    cancelAnimation(flight);
    flight.set(0);
    flying.set(true);
    flight.set(withTiming(1, timingStandard, landed));
  }

  function play(): void {
    'worklet';
    const swap = reduceMotion ? timingReducedFade : timingMicro;
    const back = reduceMotion ? timingReducedFade : timingStandard;
    // The hold is a reading pause, not motion: ReduceMotion.Never, or Reanimated's system switch
    // would skip the delay and "Added" would vanish as soon as it appeared.
    const hold = withDelay(ADDED_HOLD_MS, withTiming(0, back), ReduceMotion.Never);
    added.set(withSequence(withTiming(1, swap), hold));
    if (!reduceMotion) fly();
  }

  const thumbStyle = useAnimatedStyle(() => {
    const t = flight.get();
    const a = from.get();
    const b = to.get();
    const p = arcPoint(t, a, arcControl(a, b), b);
    return {
      opacity: flying.get() ? flightOpacity(t) : 0,
      transform: [{ translateX: p.x }, { translateY: p.y }, { scale: flightScale(t) }],
    };
  });

  const shift = reduceMotion ? 0 : LABEL_SHIFT;
  const idleLabelStyle = useAnimatedStyle(() => ({
    opacity: 1 - added.get(),
    transform: [{ translateY: -added.get() * shift }],
  }));
  const addedLabelStyle = useAnimatedStyle(() => ({
    opacity: added.get(),
    transform: [{ translateY: (1 - added.get()) * shift }],
  }));

  return {
    barRef,
    buttonRef,
    thumbStyle,
    idleLabelStyle,
    addedLabelStyle,
    /** JS: start the choreography for one press. */
    play: () => scheduleOnUI(play),
  };
}
