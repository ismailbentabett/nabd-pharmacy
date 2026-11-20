/**
 * The launch veil (ADR-052) covers the app like the native splash, lifts once Home is ready, never
 * takes a touch, and is invisible to screen readers. Under reduced motion it only fades.
 */
import { act, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { timingLaunchReveal, timingReducedFade } from '@/motion/springs';
import { LaunchVeil, onFirstScreenLayout, resetLaunchForTest, revealApp } from '@/ui/LaunchVeil';

import { renderWithProviders } from './helpers/render';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));

type Reaction = { prepare: () => unknown; react: (prepared: unknown, previous: unknown) => void };
let reaction: Reaction | undefined;

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetLaunchForTest();
  // A no-op in Reanimated's mock: captured here so the test can run it, as a frame would.
  jest.spyOn(Reanimated, 'useAnimatedReaction').mockImplementation((prepare, react) => {
    reaction = { prepare, react: react as Reaction['react'] };
  });
});

/** Home lays out, then the next frame runs the veil's reaction. */
async function revealAndFrame() {
  await act(async () => {
    revealApp();
    reaction?.react(reaction.prepare(), 0);
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LaunchVeil', () => {
  it('covers the app without taking touches or screen-reader focus', async () => {
    await renderWithProviders(<LaunchVeil />);
    expect(screen.queryByTestId('launch-veil')).toBeNull();
    const veil = screen.getByTestId('launch-veil', { includeHiddenElements: true });
    expect(veil.props.pointerEvents).toBe('none');
    expect(veil.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('waits for Home, then lifts with the reveal timing', async () => {
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    await renderWithProviders(<LaunchVeil />);
    expect(withTiming).not.toHaveBeenCalledWith(1, timingLaunchReveal, expect.anything());

    reaction?.react(reaction.prepare(), 0);
    expect(withTiming).not.toHaveBeenCalledWith(1, timingLaunchReveal, expect.anything());

    await revealAndFrame();
    expect(withTiming).toHaveBeenCalledWith(1, timingLaunchReveal, expect.any(Function));
  });

  it('only fades under reduced motion', async () => {
    const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
    addEventListener.mockClear();
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    await renderWithProviders(<LaunchVeil />);
    const emit = addEventListener.mock.calls.at(-1)?.[1] as (enabled: boolean) => void;
    await act(async () => emit(true));

    await revealAndFrame();
    expect(withTiming).toHaveBeenCalledWith(1, timingReducedFade, expect.any(Function));
    expect(withTiming).not.toHaveBeenCalledWith(1, timingLaunchReveal, expect.anything());
  });

  it('lifts on the first tab screen to lay out, whichever it is, and only once', async () => {
    const hide = jest.mocked(SplashScreen.hideAsync);
    hide.mockClear();
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    await renderWithProviders(<LaunchVeil />);

    // A web reload on /category: Category lays out first, Home never mounts.
    await act(async () => {
      onFirstScreenLayout();
      reaction?.react(reaction.prepare(), 0);
    });
    expect(hide).toHaveBeenCalledTimes(1);
    expect(withTiming).toHaveBeenCalledWith(1, timingLaunchReveal, expect.any(Function));

    // Later layouts (a rotation, another tab) do nothing.
    onFirstScreenLayout();
    onFirstScreenLayout();
    expect(hide).toHaveBeenCalledTimes(1);
  });
});
