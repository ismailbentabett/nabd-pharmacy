/**
 * The undo bar's own rules (K-02, G-09, WCAG 2.2.1): it times out once, restarts its window for a
 * newer event, waits longer when the system asks for more time, never dismisses itself while a
 * screen reader is on, and only fades under reduced motion.
 *
 * Fake timers, so the 5 s window is checked to the millisecond. Microtasks stay real: the countdown
 * starts after two AccessibilityInfo reads resolve, and Reanimated's end-of-animation calls use them.
 */
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { spatialDefault, timingReducedFade } from '@/motion/springs';
import { DEFAULT_UNDO_MS, UndoBar, type UndoBarProps } from '@/ui/UndoBar';

import { pressNative, renderWithProviders } from './helpers/render';

const ACTION = 'bar-action';

/** Let promises and the renders they cause finish, without moving the clock. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

async function renderBar(props: Partial<UndoBarProps> = {}) {
  const view = await renderWithProviders(bar(props));
  // The countdown is armed once the screen reader and timeout reads resolve.
  await flush();
  return view;
}

function bar(props: Partial<UndoBarProps> = {}) {
  return (
    <UndoBar
      testID="bar"
      visible
      message="Removed from cart"
      actionLabel="Undo"
      actionHint="Puts the item back in your cart"
      onAction={jest.fn()}
      onTimeout={jest.fn()}
      eventKey="a"
      {...props}
    />
  );
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  resetMotionPreferenceForTest();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('UndoBar', () => {
  it('shows the message and a labelled action that calls onAction', async () => {
    const onAction = jest.fn();
    await renderBar({ onAction });
    expect(screen.getByText('Removed from cart')).toBeTruthy();
    const action = screen.getByTestId(ACTION);
    expect(action.props.accessibilityLabel).toBe('Undo');
    expect(action.props.accessibilityHint).toBe('Puts the item back in your cart');
    expect(screen.getByTestId('bar').props.accessibilityLiveRegion).toBe('polite');

    await pressNative(ACTION);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('times out once, exactly when the 5 s window ends', async () => {
    const onTimeout = jest.fn();
    await renderBar({ onTimeout });
    await advance(DEFAULT_UNDO_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    await advance(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    await advance(DEFAULT_UNDO_MS * 2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('gives a newer event a full window of its own', async () => {
    const onTimeout = jest.fn();
    const view = await renderBar({ onTimeout, eventKey: 'a' });
    await advance(4000);
    await view.rerender(bar({ onTimeout, eventKey: 'b' }));
    await flush();
    await advance(DEFAULT_UNDO_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    await advance(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not time out once hidden, and unmounts its content after the hide', async () => {
    const onTimeout = jest.fn();
    const view = await renderBar({ onTimeout });
    await advance(1000);
    await view.rerender(bar({ onTimeout, visible: false }));
    await flush();
    await advance(DEFAULT_UNDO_MS * 2);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(screen.queryByTestId(ACTION)).toBeNull();
    expect(screen.queryByText('Removed from cart')).toBeNull();
  });

  it('waits for the longer "time to take action" the user set, never for a shorter one', async () => {
    jest.mocked(AccessibilityInfo.getRecommendedTimeoutMillis).mockResolvedValueOnce(15_000);
    const longer = jest.fn();
    const first = await renderBar({ onTimeout: longer });
    await advance(15_000 - 1);
    expect(longer).not.toHaveBeenCalled();
    await advance(1);
    expect(longer).toHaveBeenCalledTimes(1);
    await first.unmount();

    jest.mocked(AccessibilityInfo.getRecommendedTimeoutMillis).mockResolvedValueOnce(1000);
    const shorter = jest.fn();
    await renderBar({ onTimeout: shorter });
    await advance(DEFAULT_UNDO_MS - 1);
    expect(shorter).not.toHaveBeenCalled();
    await advance(1);
    expect(shorter).toHaveBeenCalledTimes(1);
  });

  it('never dismisses itself while a screen reader is on', async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValueOnce(true);
    const onTimeout = jest.fn();
    await renderBar({ onTimeout });
    await advance(60_000);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(screen.getByTestId(ACTION)).toBeTruthy();
  });

  it('springs up normally, and only fades under reduced motion', async () => {
    const withSpring = jest.spyOn(Reanimated, 'withSpring');
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const normal = await renderBar();
    expect(withSpring).toHaveBeenCalledWith(1, spatialDefault);
    await normal.unmount();
    resetMotionPreferenceForTest();

    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    const reduced = await renderBar({ visible: false });
    withSpring.mockClear();
    withTiming.mockClear();

    await reduced.rerender(bar());
    await reduced.rerender(bar({ visible: false }));
    await flush();
    expect(withSpring).not.toHaveBeenCalled();
    expect(withTiming).toHaveBeenCalledWith(1, timingReducedFade);
    expect(withTiming).toHaveBeenCalledWith(0, timingReducedFade, expect.any(Function));
    // Reanimated's mock hands out a new shared value per render, so the effect may run more than once here.
    for (const [, config] of withTiming.mock.calls) expect(config).toBe(timingReducedFade);
  });
});
