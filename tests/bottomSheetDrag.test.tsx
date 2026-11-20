/**
 * Dragging the bottom sheet (C-03, F-02, F-04): a throw decides where it ends and starts the spring
 * at the throw's speed, touch down catches a moving sheet, and the body drags it like the handle.
 *
 * The body's hand-off to scrolling (which finger movement drags and which scrolls) is decided by
 * the native gesture system: the pan's offsets, the ScrollView's `requireToFail`, and an `enabled`
 * shared value fed by the scroll offset on the UI thread. Jest runs none of that natively, so here
 * the body drag is driven directly; the "only at the top" rule is `bodyCanDrag`, tested in
 * bottomSheetMath.test.ts. The hand-off itself still needs a check on a real phone.
 */
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';

import { keepSharedValues } from './helpers/sharedValues';
import { drag, flushFrames, ids, renderOpenSheet, SHEET_HEIGHT, spyOnMotion } from './helpers/sheet';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  keepSharedValues();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function openSheetWithSpies() {
  const motion = spyOnMotion();
  const onClose = jest.fn();
  await renderOpenSheet(onClose);
  motion.withSpring.mockClear();
  motion.cancelAnimation.mockClear();
  return { motion, onClose };
}

describe('BottomSheet: drag and release by the handle', () => {
  it('a quick flick down closes it: the spring starts at the finger speed and the close is reported at rest', async () => {
    const { motion, onClose } = await openSheetWithSpies();

    drag(74, 1800); // not even a sixth of the way down: the speed decides
    await flushFrames();

    expect(motion.withSpring).toHaveBeenCalledWith(SHEET_HEIGHT, expect.objectContaining({ velocity: 1800, overshootClamping: true }), expect.any(Function));
    expect(motion.confirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dragged past the middle but let go moving up, it springs back open and nothing closes', async () => {
    const { motion, onClose } = await openSheetWithSpies();

    drag(300, -800);
    await flushFrames();

    expect(motion.withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ velocity: -800, overshootClamping: false }), expect.any(Function));
    expect(motion.confirm).not.toHaveBeenCalled(); // it ends where it started
    expect(onClose).not.toHaveBeenCalled();
  });

  it('touch down stops the moving sheet; a touch that never drags lets it settle where it was going', async () => {
    const { motion, onClose } = await openSheetWithSpies();

    const pan = createGestureController(ids.handle);
    pan.begin({ translationY: 0 });
    expect(motion.cancelAnimation).toHaveBeenCalled();
    pan.fail();
    await flushFrames();

    expect(motion.withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ velocity: 0 }), expect.any(Function));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('BottomSheet: drag by the body (content at the top)', () => {
  it('a downward flick on the body closes the sheet exactly as the handle does', async () => {
    const { motion, onClose } = await openSheetWithSpies();

    drag(74, 1800, 'body');
    await flushFrames();

    expect(motion.withSpring).toHaveBeenCalledWith(SHEET_HEIGHT, expect.objectContaining({ velocity: 1800, overshootClamping: true }), expect.any(Function));
    expect(motion.confirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a short, slow body drag springs back open', async () => {
    const { motion, onClose } = await openSheetWithSpies();

    drag(80, 100, 'body');
    await flushFrames();

    expect(motion.withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ overshootClamping: false }), expect.any(Function));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a touch on the body that becomes a scroll (the drag fails) leaves the sheet where it was going', async () => {
    const { motion, onClose } = await openSheetWithSpies();

    const pan = createGestureController(ids.body);
    pan.begin({ translationY: 0 });
    pan.fail(); // an upward move: the content scrolls instead
    await flushFrames();

    expect(motion.withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ velocity: 0 }), expect.any(Function));
    expect(motion.confirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
