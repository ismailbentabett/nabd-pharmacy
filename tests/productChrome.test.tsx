/**
 * The product page while it moves (P-01, P-02, F-04, G-08): when the header and the bar take
 * touches, the gallery after a close that a finger interrupted, and which way the back gestures
 * close in each language.
 *
 * Reanimated's mock ends every animation at once; `hold` keeps the callbacks of the transition's
 * springs and fades so a test can look at the page mid-transition, then end them itself.
 *
 * The gestures run through Gesture Handler's test controller, which delivers the events but does
 * not run the native activation rules (activeOffsetX / failOffsetX). On a device a drag towards
 * the start fails before it activates; here it is activated anyway, to pin that the maths behind
 * it can never close the page that way either.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Dimensions, StyleSheet, type View } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';

import type { Rect } from '@/motion/hero/heroMath';
import { registerHeroSource } from '@/motion/hero/registry';
import { getCartState } from '@/state/cart.store';
import { testIds } from '@/testIds';

import {
  galleryPageText,
  isTouchBlocked,
  product,
  renderProduct,
  resetProductTests,
  settle,
  untilInteractive,
} from './helpers/productHarness';
import { pressNative } from './helpers/render';

jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/productRouter')>('./helpers/productRouter').productRouterMock);

const back = jest.mocked(router.back);
type Finish = (finished?: boolean) => void;

let held: { to: number; finish: Finish }[] = [];
let hold = (_to: number) => false;

beforeEach(() => {
  resetProductTests();
  held = [];
  hold = () => false;
  const keepOrFinish = (toValue: unknown, callback?: Finish) => {
    if (callback && typeof toValue === 'number' && hold(toValue)) held.push({ to: toValue, finish: callback });
    else callback?.(true);
  };
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((toValue, _config, callback) => {
    keepOrFinish(toValue, callback);
    return toValue;
  });
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((toValue, _config, callback) => {
    keepOrFinish(toValue, callback);
    return toValue;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Ends the oldest held animation, as a device would: `true` when it lands, `false` if cancelled. */
async function finishHeld(finished: boolean) {
  const next = held.shift();
  if (!next) throw new Error('No animation is running');
  await act(async () => next.finish(finished));
  await settle();
}

