/**
 * The Home screen (H-01..H-04, G-08, G-09, F-03, F-05, F-07).
 *
 * The fake API answers at once and never fails on its own; the error test switches failures on.
 * The router, the splash screen and the status bar are stand-ins that record their calls.
 *
 * Three things about Reanimated under Jest shape these tests:
 * - Its `useSharedValue` hands out a fresh value on every render. On a device a shared value lives
 *   as long as the component, and the carousel and the quick-add button rely on that, so here it
 *   does too (`useKeptSharedValue`).
 * - Its mock finishes every animation at once, so the tests check which animation starts and with
 *   what settings, not the frames in between.
 * - Animated styles are read only when the component renders, so a test re-renders to see them.
 *
 * The autoplay tests run on Jest's fake clock: the carousel's 4 s timeout, and the frame the UI
 * thread job waits for, only fire when the test moves the clock.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Profiler, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BANNERS, CATEGORIES, getCatalog, type Product } from '@/core/catalog';
import { radius, size } from '@/design/tokens';
import { bannerPanTestId } from '@/features/home/BannerCarousel';
import { BestSellerCard, CARD_WIDTH } from '@/features/home/BestSellerCard';
import { AUTOPLAY_MS } from '@/features/home/carouselMath';
import { HomeScreen } from '@/features/home/HomeScreen';
import { QuickAddButton } from '@/features/home/QuickAddButton';
import type { Lang } from '@/i18n/format';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetProductOpenLatchForTest } from '@/motion/hero/openProduct';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { ADDED_HOLD_MS } from '@/motion/springs';
import { fakeApi as api } from '@/state/api';
import { cartActions, getCartState, useCartCount } from '@/state/cart.store';
import { testIds } from '@/testIds';
import { resetLaunchForTest } from '@/ui/LaunchVeil';

import { testQueryClient } from './helpers/queryClient';
import { pressNative, renderWithProviders } from './helpers/render';

jest.mock('@/state/api', () => {
  const fake = jest.requireActual('@/core/api/fakeApi').createFakeApi({ delayMs: [0, 0], chaos: 0 });
  return { api: fake, fakeApi: fake };
});

const mockFocus = { focused: true };
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useIsFocused: () => mockFocus.focused,
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-status-bar', () => ({ StatusBar: { setStyle: jest.fn() } }));

const navigate = jest.mocked(router.navigate);
const push = jest.mocked(router.push);
const hideAsync = jest.mocked(SplashScreen.hideAsync);
const setStatusBarStyle = jest.mocked(StatusBar.setStyle);

const METRICS = { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

/** A shared value that survives re-renders, as it does on a device. */
function useKeptSharedValue<Value>(initial: Value | (() => Value)): Reanimated.SharedValue<Value> {
  const [value] = useState(() => Reanimated.makeMutable(initial instanceof Function ? initial() : initial));
  return value;
}

function firstBestSeller(): Product {
  const product = getCatalog().bestSellers[0];
  if (!product) throw new Error('The catalog has no best sellers');
  return product;
}

function bestSellerAt(index: number): Product {
  const product = getCatalog().bestSellers[index];
  if (!product) throw new Error(`The catalog has no best seller ${index}`);
  return product;
}

/** What the rail should show once the request is done: the cards, or the retry row. */
type LandsOn = 'cards' | 'error' | 'nothing';

async function renderHome(lang: Lang = 'en', landsOn: LandsOn = 'cards') {
  const result = await renderWithProviders(
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <QueryClientProvider client={testQueryClient()}>
          <HomeScreen />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>,
    { lang },
  );
  if (landsOn === 'cards') await screen.findByTestId(testIds.homeBestSeller(firstBestSeller().id));
  else if (landsOn === 'error') await screen.findByTestId(`${testIds.homeBestSellers}-error`);
  // 'nothing': let the system reads (reduce motion, screen reader) resolve, without moving the clock.
  else await flush();
  return result;
}

/** Let promises and the renders they cause finish, without moving the clock. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** The listener the app registered last for a system event of this name. */
function lastListener<Payload>(
  addEventListener: jest.Mock | ((...args: never[]) => unknown),
  eventName: string,
): (payload: Payload) => void {
  const calls = jest.mocked(addEventListener).mock.calls as unknown as [string, (payload: Payload) => void][];
  const listener = calls.filter(([name]) => name === eventName).at(-1)?.[1];
  if (!listener) throw new Error(`Nothing listens to ${eventName}`);
  return listener;
}

