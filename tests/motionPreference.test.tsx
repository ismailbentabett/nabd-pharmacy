/**
 * The reduce-motion store is module-level (one system listener for the whole app), so each test
 * unmounts what it mounted and resets the store, the same as a fresh app start.
 */
import { act, render, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import {
  MotionPreferenceSync,
  resetMotionPreferenceForTest,
  useMotionPreference,
} from '@/motion/motionPreference';

// Reanimated's mock renders `ReducedMotionConfig` as nothing; a spy shows what the app asked it for.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  ReducedMotionConfig: jest.fn(() => null),
}));

const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
const isReduceMotionEnabled = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
const config = jest.mocked(ReducedMotionConfig);

type Handler = (enabled: boolean) => void;

function lastHandler(): Handler {
  const call = addEventListener.mock.calls.at(-1);
  if (!call) throw new Error('no reduceMotionChanged listener was added');
  expect(call[0]).toBe('reduceMotionChanged');
  return call[1] as Handler;
}

/** The mode of the `ReducedMotionConfig` currently on screen, or null when none is mounted. */
function configuredMode(): ReduceMotion | null {
  const call = config.mock.calls.at(-1);
  return call ? call[0].mode : null;
}

beforeEach(() => {
  resetMotionPreferenceForTest();
  addEventListener.mockClear();
  isReduceMotionEnabled.mockClear();
  config.mockClear();
});

describe('useMotionPreference', () => {
  it('starts from the value Reanimated read at app start (false in the mock)', async () => {
    const { result, unmount } = await renderHook(() => useMotionPreference());
    expect(result.current).toBe(false);
    await unmount();
  });

  it('corrects the start-up value with the current system setting once, on first subscribe', async () => {
    isReduceMotionEnabled.mockResolvedValueOnce(true);
    const { result, unmount } = await renderHook(() => useMotionPreference());
    await act(async () => undefined);
    expect(result.current).toBe(true);
    expect(isReduceMotionEnabled).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('a late answer to that read never overwrites a newer change event', async () => {
    let answer: (enabled: boolean) => void = () => undefined;
    isReduceMotionEnabled.mockReturnValueOnce(new Promise<boolean>((resolve) => (answer = resolve)));
    const { result, unmount } = await renderHook(() => useMotionPreference());

    await act(async () => lastHandler()(true));
    await act(async () => answer(false));
    expect(result.current).toBe(true);
    await unmount();
  });

  it('follows the system setting when the user flips it while the app is open', async () => {
    const { result, unmount } = await renderHook(() => useMotionPreference());
    const emit = lastHandler();

    await act(async () => emit(true));
    expect(result.current).toBe(true);

    await act(async () => emit(false));
    expect(result.current).toBe(false);
    await unmount();
  });

  it('adds one system listener however many components subscribe, and removes it with the last', async () => {
    const first = await renderHook(() => useMotionPreference());
    const second = await renderHook(() => useMotionPreference());
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(isReduceMotionEnabled).toHaveBeenCalledTimes(1);

    const subscription = addEventListener.mock.results[0]?.value as { remove: jest.Mock };
    await first.unmount();
    expect(subscription.remove).not.toHaveBeenCalled();
    await second.unmount();
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the last value reported by the system for components mounted later', async () => {
    const probe = await renderHook(() => useMotionPreference());
    await act(async () => lastHandler()(true));
    await probe.unmount();

    const { result, unmount } = await renderHook(() => useMotionPreference());
    expect(result.current).toBe(true);
    await unmount();
  });
});

describe('MotionPreferenceSync (keeps Reanimated springs in step)', () => {
  it('overrides nothing while the setting matches the start-up value', async () => {
    const { unmount } = await render(<MotionPreferenceSync />);
    await act(async () => undefined); // the start-up read resolves false, same as at start
    expect(config).not.toHaveBeenCalled();
    await unmount();
  });

  it('switches every Reanimated animation to reduced when the user turns the setting on', async () => {
    const { unmount } = await render(<MotionPreferenceSync />);
    await act(async () => lastHandler()(true));
    expect(configuredMode()).toBe(ReduceMotion.Always);
    await unmount();
  });

  it('removes the override when the user turns it back off, so Reanimated restores its start value', async () => {
    const { toJSON, unmount } = await render(<MotionPreferenceSync />);
    const emit = lastHandler();
    await act(async () => emit(true));
    const callsWhileOn = config.mock.calls.length;

    await act(async () => emit(false));
    expect(config.mock.calls.length).toBe(callsWhileOn);
    expect(toJSON()).toBeNull();
    await unmount();
  });
});

describe('resetMotionPreferenceForTest', () => {
  it('refuses to reset while something is still subscribed', async () => {
    const { unmount } = await renderHook(() => useMotionPreference());
    expect(() => resetMotionPreferenceForTest()).toThrow(/unmount/);
    await unmount();
  });
});
