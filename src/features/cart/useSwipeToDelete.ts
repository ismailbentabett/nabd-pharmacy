/**
 * Swipe-to-delete for one cart row (K-02). Everything per frame runs on the UI thread.
 *
 * How it works (walkthrough):
 * 1. Touch down grabs the row wherever it is drawn, even mid-spring (`cancelAnimation`), so the
 *    swipe is always interruptible. A touch that never becomes a swipe lets the row settle again.
 * 2. While dragging, the finger's pull towards the start edge becomes the drawn offset through
 *    `drawnFromPull`: 1:1 while the delete button is uncovered, then resisting. The reading
 *    direction enters only in `toPull` and `screenXFromPull`, so Arabic swipes the other way (G-08).
 * 3. Crossing the commit point flips one shared flag. Only that flip reaches JS (a haptic through
 *    `scheduleOnRN`), never a frame (F-02).
 * 4. Release: `releaseDecision` picks delete, open or closed from position and velocity. Open and
 *    closed spring from the release speed. Delete slides the row off the start edge, then one JS call
 *    removes the line; the list then plays the exit and closes the gap (K-01).
 * 5. One open row at a time. Touch down writes this row's id into `openRowId`, a shared value the
 *    list owns. Every other row watches it with `useAnimatedReaction` (UI thread) and closes if it
 *    was left open. A tap or a scroll that starts on an open row's content closes it as well; one
 *    that starts on the uncovered red button keeps it open, so the press lands. The tap itself still
 *    counts (a stepper press on an open row closes the row and changes the quantity).
 *
 * Reduced motion (G-09): the row still follows the finger (direct manipulation is not animation),
 * but it jumps to rest instead of springing, and a delete removes at once (the list fades the row out).
 */
import type { LayoutChangeEvent } from 'react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useDirection } from '@/i18n/direction';
import { nearestSnap, progressBetween } from '@/motion/gestureMath';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { effectsDefault, spatialDefault, spatialFast } from '@/motion/springs';

import {
  ACTION_REVEAL_FADE,
  ACTION_WIDTH,
  ACTIVE_OFFSET,
  ARMED_ICON_SCALE,
  commitDistance,
  drawnFromPull,
  drawnVelocity,
  FAIL_OFFSET,
  pullFromDrawn,
  releaseDecision,
  screenXFromPull,
  toPull,
} from './swipeMath';

/** Gesture phases, as numbers so they live in a shared value. */
const IDLE = 0;
const TOUCHED = 1;
const DRAGGING = 2;
/** The row is sliding out to be deleted: it no longer reacts to touches. */
const COMMITTED = 3;

const REST_POINTS = [0, ACTION_WIDTH];

type Options = {
  onDelete: () => void;
  /** This row's id, written to `openRowId` when it is touched. */
  rowId: string;
  /** The id of the row touched last. Owned by the list, shared by all its rows. */
  openRowId: SharedValue<string>;
  testID?: string;
};