/** The user switches reduce motion on or off in the system settings while the app is open. */
async function emitReduceMotion(enabled: boolean) {
  const emit = lastListener<boolean>(AccessibilityInfo.addEventListener, 'reduceMotionChanged');
  await act(async () => emit(enabled));
}

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  resetProductOpenLatchForTest();
  resetLaunchForTest();
  jest.clearAllMocks();
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(useKeptSharedValue);
  cartActions.clear();
  mockFocus.focused = true;
  api.debug.forceFailure = false;
});

afterEach(() => {
  // Spies only: the module mocks above (router, splash, status bar) keep their stand-ins.
  jest.restoreAllMocks();
  // A test that moved to the fake clock gives the real one back, even when it failed half way.
  jest.useRealTimers();
});

describe('Home renders its sections', () => {
  it.each(['en', 'ar'] as const)('header, banner, every category and the best sellers (%s)', async (lang) => {
    const { unmount } = await renderHome(lang);
    const product = firstBestSeller();

    expect(screen.getByTestId(testIds.screen.home)).toBeTruthy();
    expect(screen.getByTestId(testIds.homeSearch)).toBeTruthy();
    expect(screen.getByTestId(testIds.langToggle)).toBeTruthy();
    // Autoplay runs on the real clock, so a slow machine may already show a later banner.
    expect(BANNERS.map((b) => `${b[lang].title}. ${b[lang].sub}`)).toContain(
      screen.getByTestId(testIds.homeBanner).props.accessibilityLabel,
    );
    for (const category of CATEGORIES) {
      expect(screen.getByTestId(testIds.homeCategory(category.id)).props.accessibilityLabel).toBe(category[lang]);
    }
    expect(screen.getByTestId(testIds.homeBestSeller(product.id))).toBeTruthy();
    expect(screen.getByText(lang === 'en' ? 'Best sellers' : 'الأكثر مبيعاً')).toBeTruthy();
    expect(screen.getByTestId(testIds.homeQuickAdd(product.id)).props.accessibilityLabel).toBe(
      lang === 'en' ? `Add ${product.name} to cart` : `إضافة ${product.nameAr} إلى السلة`,
    );
    await unmount();
  });

  it('labels every control for the screen reader (English)', async () => {
    const { unmount } = await renderHome('en');
    const search = screen.getByTestId(testIds.homeSearch);
    expect(search.props.accessibilityRole).toBe('button');
    expect(search.props.accessibilityLabel).toBe('Search medicines, vitamins, skincare…');
    expect(screen.getByLabelText('Deliver to Riyadh')).toBeTruthy();
    expect(screen.getByTestId(testIds.homeSeeAll).props.accessibilityLabel).toBe('See all, Shop by category');

    const banner = screen.getByTestId(testIds.homeBanner);
    expect(banner.props.accessibilityRole).toBe('adjustable');
    expect(banner.props.accessibilityValue).toEqual({ text: `Promotion 1 of ${BANNERS.length}` });
    await unmount();
  });

  it('shows a retry row when best sellers fail, and the rail after a retry (D-05)', async () => {
    api.debug.forceFailure = true;
    const { unmount } = await renderHome('en', 'error');
    expect(screen.queryByTestId(testIds.homeBestSeller(firstBestSeller().id))).toBeNull();

    api.debug.forceFailure = false;
    await pressNative(`${testIds.homeBestSellers}-error`);
    expect(await screen.findByTestId(testIds.homeBestSeller(firstBestSeller().id))).toBeTruthy();
    await unmount();
  });

  it('answers Retry at once with the skeleton row, while the new request is still out (F-03)', async () => {
    api.debug.forceFailure = true;
    const { unmount } = await renderHome('en', 'error');

    // Hold the retry's answer, so the test can look at the rail while it waits.
    let answer: (products: readonly Product[]) => void = () => undefined;
    jest.spyOn(api, 'getBestSellers').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    await pressNative(`${testIds.homeBestSellers}-error`);
    // TanStack Query hands its state to React on a zero timeout, so the skeleton lands one tick after
    // the press. The request is still held here, so this is the retry's own loading state.
    expect(await screen.findByTestId(`${testIds.homeBestSellers}-loading`)).toBeTruthy();
    expect(screen.queryByTestId(`${testIds.homeBestSellers}-error`)).toBeNull();

    await act(async () => answer(getCatalog().bestSellers));
    expect(await screen.findByTestId(testIds.homeBestSeller(firstBestSeller().id))).toBeTruthy();
    await unmount();
  });

  it('waits on skeleton cards with the real card shell: width, border and corners', async () => {
    // On the fake clock the request (a 0 ms timeout) cannot answer until the test lets it.
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
    const { unmount } = await renderHome('en', 'nothing');
    for (const i of [0, 1, 2]) {
      expect(screen.getByTestId(`${testIds.homeBestSellers}-skeleton-${i}`)).toHaveStyle({
        width: CARD_WIDTH,
        borderWidth: size.hairline,
        borderRadius: radius.tile,
      });
    }
    await screen.findByTestId(testIds.homeBestSeller(firstBestSeller().id));
    expect(screen.queryByTestId(`${testIds.homeBestSellers}-loading`)).toBeNull();
    await unmount();
  });
});

