/**
 * Swipe to delete on a cart line (K-02, G-08, G-09): direction, the open rest, how an open row
 * answers a touch, and the reduced-motion variant.
 *
 * What Jest cannot show: one row closing when another is touched. That runs in `useAnimatedReaction`,
 * which Reanimated's mock never calls. It is checked on the phone (docs/DECISIONS.md, one open row).
 */
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { ACTION_WIDTH, toPull } from '@/features/cart/swipeMath';
import { timingReducedFade } from '@/motion/springs';
import { cartActions, getCartState } from '@/state/cart.store';
import { testIds } from '@/testIds';

import {
  layoutRow,
  P450,
  P1650,
  plus,
  product,
  renderCart,
  resetCartTest,
  settle,
  swipeRow,
  touchRow,
} from './helpers/cart';
import { pressNative } from './helpers/render';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));

beforeEach(resetCartTest);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('swipe to delete follows the reading direction (K-02, G-08)', () => {
  it('English: a long swipe to the left deletes; a long swipe to the right does nothing', async () => {
    await act(() => cartActions.add(P1650));
    await renderCart('en');

    await swipeRow(P1650, 300, 0);
    expect(getCartState().ids).toEqual([P1650]);

    await swipeRow(P1650, -300, -200);
    expect(getCartState().ids).toEqual([]);
    expect(screen.getByText(`Removed ${product(P1650).name}`)).toBeTruthy();
  });

  it('Arabic: the same swipe mirrored, to the right, deletes; to the left does nothing', async () => {
    await act(() => cartActions.add(P1650));
    await renderCart('ar');

    await swipeRow(P1650, -300, -2000);
    expect(getCartState().ids).toEqual([P1650]);

    await swipeRow(P1650, 300, 200);
    expect(getCartState().ids).toEqual([]);
    expect(screen.getByText(`تمت إزالة ${product(P1650).nameAr}`)).toBeTruthy();
  });

  it('a short swipe opens the button and springs from the release speed instead of deleting', async () => {
    // Spied before render: worklets capture what they call when they are created.
    const withSpring = jest.spyOn(Reanimated, 'withSpring');
    await act(() => cartActions.add(P1650));
    await renderCart('ar');
    withSpring.mockClear();

    await swipeRow(P1650, 70, 300);
    expect(getCartState().ids).toEqual([P1650]);
    expect(withSpring).toHaveBeenCalledWith(ACTION_WIDTH, expect.objectContaining({ velocity: toPull(300, -1) }));
  });
});

describe('an open row answers a touch (K-02)', () => {
  /** Lay the row out 400 wide, swipe it open, then forget the springs that took. */
  async function openRow(lang: 'en' | 'ar') {
    const withSpring = jest.spyOn(Reanimated, 'withSpring');
    await act(() => cartActions.add(P1650));
    await renderCart(lang);
    await layoutRow(P1650);
    await swipeRow(P1650, lang === 'en' ? -70 : 70, lang === 'en' ? -300 : 300);
    expect(withSpring).toHaveBeenLastCalledWith(ACTION_WIDTH, expect.anything());
    withSpring.mockClear();
    return withSpring;
  }

  it('English: a tap on the content closes it', async () => {
    const withSpring = await openRow('en');
    await touchRow(P1650, 10);
    expect(withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ velocity: 0 }));
    expect(getCartState().ids).toEqual([P1650]);
  });

  it('English: a touch on the uncovered red button (right edge) keeps it open, so the press lands', async () => {
    const withSpring = await openRow('en');
    await touchRow(P1650, 390);
    expect(withSpring).toHaveBeenCalledWith(ACTION_WIDTH, expect.objectContaining({ velocity: 0 }));
    expect(withSpring).not.toHaveBeenCalledWith(0, expect.anything());
  });

  it('Arabic: the button is at the left edge, so the sides swap', async () => {
    const withSpring = await openRow('ar');
    await touchRow(P1650, 10);
    expect(withSpring).not.toHaveBeenCalledWith(0, expect.anything());

    await touchRow(P1650, 390);
    expect(withSpring).toHaveBeenCalledWith(0, expect.objectContaining({ velocity: 0 }));
  });
});

describe('reduced motion (G-09)', () => {
  it('uses no spring anywhere: steps, swipe, delete and undo only fade', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    // Spied before render: worklets capture what they call when they are created.
    const withSpring = jest.spyOn(Reanimated, 'withSpring');
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    await act(() => {
      cartActions.add(P1650);
      cartActions.add(P450);
    });
    await renderCart();
    withSpring.mockClear();
    withTiming.mockClear();

    await pressNative(plus(P1650));
    await swipeRow(P1650, -60, 0);
    await swipeRow(P450, -300, -200);
    expect(getCartState().ids).toEqual([P1650]);
    await pressNative(testIds.undoAction);
    await settle();
    expect(getCartState().ids).toEqual([P1650, P450]);

    expect(withSpring).not.toHaveBeenCalled();
    expect(withTiming).toHaveBeenCalledWith(1, timingReducedFade);
    expect(withTiming).toHaveBeenCalledWith(0, timingReducedFade, expect.any(Function));
    for (const [, config] of withTiming.mock.calls) expect(config).toBe(timingReducedFade);
  });
});
