/**
 * The cart badge: what it shows, when it shows nothing, that TalkBack never reads it twice (the
 * cart tab announces the count itself), and which animation each count change starts.
 */
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { spatialFast, timingMicro, timingReducedFade } from '@/motion/springs';
import { testIds } from '@/testIds';
import { BADGE_BUMP_SCALE, BADGE_DIP_OPACITY, BADGE_MAX, CartBadge, badgeLabel } from '@/ui/CartBadge';

import { renderWithProviders } from './helpers/render';

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function spyOnAnimations() {
  return {
    withTiming: jest.spyOn(Reanimated, 'withTiming'),
    withSpring: jest.spyOn(Reanimated, 'withSpring'),
    withSequence: jest.spyOn(Reanimated, 'withSequence'),
  };
}

describe('badgeLabel', () => {
  it('shows the count up to the cap and "99+" above it', () => {
    expect(badgeLabel(1)).toBe('1');
    expect(badgeLabel(BADGE_MAX)).toBe('99');
    expect(badgeLabel(BADGE_MAX + 1)).toBe('99+');
    expect(badgeLabel(1500)).toBe('99+');
  });
});

describe('CartBadge', () => {
  it('renders nothing for an empty cart', async () => {
    await renderWithProviders(<CartBadge count={0} />);
    expect(screen.queryByTestId(testIds.cartBadge, { includeHiddenElements: true })).toBeNull();
  });

  it('shows the count but stays hidden from screen readers', async () => {
    await renderWithProviders(<CartBadge count={3} />);
    expect(screen.queryByTestId(testIds.cartBadge)).toBeNull();
    const badge = screen.getByTestId(testIds.cartBadge, { includeHiddenElements: true });
    expect(badge.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('follows the count as it goes up and down, and disappears at zero', async () => {
    const { rerender } = await renderWithProviders(<CartBadge count={1} />);
    await rerender(<CartBadge count={120} />);
    expect(screen.getByText('99+', { includeHiddenElements: true })).toBeTruthy();
    await rerender(<CartBadge count={2} />);
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    await rerender(<CartBadge count={0} />);
    expect(screen.queryByTestId(testIds.cartBadge, { includeHiddenElements: true })).toBeNull();
  });
});

describe('CartBadge motion', () => {
  it('bumps (swell, then spring back) when the count goes up', async () => {
    const { rerender } = await renderWithProviders(<CartBadge count={1} />);
    const spies = spyOnAnimations();
    await rerender(<CartBadge count={2} />);
    expect(spies.withTiming).toHaveBeenCalledWith(BADGE_BUMP_SCALE, timingMicro);
    expect(spies.withSpring).toHaveBeenCalledWith(1, spatialFast);
    expect(spies.withSequence).toHaveBeenCalledTimes(1);
  });

  it('pops in from nothing on the first item, without the swell', async () => {
    const { rerender } = await renderWithProviders(<CartBadge count={0} />);
    const spies = spyOnAnimations();
    await rerender(<CartBadge count={1} />);
    expect(spies.withSpring).toHaveBeenCalledWith(1, spatialFast);
    expect(spies.withTiming).not.toHaveBeenCalledWith(BADGE_BUMP_SCALE, expect.anything());
  });

  it('does not celebrate a removal', async () => {
    const { rerender } = await renderWithProviders(<CartBadge count={3} />);
    const spies = spyOnAnimations();
    await rerender(<CartBadge count={2} />);
    expect(spies.withTiming).not.toHaveBeenCalled();
    expect(spies.withSpring).not.toHaveBeenCalled();
    expect(spies.withSequence).not.toHaveBeenCalled();
  });

  it('under reduced motion dips the opacity instead of scaling', async () => {
    const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
    addEventListener.mockClear();
    const { rerender } = await renderWithProviders(<CartBadge count={1} />);
    const emit = addEventListener.mock.calls.at(-1)?.[1] as (enabled: boolean) => void;
    await act(async () => emit(true));

    const spies = spyOnAnimations();
    await rerender(<CartBadge count={2} />);
    expect(spies.withTiming).toHaveBeenCalledWith(BADGE_DIP_OPACITY, timingReducedFade);
    expect(spies.withTiming).not.toHaveBeenCalledWith(BADGE_BUMP_SCALE, expect.anything());
    expect(spies.withSpring).not.toHaveBeenCalled();
  });
});