describe('the collapsing header (H-01)', () => {
  it('shrinks only the field surface, so the field keeps its gutter and its 48 dp touch box', async () => {
    const { unmount } = await renderHome('en', 'nothing');
    const field = screen.getByTestId(testIds.homeSearch);
    // The control itself never scales (a uniform scale would pull its edges off the 16 dp gutter).
    expect(field).not.toHaveStyle({ transform: expect.anything() });
    expect(field).toHaveStyle({ height: size.touch });

    const surface = screen.getByTestId(`${testIds.homeSearch}-surface`);
    // Logical insets: the surface fills the field in English and Arabic alike.
    expect(surface).toHaveStyle({ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 });
    // One transform, vertical only: the surface's start and end edges never move.
    const transform = StyleSheet.flatten(surface.props.style).transform ?? [];
    expect(Array.isArray(transform) ? transform.map((part) => Object.keys(part)) : transform).toEqual([['scaleY']]);
    await unmount();
  });
});

describe('Home sends the user to the right place', () => {
  it('a category tile opens the Category tab filtered to it', async () => {
    const { unmount } = await renderHome();
    const category = CATEGORIES[2];
    if (!category) throw new Error('Not enough categories');
    await pressNative(testIds.homeCategory(category.id));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ pathname: '/category', params: { category: category.id } });
    await unmount();
  });

  it('search and "See all" open the whole catalogue; a best seller opens its product', async () => {
    const { unmount } = await renderHome();
    await pressNative(testIds.homeSearch);
    await pressNative(testIds.homeSeeAll);
    // "All" is sent explicitly, so a category the user picked earlier on the tab does not survive.
    const all = { pathname: '/category', params: { category: 'all' } };
    expect(navigate.mock.calls).toEqual([[all], [all]]);

    const product = firstBestSeller();
    await pressNative(testIds.homeBestSeller(product.id));
    expect(push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: product.id } });
    await unmount();
  });

  it('the banner pages with the screen reader actions and opens its category on activate', async () => {
    const { unmount } = await renderHome();
    const banner = () => screen.getByTestId(testIds.homeBanner);
    const act11y = async (actionName: string) => {
      await fireEvent(banner(), 'accessibilityAction', { nativeEvent: { actionName } });
    };

    await act11y('decrement'); // already on the first page: stays there
    expect(banner().props.accessibilityValue).toEqual({ text: `Promotion 1 of ${BANNERS.length}` });
    await act11y('increment');
    expect(banner().props.accessibilityValue).toEqual({ text: `Promotion 2 of ${BANNERS.length}` });
    await act11y('activate');
    expect(navigate).toHaveBeenCalledWith({ pathname: '/category', params: { category: BANNERS[1]?.category } });
    await unmount();
  });
});

