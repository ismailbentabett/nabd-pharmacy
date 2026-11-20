/**
 * The cart's layout animations (K-01), in one place. They run on the UI thread, outside React, and are
 * allowed here only because the cart is a plain ScrollView: nothing in it is recycled.
 *
 * - entering: fade in and rise 12 dp (a spring for the rise). `enterAfter(ms)` delays it.
 * - exiting: fade out with a slight shrink, which reads as "collapsing" without moving layout.
 * - layout: a moved view springs from its old frame to its new one, so a gap closes (and opens on undo).
 *
 * Reduced motion (G-09): a 120 ms cross-fade in and out, and no layout spring (the gap closes at once).
 */
import {
  FadeIn,
  FadeOut,
  ReduceMotion,
  withDelay,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type LayoutAnimationFunction,
} from 'react-native-reanimated';

import { duration, spatialDefault, STAGGER_MAX_ITEMS, STAGGER_MS, timingExit, timingStandard } from '@/motion/springs';

/** How far a view rises while it fades in. Small: it arrives, it does not fly in. */
const ENTER_RISE = 12;
/** A leaving view shrinks this little as it fades. */
const EXIT_SCALE = 0.96;

export function enterAfter(delayMs: number): EntryExitAnimationFunction {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: ENTER_RISE }] },
      animations: {
        opacity: withDelay(delayMs, withTiming(1, timingStandard)),
        transform: [{ translateY: withDelay(delayMs, withSpring(0, spatialDefault)) }],
      },
    };
  };
}

export const enterNow = enterAfter(0);

/** One entering animation per stagger slot, built once. Slot 0 has no delay. */
export const STAGGERED_ENTERING = Array.from({ length: STAGGER_MAX_ITEMS }, (_, i) => enterAfter(i * STAGGER_MS));

/** For a view that replaces one that is leaving: it starts once the other has faded out. */
export const enterAfterExit = enterAfter(duration.exit);

export const exitCollapse: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, timingExit),
      transform: [{ scale: withTiming(EXIT_SCALE, timingExit) }],
    },
  };
};

/** What Reanimated's LinearTransition does, with our spring token instead of its default. */
export const springToNewFrame: LayoutAnimationFunction = (values) => {
  'worklet';
  return {
    initialValues: {
      originX: values.currentOriginX,
      originY: values.currentOriginY,
      width: values.currentWidth,
      height: values.currentHeight,
    },
    animations: {
      originX: withSpring(values.targetOriginX, spatialDefault),
      originY: withSpring(values.targetOriginY, spatialDefault),
      width: withSpring(values.targetWidth, spatialDefault),
      height: withSpring(values.targetHeight, spatialDefault),
    },
  };
};

// Each builder chain starts from the class: the instance methods (.delay, .duration) mutate and
// return the same object, so deriving one from another would change both.
export const reducedEnter = FadeIn.duration(duration.reducedFade).reduceMotion(ReduceMotion.Never);
export const reducedEnterAfterExit = FadeIn.duration(duration.reducedFade)
  .delay(duration.reducedFade)
  .reduceMotion(ReduceMotion.Never);
export const reducedExit = FadeOut.duration(duration.reducedFade).reduceMotion(ReduceMotion.Never);
