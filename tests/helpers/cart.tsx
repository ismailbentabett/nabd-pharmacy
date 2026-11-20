/**
 * Shared set-up for the Cart screen tests (cartScreen, cartUndo, cartSwipe).
 *
 * Gestures go through Gesture Handler's own test controller, which calls the pan's worklets on the
 * JS thread. Jest has no UI thread and Reanimated's mock finishes every spring at once (and never runs
 * `useAnimatedReaction`), so these tests check outcomes (which line is gone, what the bar says, which
 * animation was asked for), not frames. How it feels is checked on the phone.
 *
 * Each test file still declares its own `jest.mock('expo-router', …)`: Jest hoists mocks per file.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { findProduct, type Product } from '@/core/catalog';
import { CartScreen } from '@/features/cart/CartScreen';
import { ACTIVE_OFFSET } from '@/features/cart/swipeMath';
import type { Lang } from '@/i18n/format';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { cartActions } from '@/state/cart.store';
import { testIds } from '@/testIds';

import { renderWithProviders } from './render';

const METRICS = { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

/** 5,950.00 DA: the TVA share is exactly 950.00. */
export const P5950 = 'p-0296';
/** 350.00 DA. */
export const P350 = 'p-0380';
/** 1,650.00 DA. */
export const P1650 = 'p-0001';
/** 450.00 DA. */
export const P450 = 'p-0002';

export function product(id: string): Product {
  const found = findProduct(id);
  if (!found) throw new Error(`${id} is not in the catalog`);
  return found;
}

/** Let scheduled JS calls (scheduleOnRN), worklets queued for the UI thread and the renders they cause finish. */
export async function settle() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

export async function renderCart(lang: Lang = 'en') {
  const result = await renderWithProviders(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <CartScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>,
    { lang },
  );
  await settle();
  return result;
}

/** The common beforeEach: default motion, fresh haptics, cleared mocks, empty cart. */
export async function resetCartTest() {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  jest.clearAllMocks();
  await act(() => cartActions.clear());
}

// Row totals are hidden from screen readers (the line label already says them), so look in hidden elements too.
export const text = (testID: string) =>
  screen.getByTestId(testID, { includeHiddenElements: true }).props.children as string;
export const rowOrder = () => screen.getAllByTestId(/^cart-row-p-\d+$/).map((row) => row.props.testID as string);
export const plus = (id: string) => `${testIds.cartRowQty(id)}-increment`;
export const minus = (id: string) => `${testIds.cartRowQty(id)}-decrement`;

/**
 * The handler a native press reaches (what `fireEvent(..., 'buttonPress')` calls). Calling it twice
 * inside one act is two taps landing before React re-renders, which fireEvent cannot express.
 */
export function nativePress(testID: string, { includeHiddenElements = false } = {}): () => void {
  let node: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId(testID, { includeHiddenElements });
  while (node) {
    const handler: unknown = node.props.onButtonPress;
    if (typeof handler === 'function') return () => handler({ nativeEvent: {} });
    node = node.parent;
  }
  throw new Error(`${testID} has no native press handler`);
}

/** Give a row its width, as the first layout pass on a phone would. Jest never lays anything out. */
export async function layoutRow(id: string, width = 400) {
  await fireEvent(screen.getByTestId(testIds.cartRow(id)), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 120 } },
  });
}

/** A whole swipe on one row: touch, cross the slop, drag, let go. Positive X is to the right. */
export async function swipeRow(id: string, translationX: number, velocityX: number) {
  const pan = createGestureController<{ translationX: number; velocityX: number }>(testIds.cartRowSwipe(id));
  const slop = Math.sign(translationX) * ACTIVE_OFFSET;
  await act(async () => {
    pan.begin({ translationX: 0, velocityX: 0 });
    pan.activate({ translationX: slop, velocityX });
    pan.update({ translationX, velocityX });
    pan.end({ translationX, velocityX });
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  await settle();
}

/** A touch that never becomes a swipe (a tap, or the list scrolling), at `x` from the row's left edge. */
export async function touchRow(id: string, x: number) {
  const pan = createGestureController<{ x: number; translationX: number; velocityX: number }>(
    testIds.cartRowSwipe(id),
  );
  await act(async () => {
    pan.begin({ x, translationX: 0, velocityX: 0 });
    pan.end({ x, translationX: 0, velocityX: 0 });
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  await settle();
}