describe('quick add (H-04, F-03)', () => {
  it('adds exactly one per press, with a haptic and a spoken confirmation', async () => {
    const { unmount } = await renderHome();
    const product = firstBestSeller();

    await pressNative(testIds.homeQuickAdd(product.id));
    expect(getCartState().byId[product.id]?.qty).toBe(1);
    await pressNative(testIds.homeQuickAdd(product.id));
    expect(getCartState().byId[product.id]?.qty).toBe(2);
    expect(getCartState().ids).toEqual([product.id]);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Added');
    // The quick add is its own button: the press never also opened the product.
    expect(push).not.toHaveBeenCalled();
    await unmount();
  });

  function renderQuickAdd(product: Product) {
    return renderWithProviders(
      <GestureHandlerRootView>
        <QuickAddButton productId={product.id} name={product.name} />
      </GestureHandlerRootView>,
    );
  }

  it('holds the tick for ADDED_HOLD_MS before turning back to the plus', async () => {
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    const product = firstBestSeller();
    const { unmount } = await renderQuickAdd(product);
    await flush();

    await pressNative(testIds.homeQuickAdd(product.id));
    expect(withDelay).toHaveBeenCalledTimes(1);
    expect(withDelay).toHaveBeenCalledWith(ADDED_HOLD_MS, expect.anything(), Reanimated.ReduceMotion.Never);
    await unmount();
  });

  it('keeps the same hold under reduce motion: a pause is not movement (G-09)', async () => {
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    const withSpring = jest.spyOn(Reanimated, 'withSpring');
    const product = firstBestSeller();
    const { unmount } = await renderQuickAdd(product);
    await flush();
    await emitReduceMotion(true);

    await pressNative(testIds.homeQuickAdd(product.id));
    // Reanimated skips a delay under reduce motion unless told not to: the hold says Never.
    expect(withDelay).toHaveBeenCalledWith(ADDED_HOLD_MS, expect.anything(), Reanimated.ReduceMotion.Never);
    // The icons only cross-fade: no spring.
    expect(withSpring).not.toHaveBeenCalled();
    await unmount();
  });

  it('a recycled button showing another product starts from the plus, not the old tick', async () => {
    // The mock sequence would end at 0 at once; hold it at "added" (1) to see what a recycle does.
    jest.spyOn(Reanimated, 'withSequence').mockReturnValue(1);
    const cancelAnimation = jest.spyOn(Reanimated, 'cancelAnimation');
    const a = bestSellerAt(0);
    const b = bestSellerAt(1);
    const ui = (product: Product) => (
      <GestureHandlerRootView>
        <QuickAddButton productId={product.id} name={product.name} />
      </GestureHandlerRootView>
    );
    const { rerender, unmount } = await renderWithProviders(ui(a));
    await flush();

    await pressNative(testIds.homeQuickAdd(a.id));
    await rerender(ui(a));
    expect(screen.getByTestId(`${testIds.homeQuickAdd(a.id)}-check`)).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId(`${testIds.homeQuickAdd(a.id)}-plus`)).toHaveStyle({ opacity: 0 });
    cancelAnimation.mockClear();

    // FlashList hands the same button another product.
    await rerender(ui(b));
    expect(cancelAnimation).toHaveBeenCalledTimes(1);
    await rerender(ui(b));
    expect(screen.getByTestId(`${testIds.homeQuickAdd(b.id)}-check`)).toHaveStyle({ opacity: 0 });
    expect(screen.getByTestId(`${testIds.homeQuickAdd(b.id)}-plus`)).toHaveStyle({ opacity: 1 });
    await unmount();
  });
});

function CartCountProbe() {
  return <Text testID="cart-count-probe">{String(useCartCount())}</Text>;
}

describe('F-05: a cart change re-renders no best-seller card', () => {
  it('commits nothing inside a card when the cart count changes', async () => {
    const product = firstBestSeller();
    const onRender = jest.fn();
    const { unmount } = await renderWithProviders(
      <GestureHandlerRootView>
        <Profiler id="card" onRender={onRender}>
          <BestSellerCard product={product} />
        </Profiler>
        <CartCountProbe />
      </GestureHandlerRootView>,
    );
    await flush();
    const commitsBefore = onRender.mock.calls.length;

    await act(async () => cartActions.add(product.id));
    await act(async () => cartActions.add(bestSellerAt(1).id));
    expect(screen.getByTestId('cart-count-probe')).toHaveTextContent('2');
    expect(onRender).toHaveBeenCalledTimes(commitsBefore);
    await unmount();
  });

  it('commits nothing in the whole Home screen either, quick add included', async () => {
    const onRender = jest.fn();
    const { unmount } = await renderWithProviders(
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={METRICS}>
          <QueryClientProvider client={testQueryClient()}>
            <Profiler id="home" onRender={onRender}>
              <HomeScreen />
            </Profiler>
          </QueryClientProvider>
        </SafeAreaProvider>
        <CartCountProbe />
      </GestureHandlerRootView>,
    );
    await screen.findByTestId(testIds.homeBestSeller(firstBestSeller().id));
    await flush();
    const commitsBefore = onRender.mock.calls.length;

    await act(async () => cartActions.add(bestSellerAt(1).id));
    expect(screen.getByTestId('cart-count-probe')).toHaveTextContent('1');
    expect(onRender).toHaveBeenCalledTimes(commitsBefore);
    await unmount();
  });
});

