/**
 * The Cart screen (K-03, K-04, G-08, F-05) rendered in the app's providers: lines, totals, labels.
 * Delete and undo live in cartUndo.test.tsx, the swipe in cartSwipe.test.tsx.
 *
 * Totals are checked against hand-worked vectors, not against the code under test: 5,950.00 DA
 * including 19 % TVA is 5,000.00 + 950.00, and 6,300.00 DA is 5,294.12 + 1,005.88 (1,005.882 rounded).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import * as cartStore from '@/state/cart.store';
import { cartActions, getCartState } from '@/state/cart.store';
import { testIds } from '@/testIds';

import {
  minus,
  nativePress,
  P5950,
  P450,
  P1650,
  P350,
  plus,
  product,
  renderCart,
  resetCartTest,
  settle,
  text,
} from './helpers/cart';
import { pressNative } from './helpers/render';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));

beforeEach(resetCartTest);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('empty cart', () => {
  it('says so, offers the way to the products, and shows no totals or undo', async () => {
    await renderCart();
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.queryByTestId(testIds.cartTotal)).toBeNull();
    expect(screen.queryByTestId(testIds.undoAction)).toBeNull();

    await pressNative(testIds.cartEmptyCta);
    expect(mockNavigate).toHaveBeenCalledWith('/category');
  });
});

describe('rows and totals (K-03, K-04)', () => {
  it('shows each line with brand, name, unit price and line total', async () => {
    await act(() => cartActions.add(P1650, 2));
    await renderCart();
    const p = product(P1650);
    expect(screen.getByText(p.name)).toBeTruthy();
    expect(screen.getByText(p.brand)).toBeTruthy();
    expect(screen.getByText('1,650.00 DA each')).toBeTruthy();
    expect(text(testIds.cartRowTotal(P1650))).toBe('3,300.00 DA');
    expect(screen.getByText('2 items')).toBeTruthy();
  });

  it('splits a TVA-inclusive total into subtotal and a separate 19 % TVA line', async () => {
    expect(product(P5950).price).toBe(5950);
    await act(() => cartActions.add(P5950));
    await renderCart();
    expect(text(testIds.cartSubtotal)).toBe('5,000.00 DA');
    expect(text(testIds.cartVat)).toBe('950.00 DA');
    expect(text(testIds.cartTotal)).toBe('5,950.00 DA');
  });

  it('updates every total in the same render as a stepper press', async () => {
    await act(() => cartActions.add(P5950));
    await renderCart();

    await pressNative(plus(P5950));
    expect(getCartState().byId[P5950]?.qty).toBe(2);
    expect(text(testIds.cartRowTotal(P5950))).toBe('11,900.00 DA');
    expect(text(testIds.cartSubtotal)).toBe('10,000.00 DA');
    expect(text(testIds.cartVat)).toBe('1,900.00 DA');
    expect(text(testIds.cartTotal)).toBe('11,900.00 DA');

    await pressNative(minus(P5950));
    expect(text(testIds.cartTotal)).toBe('5,950.00 DA');
  });

  it('rounds the TVA share of a mixed cart to the centime', async () => {
    expect(product(P350).price).toBe(350);
    await act(() => {
      cartActions.add(P5950);
      cartActions.add(P350);
    });
    await renderCart();
    expect(text(testIds.cartSubtotal)).toBe('5,294.12 DA');
    expect(text(testIds.cartVat)).toBe('1,005.88 DA');
    expect(text(testIds.cartTotal)).toBe('6,300.00 DA');
  });

  it('counts two taps that land before a re-render as two steps', async () => {
    await act(() => cartActions.add(P1650, 2));
    await renderCart();
    const tapPlus = nativePress(plus(P1650));
    const tapMinus = nativePress(minus(P1650));

    await act(() => {
      tapPlus();
      tapPlus();
    });
    expect(getCartState().byId[P1650]?.qty).toBe(4);

    await act(() => {
      tapPlus();
      tapMinus();
    });
    expect(getCartState().byId[P1650]?.qty).toBe(4);
  });

  it('two quick taps on minus at 2 stop at 1: removing the line takes its own tap on the bin', async () => {
    await act(() => cartActions.add(P1650, 2));
    await renderCart();
    const tapMinus = nativePress(minus(P1650));
    await act(() => {
      tapMinus();
      tapMinus();
    });
    expect(getCartState().byId[P1650]?.qty).toBe(1);
    expect(screen.getByTestId(testIds.cartRow(P1650))).toBeTruthy();
    expect(screen.queryByTestId(testIds.undoAction)).toBeNull();
  });
});

describe('accessibility', () => {
  it('reads the stepper as one adjustable control with its value, and labels each button', async () => {
    await act(() => cartActions.add(P1650, 2));
    await renderCart();
    const stepper = screen.getByTestId(testIds.cartRowQty(P1650));
    expect(stepper.props.accessibilityRole).toBe('adjustable');
    expect(stepper.props.accessibilityLabel).toBe('Quantity');
    expect(stepper.props.accessibilityValue).toEqual({ min: 1, max: 99, now: 2, text: '2' });
    expect(screen.getByTestId(plus(P1650)).props.accessibilityLabel).toBe('Increase quantity');
    expect(screen.getByTestId(minus(P1650)).props.accessibilityLabel).toBe('Decrease quantity');

    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByTestId(testIds.cartRowQty(P1650)).props.accessibilityValue).toMatchObject({ now: 3 });
  });

  it('reads each line, its delete action and every total as one sentence', async () => {
    await act(() => cartActions.add(P1650, 2));
    await renderCart();
    const info = screen.getByTestId(testIds.cartRowInfo(P1650));
    expect(info.props.accessibilityLabel).toBe(`${product(P1650).name}. 1,650.00 DA each. Line total 3,300.00 DA`);
    expect(info.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete' }]);
    expect(screen.getByLabelText('Subtotal (excl. TVA), 2,773.11 DA')).toBeTruthy();
    expect(screen.getByLabelText('TVA (19%), 526.89 DA')).toBeTruthy();
    expect(screen.getByLabelText('Total, 3,300.00 DA')).toBeTruthy();
    // The swipe layer is for sighted touch only; TalkBack gets the action above instead.
    expect(screen.queryByTestId(testIds.cartRowDelete(P1650))).toBeNull();
  });

  it('gives Undo a hint about what it does', async () => {
    await act(() => cartActions.add(P1650));
    await renderCart();
    await pressNative(minus(P1650));
    await settle();
    const undo = screen.getByTestId(testIds.undoAction);
    expect(undo.props.accessibilityLabel).toBe('Undo');
    expect(undo.props.accessibilityHint).toBe('Puts the item back in your cart');
  });
});

describe('Arabic (G-08)', () => {
  it('shows Arabic names and labels, with prices in Western digits and د.ج', async () => {
    await act(() => cartActions.add(P5950));
    await renderCart('ar');
    const p = product(P5950);
    expect(screen.getByText(p.nameAr)).toBeTruthy();
    expect(screen.getByText('5,950.00 د.ج للقطعة')).toBeTruthy();
    expect(text(testIds.cartTotal)).toBe('5,950.00 د.ج');
    expect(screen.getByLabelText('الرسم على القيمة المضافة (19٪), 950.00 د.ج')).toBeTruthy();
    expect(screen.getByLabelText('المجموع (دون الرسم), 5,000.00 د.ج')).toBeTruthy();
    expect(screen.getByTestId(minus(P5950)).props.accessibilityLabel).toBe(`إزالة ${p.nameAr} من السلة`);
  });
});

describe('re-renders (F-05)', () => {
  it('a quantity change re-renders that row only, not its neighbours', async () => {
    await act(() => {
      cartActions.add(P1650);
      cartActions.add(P450);
    });
    await renderCart();
    const useCartLine = jest.spyOn(cartStore, 'useCartLine');

    await pressNative(plus(P1650));
    expect(text(testIds.cartTotal)).toBe('3,750.00 DA');
    const renders = (id: string) => useCartLine.mock.calls.filter(([called]) => called === id).length;
    expect(renders(P1650)).toBeGreaterThan(0);
    expect(renders(P450)).toBe(0);
  });
});
