/**
 * The bottom sheet as a person (and a screen reader) uses it (C-03): it opens and closes with its
 * prop, every way of closing reaches the parent exactly once, Android Back closes it first, and
 * reduced motion fades instead of springing. Dragging is in bottomSheetDrag.test.tsx; the filter
 * sheet built on it is in filterSortSheet.test.tsx. How Reanimated's Jest mock shapes these tests is
 * explained in helpers/sheet.tsx and helpers/sharedValues.ts.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { spatialDefault, timingReducedFade } from '@/motion/springs';
import { SCRIM_OPACITY } from '@/ui/bottomSheetMath';

import { pressNative, renderWithProviders } from './helpers/render';
import { keepSharedValues } from './helpers/sharedValues';
import { backdropOpacityOnScreen, flushFrames, ids, measure, renderOpenSheet, Sheet, SHEET, SHEET_HEIGHT, spyOnMotion } from './helpers/sheet';

const mockFocus = { focused: true };
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocus.focused }));

beforeEach(() => {
  mockFocus.focused = true;
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  keepSharedValues();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BottomSheet: open and close', () => {
  it('opens on the standard spring once measured, dims the backdrop, and moves screen reader focus to the title', async () => {
    const motion = spyOnMotion();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await renderOpenSheet(jest.fn());
    expect(motion.withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ ...spatialDefault, velocity: 0, overshootClamping: false }), expect.any(Function));
    expect(backdropOpacityOnScreen()).toBe(SCRIM_OPACITY);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('closes when the prop says so, without reporting a close it did not start, and stays mounted but hidden', async () => {
    const motion = spyOnMotion();
    const onClose = jest.fn();
    const { rerender } = await renderOpenSheet(onClose);
    motion.withSpring.mockClear();

    await rerender(<Sheet open={false} onClose={onClose} />);
    await flushFrames();
    await rerender(<Sheet open={false} onClose={onClose} />);

    // Closing stops at the screen edge instead of bouncing below it.
    expect(motion.withSpring).toHaveBeenCalledWith(SHEET_HEIGHT, expect.objectContaining({ overshootClamping: true }), expect.any(Function));
    expect(onClose).not.toHaveBeenCalled();
    expect(backdropOpacityOnScreen()).toBe(0);
    expect(screen.getByTestId(SHEET, { includeHiddenElements: true }).props.pointerEvents).toBe('none');
    expect(screen.queryByTestId(ids.panel)).toBeNull();
    expect(screen.getByTestId(ids.panel, { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('BottomSheet: ways to close', () => {
  it('the backdrop is a labelled button TalkBack can double-tap to close', async () => {
    const onClose = jest.fn();
    await renderOpenSheet(onClose);
    // The testing library follows iOS, where the panel's accessibilityViewIsModal keeps VoiceOver
    // inside the sheet (its escape gesture closes it instead). Android has no such prop, so TalkBack
    // does reach the backdrop, which is why it needs a role, a name and an action.
    const backdrop = screen.getByRole('button', { name: 'Close Filters', includeHiddenElements: true });
    await fireEvent(backdrop, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a tap on the backdrop closes it, and a second way of closing in the same moment is not reported again', async () => {
    const onClose = jest.fn();
    await renderOpenSheet(onClose);
    const tap = createGestureController(ids.backdrop);
    tap.begin();
    tap.activate();
    tap.end();
    await flushFrames();
    expect(onClose).toHaveBeenCalledTimes(1);

    await pressNative(ids.close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Android Back closes the open sheet first; closed, or on another tab, Back is left to navigation', async () => {
    const removes: jest.Mock[] = [];
    const addListener = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => {
      const remove = jest.fn();
      removes.push(remove);
      return { remove };
    });
    const onClose = jest.fn();
    const { rerender } = await renderWithProviders(<Sheet open={false} onClose={onClose} />);
    expect(addListener).not.toHaveBeenCalled();

    await rerender(<Sheet open onClose={onClose} />);
    expect(addListener).toHaveBeenCalledTimes(1);
    const onBack = addListener.mock.calls[0]?.[1];
    expect(onBack?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); // handled: navigation must not also go back
    expect(onClose).toHaveBeenCalledTimes(1);

    await rerender(<Sheet open={false} onClose={onClose} />);
    expect(removes[0]).toHaveBeenCalledTimes(1);

    mockFocus.focused = false;
    await rerender(<Sheet open onClose={onClose} />);
    expect(addListener).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet: reduced motion', () => {
  it('fades in and out instead of springing', async () => {
    const motion = spyOnMotion();
    const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
    addEventListener.mockClear();
    const onClose = jest.fn();
    const { rerender } = await renderWithProviders(<Sheet open={false} onClose={onClose} />);
    const emit = addEventListener.mock.calls.filter(([event]) => event === 'reduceMotionChanged').at(-1)?.[1] as (enabled: boolean) => void;
    await act(async () => emit(true));

    await rerender(<Sheet open onClose={onClose} />);
    await measure();
    expect(motion.withTiming).toHaveBeenCalledWith(1, timingReducedFade, expect.any(Function));

    await rerender(<Sheet open={false} onClose={onClose} />);
    await flushFrames();
    expect(motion.withTiming).toHaveBeenCalledWith(0, timingReducedFade, expect.any(Function));
    expect(motion.withSpring).not.toHaveBeenCalled();
  });
});
