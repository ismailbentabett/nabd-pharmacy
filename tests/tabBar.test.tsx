/**
 * The tab bar's contract with expo-router: it emits `tabPress` before navigating, respects a
 * listener's `preventDefault`, never re-navigates to the tab you are on, and tells TalkBack which
 * tab is selected and how many items are in the cart. The pill under the active icon starts moving
 * in the press handler (not after navigation) and mirrors for Arabic.
 */
import { act, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, type ViewStyle } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { spatialDefault } from '@/motion/springs';
import { cartActions } from '@/state/cart.store';
import { testIds } from '@/testIds';
import { INDICATOR_WIDTH, TabBar, indicatorOffset } from '@/ui/TabBar';

import { pressNative, renderWithProviders } from './helpers/render';

const routes = [
  { key: 'index-k', name: 'index' },
  { key: 'category-k', name: 'category' },
  { key: 'cart-k', name: 'cart' },
];

function makeProps(index: number, defaultPrevented = false) {
  const emit = jest.fn(() => ({ defaultPrevented }));
  const navigateToTab = jest.fn();
  const props = {
    state: { index, routes },
    descriptors: {},
    emitter: { emit },
    navigateToTab,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
  return { props, emit, navigateToTab };
}

function indicatorStyle(): ViewStyle {
  return StyleSheet.flatten(screen.getByTestId(testIds.tabIndicator).props.style) as ViewStyle;
}

function indicatorTranslateX(): number {
  const transform = indicatorStyle().transform as readonly { translateX?: number }[];
  const step = transform.find((t) => t.translateX !== undefined);
  if (step?.translateX === undefined) throw new Error('indicator has no translateX');
  return step.translateX;
}

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  cartActions.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TabBar', () => {
  it('emits tabPress and then navigates to the pressed tab', async () => {
    const { props, emit, navigateToTab } = makeProps(0);
    await renderWithProviders(<TabBar {...props} />);
    await pressNative(testIds.tab.cart);
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'cart-k', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith('cart-k');
  });

  it('does not navigate when the pressed tab is already selected', async () => {
    const { props, emit, navigateToTab } = makeProps(1);
    await renderWithProviders(<TabBar {...props} />);
    await pressNative(testIds.tab.category);
    // The event still goes out, so a screen can scroll to top on a re-press.
    expect(emit).toHaveBeenCalledTimes(1);
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('does not navigate when a listener prevents the default', async () => {
    const { props, navigateToTab } = makeProps(0, true);
    await renderWithProviders(<TabBar {...props} />);
    await pressNative(testIds.tab.cart);
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('groups the tabs in a tablist and marks only the focused one as selected', async () => {
    const { props } = makeProps(2);
    await renderWithProviders(<TabBar {...props} />);
    expect(screen.getByTestId(testIds.tabRow).props.accessibilityRole).toBe('tablist');
    const cart = screen.getByTestId(testIds.tab.cart);
    expect(cart.props.accessibilityRole).toBe('tab');
    expect(cart.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId(testIds.tab.index).props.accessibilityState).toMatchObject({ selected: false });
  });

  it('reads the cart count as part of the cart tab label, in both languages', async () => {
    const { props } = makeProps(0);
    const view = await renderWithProviders(<TabBar {...props} />);
    expect(screen.getByTestId(testIds.tab.cart).props.accessibilityLabel).toBe('Cart, empty');

    await act(() => cartActions.add('p-0001', 2));
    expect(screen.getByTestId(testIds.tab.cart).props.accessibilityLabel).toBe('Cart, 2 items');
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    await view.unmount();

    await renderWithProviders(<TabBar {...props} />, { lang: 'ar' });
    expect(screen.getByTestId(testIds.tab.cart).props.accessibilityLabel).toBe('السلة، منتجان');
  });

  it('starts the pill towards the pressed tab before navigation happens', async () => {
    const { props, navigateToTab } = makeProps(0);
    await renderWithProviders(<TabBar {...props} />);
    const withSpring = jest.spyOn(Reanimated, 'withSpring');

    await pressNative(testIds.tab.cart);

    expect(withSpring).toHaveBeenCalledWith(2, spatialDefault);
    // The spring was started inside the press handler, ahead of the navigation call.
    const springOrder = withSpring.mock.invocationCallOrder[0] ?? Infinity;
    const navigateOrder = navigateToTab.mock.invocationCallOrder[0] ?? -Infinity;
    expect(springOrder).toBeLessThan(navigateOrder);
  });

  it('does not move the pill when the press is prevented', async () => {
    const { props } = makeProps(0, true);
    await renderWithProviders(<TabBar {...props} />);
    const withSpring = jest.spyOn(Reanimated, 'withSpring');
    await pressNative(testIds.tab.cart);
    expect(withSpring).not.toHaveBeenCalled();
  });

  it('keeps the indicator hidden until the row is measured', async () => {
    const { props } = makeProps(0);
    await renderWithProviders(<TabBar {...props} />);
    expect(indicatorStyle().opacity).toBe(0);
  });

  it('mirrors the pill offset for Arabic (transforms do not flip on their own)', async () => {
    const { props } = makeProps(0);
    const en = await renderWithProviders(<TabBar {...props} />);
    const ltr = indicatorTranslateX();
    expect(ltr).toBe(indicatorOffset(0, 0));
    await en.unmount();

    await renderWithProviders(<TabBar {...props} />, { lang: 'ar' });
    expect(indicatorTranslateX()).toBe(-ltr);
  });
});

describe('indicatorOffset', () => {
  it('centres the pill under the tab at any (fractional) position', () => {
    expect(indicatorOffset(0, 120)).toBe((120 - INDICATOR_WIDTH) / 2);
    expect(indicatorOffset(2, 120)).toBe(240 + (120 - INDICATOR_WIDTH) / 2);
    expect(indicatorOffset(0.5, 120)).toBe(60 + (120 - INDICATOR_WIDTH) / 2);
  });
});