/** A finger drag on one of the page's back gestures: activated after 10 pt, then released. */
async function dragGesture(testID: string, x: number, y: number, vx: number, vy: number) {
  type Pan = { translationX: number; translationY: number; velocityX: number; velocityY: number };
  const pan = createGestureController<Pan>(testID);
  await act(async () => {
    pan.begin({ translationX: 0, translationY: 0, velocityX: 0, velocityY: 0 });
    pan.activate({ translationX: Math.sign(x) * 10, translationY: Math.sign(y) * 10, velocityX: vx, velocityY: vy });
    pan.update({ translationX: x, translationY: y, velocityX: vx, velocityY: vy });
    pan.end({ translationX: x, translationY: y, velocityX: vx, velocityY: vy });
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  await settle();
}

/** The gallery row's translateX: which image is actually in view. */
function rowTranslateX(): number {
  const row = screen.getByTestId(testIds.productGallery).children[0];
  if (row === undefined || typeof row === 'string') throw new Error('The gallery has no row');
  const transform = StyleSheet.flatten(row.props.style)?.transform as { translateX?: number }[] | undefined;
  return transform?.find((step) => step.translateX !== undefined)?.translateX ?? 0;
}

describe('the header and the bar take touches only while the page is open and still (F-04)', () => {
  it('inert until the open lands, again from the moment a close starts', async () => {
    hold = () => true;
    const { unmount } = await renderProduct();
    // Opening: blocked, and TalkBack skips them (the default queries do not find them).
    for (const id of [testIds.productBack, testIds.addToCart]) {
      expect(isTouchBlocked(id)).toBe(true);
      expect(screen.queryByTestId(id)).toBeNull();
    }

    await finishHeld(true);
    for (const id of [testIds.productBack, testIds.addToCart]) {
      expect(isTouchBlocked(id)).toBe(false);
      expect(screen.getByTestId(id)).toBeTruthy();
    }

    await pressNative(testIds.productBack);
    await settle();
    // Closing: a tap on the half-faded bar cannot add, a second Back cannot pop a second route.
    expect(isTouchBlocked(testIds.addToCart)).toBe(true);
    expect(isTouchBlocked(testIds.productBack)).toBe(true);
    expect(screen.queryByTestId(testIds.productBack)).toBeNull();
    expect(getCartState().ids).toEqual([]);
    expect(back).not.toHaveBeenCalled();

    await finishHeld(true);
    expect(back).toHaveBeenCalledTimes(1);
    await unmount();
  });
});

describe('the gallery after an interrupted close (P-02)', () => {
  it('a close puts the pager on image 1 for good: caught and reopened, it reads, shows and pages from 1', async () => {
    const rect: Rect = { x: 16, y: 320, width: 170, height: 170 };
    registerHeroSource(product.id, {
      uri: 'tile.jpg',
      ref: {} as Reanimated.AnimatedRef<View>,
      rect: Reanimated.makeMutable<Rect | null>(rect),
      hidden: Reanimated.makeMutable(0),
    });
    const width = Dimensions.get('window').width;
    const n = product.images.length;
    const pageAction = async (actionName: string) => {
      await fireEvent(screen.getByTestId(testIds.productGallery), 'accessibilityAction', { nativeEvent: { actionName } });
    };
    const { unmount } = await renderProduct();
    await untilInteractive();
    await pageAction('increment');
    expect(galleryPageText()).toBe(`Image 2 of ${n}`);
    expect(rowTranslateX()).toBe(-width);

    hold = (to) => to === 0;
    await pressNative(testIds.productBack);
    await settle();
    expect(galleryPageText()).toBe(`Image 1 of ${n}`);
    expect(rowTranslateX()).toBe(0);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled(); // flying home is not a page turn: no tick

    // A finger catches the flying image and drags it all the way back open.
    held.length = 0; // the finger's grab cancels the running close
    await dragGesture(testIds.productSwipeBack, 10 - width, 0, 0, 0);
    await untilInteractive();
    expect(back).not.toHaveBeenCalled();
    expect(galleryPageText()).toBe(`Image 1 of ${n}`);
    expect(rowTranslateX()).toBe(0);
    await pageAction('increment');
    expect(galleryPageText()).toBe(`Image 2 of ${n}`);
    expect(rowTranslateX()).toBe(-width);
    await unmount();
  });
});

describe('the back gestures close towards the reading end (G-08, F-04)', () => {
  it('English: a swipe to the right closes the page', async () => {
    const { unmount } = await renderProduct();
    await dragGesture(testIds.productSwipeBack, 300, 0, 800, 0);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await unmount();
  });

  it('English: a swipe to the left never closes it, and the page takes touches again', async () => {
    const { unmount } = await renderProduct();
    await dragGesture(testIds.productSwipeBack, -300, 0, -800, 0);
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByTestId(testIds.productBack)).toBeTruthy();
    await unmount();
  });

  it('Arabic: a swipe to the left closes the page', async () => {
    const { unmount } = await renderProduct(product, { lang: 'ar' });
    await dragGesture(testIds.productSwipeBack, -300, 0, -800, 0);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await unmount();
  });

  it('Arabic: a swipe to the right never closes it', async () => {
    const { unmount } = await renderProduct(product, { lang: 'ar' });
    await dragGesture(testIds.productSwipeBack, 300, 0, 800, 0);
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByTestId(testIds.productBack)).toBeTruthy();
    await unmount();
  });

  it('the pull-down on the image closes the page in both languages', async () => {
    const en = await renderProduct();
    await dragGesture(testIds.productPullBack, 0, 400, 0, 900);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await en.unmount();

    const ar = await renderProduct(product, { lang: 'ar' });
    await dragGesture(testIds.productPullBack, 0, 400, 0, 900);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(2));
    await ar.unmount();
  });
});