export function useSwipeToDelete({ onDelete, rowId, openRowId, testID }: Options) {
  const { dir } = useDirection();
  const reduceMotion = useMotionPreference();
  const drawn = useSharedValue(0);
  const startPull = useSharedValue(0);
  const rowWidth = useSharedValue(0);
  const phase = useSharedValue(IDLE);
  const armed = useSharedValue(false);
  const iconScale = useSharedValue(1);
  /** Whether the current touch started on the uncovered red button rather than on the content. */
  const touchOnAction = useSharedValue(false);

  const settle = (target: number, velocity: number) => {
    'worklet';
    drawn.set(reduceMotion ? target : withSpring(target, { ...spatialDefault, velocity }));
  };

  const trackArmed = (next: boolean) => {
    'worklet';
    if (armed.get() === next) return;
    armed.set(next);
    const scale = next ? ARMED_ICON_SCALE : 1;
    iconScale.set(reduceMotion ? scale : withSpring(scale, effectsDefault));
    if (next) scheduleOnRN(haptics.warn);
  };

  /** Slide off the start edge, then remove. Clamped so the spring never bounces back into view. */
  const commit = (velocity: number) => {
    'worklet';
    // Once only. A second tap on the red button would restart the slide, and the replaced spring
    // still calls its callback, so the line would be removed twice (and again after a quick Undo).
    if (phase.get() === COMMITTED) return;
    phase.set(COMMITTED);
    if (reduceMotion) {
      scheduleOnRN(onDelete);
      return;
    }
    const offscreen = Math.max(rowWidth.get(), ACTION_WIDTH * 2);
    const config = { ...spatialFast, velocity: Math.max(0, velocity), overshootClamping: true };
    // The user already committed: remove even if the slide was cut short.
    drawn.set(withSpring(offscreen, config, () => scheduleOnRN(onDelete)));
  };

  const pan = usePanGesture({
    activeOffsetX: [-ACTIVE_OFFSET, ACTIVE_OFFSET],
    failOffsetY: [-FAIL_OFFSET, FAIL_OFFSET],
    testID,
    onBegin: (e) => {
      if (phase.get() === COMMITTED) return;
      cancelAnimation(drawn);
      phase.set(TOUCHED);
      openRowId.set(rowId);
      // The red button is the strip the content uncovered at the end edge: right in English, left in
      // Arabic. `e.x` is measured from the row's left edge in both directions.
      const uncovered = drawn.get();
      touchOnAction.set(dir === 1 ? e.x >= rowWidth.get() - uncovered : e.x <= uncovered);
    },
    onActivate: (e) => {
      if (phase.get() === COMMITTED) return;
      phase.set(DRAGGING);
      // Continue from where the row is drawn, minus the slop already travelled: no jump on grab.
      startPull.set(pullFromDrawn(drawn.get()) - toPull(e.translationX, dir));
    },
    onUpdate: (e) => {
      if (phase.get() !== DRAGGING) return;
      const pull = startPull.get() + toPull(e.translationX, dir);
      drawn.set(drawnFromPull(pull));
      trackArmed(pull >= commitDistance(rowWidth.get()));
    },
    onDeactivate: (e) => {
      if (phase.get() !== DRAGGING) return;
      if (e.canceled) {
        // The list took the touch over: rest wherever is nearest, without a throw.
        settle(nearestSnap(drawn.get(), REST_POINTS), 0);
        return;
      }
      const pull = startPull.get() + toPull(e.translationX, dir);
      const velocity = toPull(e.velocityX, dir);
      const decision = releaseDecision(pull, velocity, commitDistance(rowWidth.get()));
      if (decision === 'delete') {
        // A flick deletes without crossing the point, so it never got the threshold haptic.
        if (!armed.get()) scheduleOnRN(haptics.warn);
        commit(drawnVelocity(pull, velocity));
        return;
      }
      settle(decision === 'open' ? ACTION_WIDTH : 0, drawnVelocity(pull, velocity));
    },
    onFinalize: () => {
      if (phase.get() === COMMITTED) return;
      // Touched but never dragged (a tap, or the list scrolled). On the red button: finish the rest,
      // so the press lands. Anywhere else: close, the way an open row answers a tap or a scroll.
      if (phase.get() === TOUCHED) settle(touchOnAction.get() ? nearestSnap(drawn.get(), REST_POINTS) : 0, 0);
      phase.set(IDLE);
      trackArmed(false);
    },
  });

  // Another row was touched: close this one if it was left open. Not while this row is moving.
  useAnimatedReaction(
    () => openRowId.get(),
    (current) => {
      if (current !== rowId && phase.get() === IDLE && drawn.get() !== 0) settle(0, 0);
    },
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: screenXFromPull(drawn.get(), dir) }],
  }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: progressBetween(drawn.get(), 0, ACTION_REVEAL_FADE),
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.get() }] }));

  const onLayout = (event: LayoutChangeEvent) => rowWidth.set(event.nativeEvent.layout.width);

  /** The red button: the same slide-out as a full swipe, so both paths look alike. */
  const deleteFromButton = () => scheduleOnUI(commit, 0);

  return { pan, contentStyle, actionStyle, iconStyle, onLayout, deleteFromButton };
}