describe('banner autoplay (H-02, G-09)', () => {
  /** The frame the UI-thread job waits for, plus a little: enough for one autoplay step to land. */
  const FRAME_MS = 50;
  const page = () => screen.getByTestId(testIds.homeBanner).props.accessibilityValue;
  const shows = (n: number, lang: Lang = 'en') => ({
    text: lang === 'en' ? `Promotion ${n} of ${BANNERS.length}` : `العرض ${n} من ${BANNERS.length}`,
  });

  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  beforeEach(() => {
    // The scheduled React updates (`scheduleOnRN`) run as microtasks; keep those real.
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  });

  it.each(['en', 'ar'] as const)('turns one page every AUTOPLAY_MS while Home is in view (%s)', async (lang) => {
    const { unmount } = await renderHome(lang, 'nothing');
    expect(page()).toEqual(shows(1, lang));

    await advance(AUTOPLAY_MS - 1);
    expect(page()).toEqual(shows(1, lang));
    await advance(FRAME_MS);
    expect(page()).toEqual(shows(2, lang));

    // The next turn starts its own full count from the page change.
    await advance(AUTOPLAY_MS - FRAME_MS - 1);
    expect(page()).toEqual(shows(2, lang));
    await advance(2 * FRAME_MS);
    expect(page()).toEqual(shows(3, lang));
    await unmount();
  });

  it('pauses while a finger is on the banner, and gives a full AUTOPLAY_MS after the lift', async () => {
    const { unmount } = await renderHome('en', 'nothing');
    const pan = createGestureController<{ translationX: number; velocityX: number }>(bannerPanTestId);

    await advance(AUTOPLAY_MS / 2);
    await act(async () => pan.begin({ translationX: 0, velocityX: 0 }));
    await advance(3 * AUTOPLAY_MS);
    expect(page()).toEqual(shows(1));

    // The touch never became a swipe (a tap, or the start of a vertical scroll).
    await act(async () => pan.fail({ translationX: 0, velocityX: 0 }));
    await advance(AUTOPLAY_MS - 1);
    expect(page()).toEqual(shows(1));
    await advance(FRAME_MS);
    expect(page()).toEqual(shows(2));
    await unmount();
  });

  it('a swipe to the next page counts as the turn: the timer restarts from it', async () => {
    const { unmount } = await renderHome('en', 'nothing');
    const pan = createGestureController<{ translationX: number; velocityX: number }>(bannerPanTestId);

    await act(async () => pan.begin({ translationX: 0, velocityX: 0 }));
    await act(async () => pan.activate({ translationX: -12, velocityX: -1500 }));
    await act(async () => pan.update({ translationX: -300, velocityX: -1500 }));
    await act(async () => pan.end({ translationX: -300, velocityX: -1500 }));
    expect(page()).toEqual(shows(2));

    await advance(AUTOPLAY_MS - 1);
    expect(page()).toEqual(shows(2));
    await advance(FRAME_MS);
    expect(page()).toEqual(shows(3));
    await unmount();
  });

  it('stays still under reduced motion, and starts when the setting is turned off', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    const { unmount } = await renderHome('en', 'nothing');
    await advance(3 * AUTOPLAY_MS);
    expect(page()).toEqual(shows(1));

    await emitReduceMotion(false);
    await advance(AUTOPLAY_MS + FRAME_MS);
    expect(page()).toEqual(shows(2));
    await unmount();
  });

  it('stays still while a screen reader is on, and while Home is not the visible tab', async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValueOnce(true);
    const first = await renderHome('en', 'nothing');
    await advance(3 * AUTOPLAY_MS);
    expect(page()).toEqual(shows(1));
    await first.unmount();

    mockFocus.focused = false;
    const second = await renderHome('en', 'nothing');
    await advance(3 * AUTOPLAY_MS);
    expect(page()).toEqual(shows(1));
    await second.unmount();
  });

  it('stops in the background and starts a full count on return (no overdue turn)', async () => {
    const { unmount } = await renderHome('en', 'nothing');
    const emitAppState = lastListener<AppStateStatus>(AppState.addEventListener, 'change');

    await advance(AUTOPLAY_MS - 100);
    await act(async () => emitAppState('background'));
    await advance(3 * AUTOPLAY_MS);
    expect(page()).toEqual(shows(1));

    await act(async () => emitAppState('active'));
    await advance(AUTOPLAY_MS - 1);
    expect(page()).toEqual(shows(1));
    await advance(FRAME_MS);
    expect(page()).toEqual(shows(2));
    await unmount();
  });
});

describe('start-up and system chrome (F-07)', () => {
  it('hides the splash once, on the first layout', async () => {
    const { unmount } = await renderHome();
    const root = screen.getByTestId(testIds.screen.home);
    const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 900 } } };
    await fireEvent(root, 'layout', layout);
    await fireEvent(root, 'layout', layout);
    expect(hideAsync).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('asks for light status bar icons over the pine header, and gives them back on leave', async () => {
    const { unmount } = await renderHome();
    expect(setStatusBarStyle).toHaveBeenLastCalledWith('light');
    await unmount();
    expect(setStatusBarStyle).toHaveBeenLastCalledWith('auto');
  });
});
