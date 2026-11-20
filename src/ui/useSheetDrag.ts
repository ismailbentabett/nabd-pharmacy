/**
 * The drags that move a bottom sheet (C-03). Both run on the UI thread and only write the sheet's
 * shared values, so nothing re-renders while a finger is down (F-02).
 *
 * - The header (grip + title bar) drags the sheet up or down, once the finger has moved DRAG_SLOP.
 * - The body hands over to the sheet the usual way: when its content is scrolled to the top, a finger
 *   that starts on the body and moves down drags the sheet, not the content. A finger that moves up
 *   scrolls as usual. Once the content is scrolled away from the top, the body drag is switched off,
 *   so it never stands between the finger and the scroll.
 *
 * How the body hand-off is wired (Gesture Handler 3, checked against the installed 3.3 types):
 * - `bodyPan` activates only on a downward move past DRAG_SLOP (`activeOffsetY: DRAG_SLOP`) and
 *   fails on an upward one (`failOffsetY: -DRAG_SLOP`).
 * - The body's ScrollView is given `requireToFail={bodyPan}`: it waits for that decision instead of
 *   racing it. When the pan wins, the scroll is cancelled, so the content never moves under a drag.
 * - `enabled` is a shared value fed from the scroll offset on the UI thread (`useScrollOffset` +
 *   `useAnimatedReaction`): no JS `onScroll`, no re-render, no per-frame state.
 * A drag that starts while the content is scrolled stays a scroll even if it reaches the top: the
 * hand-off is decided when the finger lands, never in the middle of a gesture.
 *
 * Every drag catches the sheet where it is (`fingerOrigin`), follows the finger 1:1 between open and
 * closed, and on release goes where the throw would carry it. Vertical only: the same in RTL.
 */
import type { ScrollView } from 'react-native';
import { usePanGesture, type PanGestureActiveEvent } from 'react-native-gesture-handler';
import { cancelAnimation, useAnimatedReaction, useAnimatedRef, useScrollOffset, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/motion/haptics';

import { bodyCanDrag, DRAG_SLOP, dragPosition, fingerOrigin, releaseOpens, releaseVelocity } from './bottomSheetMath';

/** What a drag needs from the sheet: where it is, how tall it is, where it is heading, and how to send it there. */
export type SheetDragTarget = {
  y: SharedValue<number>;
  height: SharedValue<number>;
  /** The reduced-motion fade; a drag always shows the sheet fully. */
  fade: SharedValue<number>;
  wantOpen: SharedValue<boolean>;
  /** A worklet: springs (or, with reduced motion, fades) the sheet to open or closed. */
  settle: (toOpen: boolean, velocity: number, fromDrag: boolean) => void;
};

/**
 * The drag itself, the same wherever it starts. Each surface gets its own copy, so the header and
 * the body never share a gesture's bookkeeping. Returned as named worklets and passed to
 * `usePanGesture` one by one: the Worklets Babel plugin rejects a spread inside a gesture config.
 */
function useSheetDragHandlers(sheet: SheetDragTarget) {
  const { y, height, fade, wantOpen, settle } = sheet;
  const startY = useSharedValue(0);
  const activationY = useSharedValue(0);
  const dragging = useSharedValue(false);

  const onBegin = () => {
    'worklet';
    cancelAnimation(y);
    cancelAnimation(fade); // a reduced-motion fade-out stops too: the sheet is in the hand again
    fade.set(1);
    startY.set(fingerOrigin(y.get()));
  };
  const onActivate = (e: PanGestureActiveEvent) => {
    'worklet';
    dragging.set(true);
    activationY.set(e.translationY); // count from here, so the sheet does not jump by the slop
  };
  const onUpdate = (e: PanGestureActiveEvent) => {
    'worklet';
    y.set(dragPosition(startY.get(), e.translationY - activationY.get(), height.get()));
  };
  const onDeactivate = (e: PanGestureActiveEvent) => {
    'worklet';
    const toOpen = releaseOpens(y.get(), e.velocityY, height.get());
    if (toOpen !== wantOpen.get()) scheduleOnRN(haptics.confirm);
    settle(toOpen, releaseVelocity(y.get(), e.velocityY), true);
  };
  const onFinalize = () => {
    'worklet';
    // A touch that stopped a spring but never became a drag (a tap, or a scroll on the body) lets
    // the spring carry on.
    if (!dragging.get()) settle(wantOpen.get(), 0, true);
    dragging.set(false);
  };
  return { onBegin, onActivate, onUpdate, onDeactivate, onFinalize };
}

/** The header and body drags, plus the ref the body ScrollView must carry so its offset can be read. */
export function useSheetDrag(sheet: SheetDragTarget, testIDs: { handle: string; body: string }) {
  const header = useSheetDragHandlers(sheet);
  const headerPan = usePanGesture({
    testID: testIDs.handle,
    activeOffsetY: [-DRAG_SLOP, DRAG_SLOP],
    onBegin: header.onBegin,
    onActivate: header.onActivate,
    onUpdate: header.onUpdate,
    onDeactivate: header.onDeactivate,
    onFinalize: header.onFinalize,
  });

  const scrollRef = useAnimatedRef<ScrollView>();
  const scrollOffset = useSharedValue(0);
  useScrollOffset(scrollRef, scrollOffset);
  const bodyAtTop = useSharedValue(true);
  useAnimatedReaction(
    () => bodyCanDrag(scrollOffset.get()),
    (atTop, before) => {
      if (atTop !== before) bodyAtTop.set(atTop);
    },
  );

  const body = useSheetDragHandlers(sheet);
  const bodyPan = usePanGesture({
    testID: testIDs.body,
    activeOffsetY: DRAG_SLOP, // down only: an upward move is the content's
    failOffsetY: -DRAG_SLOP,
    enabled: bodyAtTop,
    onBegin: body.onBegin,
    onActivate: body.onActivate,
    onUpdate: body.onUpdate,
    onDeactivate: body.onDeactivate,
    onFinalize: body.onFinalize,
  });

  return { headerPan, bodyPan, scrollRef };
}
