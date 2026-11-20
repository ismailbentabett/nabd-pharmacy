/**
 * Skeletons share one pulse: however many are on screen, one animation runs, and it stops when the
 * last one goes away. Under reduced motion there is no shimmer layer and no animation at all.
 */
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, View } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { timingSkeletonPulse } from '@/motion/springs';
import { Skeleton, animatedSkeletonCountForTest } from '@/ui/Skeleton';

import { renderWithProviders } from './helpers/render';

function TwoBlocks() {
  return (
    <View>
      <Skeleton testID="sk-a" height={20} />
      <Skeleton testID="sk-b" height={20} />
    </View>
  );
}

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Skeleton', () => {
  it('starts one shared pulse for many blocks and stops it with the last one', async () => {
    const withRepeat = jest.spyOn(Reanimated, 'withRepeat');
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const cancelAnimation = jest.spyOn(Reanimated, 'cancelAnimation');

    const view = await renderWithProviders(<TwoBlocks />);
    expect(animatedSkeletonCountForTest()).toBe(2);
    expect(withRepeat).toHaveBeenCalledTimes(1);
    expect(withRepeat).toHaveBeenCalledWith(1, -1, true);
    expect(withTiming).toHaveBeenCalledWith(1, timingSkeletonPulse);
    expect(cancelAnimation).not.toHaveBeenCalled();

    await view.unmount();
    expect(animatedSkeletonCountForTest()).toBe(0);
    expect(cancelAnimation).toHaveBeenCalledTimes(1);
  });

  it('draws the shimmer layer on top of the base block', async () => {
    await renderWithProviders(<Skeleton testID="sk" height={20} />);
    expect(screen.getByTestId('sk', { includeHiddenElements: true }).children).toHaveLength(1);
  });

  it('is hidden from screen readers', async () => {
    await renderWithProviders(<Skeleton testID="sk" height={20} />);
    expect(screen.queryByTestId('sk')).toBeNull();
    expect(screen.getByTestId('sk', { includeHiddenElements: true }).props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
  });

  it('under reduced motion shows the base block only and runs no animation', async () => {
    const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
    addEventListener.mockClear();
    const first = await renderWithProviders(<Skeleton testID="sk-first" height={20} />);
    const emit = addEventListener.mock.calls.at(-1)?.[1] as (enabled: boolean) => void;
    await act(async () => emit(true));
    // The block that was shimmering stops and gives up its share of the pulse.
    expect(animatedSkeletonCountForTest()).toBe(0);
    expect(screen.getByTestId('sk-first', { includeHiddenElements: true }).children).toHaveLength(0);
    await first.unmount();

    const withRepeat = jest.spyOn(Reanimated, 'withRepeat');
    await renderWithProviders(<TwoBlocks />);
    expect(withRepeat).not.toHaveBeenCalled();
    expect(animatedSkeletonCountForTest()).toBe(0);
    expect(screen.getByTestId('sk-a', { includeHiddenElements: true }).children).toHaveLength(0);
  });

  it('can carry a still, faint brand mark above the shimmer', async () => {
    await renderWithProviders(<Skeleton testID="sk" height={120} markSize={40} />);
    const block = screen.getByTestId('sk', { includeHiddenElements: true });
    // Shimmer first, then the mark on top of it.
    expect(block.children).toHaveLength(2);
    expect(screen.getByTestId('sk-mark', { includeHiddenElements: true })).toBeTruthy();
  });
});
