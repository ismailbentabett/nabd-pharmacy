/**
 * The Cart screen (K-03, K-04, G-08, F-05) rendered in the app's providers: lines, totals, labels.
 * Delete and undo live in cartUndo.test.tsx, the swipe in cartSwipe.test.tsx.
 *
 * Totals are checked against hand-worked vectors, not against the code under test: 115.00 SAR
 * including 15 % VAT is 100.00 + 15.00, and 123.99 SAR is 107.82 + 16.17 (16.1726 rounded).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import * as cartStore from '@/state/cart.store';
import { cartActions, getCartState } from '@/state/cart.store';
import { testIds } from '@/testIds';

import {
  minus,
  nativePress,
  P115,
  P1295,
  P4699,
  P899,
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
    await act(() => cartActions.add(P4699, 2));
    await renderCart();
    const p = product(P4699);
    expect(screen.getByText(p.name)).toBeTruthy();
    expect(screen.getByText(p.brand)).toBeTruthy();
    expect(screen.getByText('46.99 SAR each')).toBeTruthy();
    expect(text(testIds.cartRowTotal(P4699))).toBe('93.98 SAR');
    expect(screen.getByText('2 items')).toBeTruthy();
  });

  it('splits a VAT-inclusive total into subtotal and a separate 15 % VAT line', async () => {
    expect(product(P115).price).toBe(115);
    await act(() => cartActions.add(P115));
    await renderCart();
    expect(text(testIds.cartSubtotal)).toBe('100.00 SAR');
    expect(text(testIds.cartVat)).toBe('15.00 SAR');
    expect(text(testIds.cartTotal)).toBe('115.00 SAR');
  });

  it('updates every total in the same render as a stepper press', async () => {
    await act(() => cartActions.add(P115));
    await renderCart();

    await pressNative(plus(P115));
    expect(getCartState().byId[P115]?.qty).toBe(2);
    expect(text(testIds.cartRowTotal(P115))).toBe('230.00 SAR');
    expect(text(testIds.cartSubtotal)).toBe('200.00 SAR');
    expect(text(testIds.cartVat)).toBe('30.00 SAR');
    expect(text(testIds.cartTotal)).toBe('230.00 SAR');

    await pressNative(minus(P115));
    expect(text(testIds.cartTotal)).toBe('115.00 SAR');
  });

  it('rounds the VAT share of a mixed cart to the halala', async () => {
    expect(product(P899).price).toBe(8.99);
    await act(() => {
      cartActions.add(P115);
      cartActions.add(P899);
    });
    await renderCart();
    expect(text(testIds.cartSubtotal)).toBe('107.82 SAR');
    expect(text(testIds.cartVat)).toBe('16.17 SAR');
    expect(text(testIds.cartTotal)).toBe('123.99 SAR');
  });

  it('counts two taps that land before a re-render as two steps', async () => {
    await act(() => cartActions.add(P4699, 2));
    await renderCart();
    const tapPlus = nativePress(plus(P4699));
    const tapMinus = nativePress(minus(P4699));

    await act(() => {
      tapPlus();
      tapPlus();
    });
    expect(getCartState().byId[P4699]?.qty).toBe(4);

    await act(() => {
      tapPlus();
      tapMinus();
    });
    expect(getCartState().byId[P4699]?.qty).toBe(4);
  });

  it('two quick taps on minus at 2 stop at 1: removing the line takes its own tap on the bin', async () => {
    await act(() => cartActions.add(P4699, 2));
    await renderCart();
    const tapMinus = nativePress(minus(P4699));
    await act(() => {
      tapMinus();
      tapMinus();
    });
    expect(getCartState().byId[P4699]?.qty).toBe(1);
    expect(screen.getByTestId(testIds.cartRow(P4699))).toBeTruthy();
    expect(screen.queryByTestId(testIds.undoAction)).toBeNull();
  });
});

describe('accessibility', () => {
  it('reads the stepper as one adjustable control with its value, and labels each button', async () => {
    await act(() => cartActions.add(P4699, 2));
    await renderCart();
    const stepper = screen.getByTestId(testIds.cartRowQty(P4699));
    expect(stepper.props.accessibilityRole).toBe('adjustable');
    expect(stepper.props.accessibilityLabel).toBe('Quantity');
    expect(stepper.props.accessibilityValue).toEqual({ min: 1, max: 99, now: 2, text: '2' });
    expect(screen.getByTestId(plus(P4699)).props.accessibilityLabel).toBe('Increase quantity');
    expect(screen.getByTestId(minus(P4699)).props.accessibilityLabel).toBe('Decrease quantity');

    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByTestId(testIds.cartRowQty(P4699)).props.accessibilityValue).toMatchObject({ now: 3 });
  });

  it('reads each line, its delete action and every total as one sentence', async () => {
    await act(() => cartActions.add(P4699, 2));
    await renderCart();
    const info = screen.getByTestId(testIds.cartRowInfo(P4699));
    expect(info.props.accessibilityLabel).toBe(`${product(P4699).name}. 46.99 SAR each. Line total 93.98 SAR`);
    expect(info.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete' }]);
    expect(screen.getByLabelText('Subtotal (excl. VAT), 81.72 SAR')).toBeTruthy();
    expect(screen.getByLabelText('VAT (15%), 12.26 SAR')).toBeTruthy();
    expect(screen.getByLabelText('Total, 93.98 SAR')).toBeTruthy();
    // The swipe layer is for sighted touch only; TalkBack gets the action above instead.
    expect(screen.queryByTestId(testIds.cartRowDelete(P4699))).toBeNull();
  });

  it('gives Undo a hint about what it does', async () => {
    await act(() => cartActions.add(P4699));
    await renderCart();
    await pressNative(minus(P4699));
    await settle();
    const undo = screen.getByTestId(testIds.undoAction);
    expect(undo.props.accessibilityLabel).toBe('Undo');
    expect(undo.props.accessibilityHint).toBe('Puts the item back in your cart');
  });
});

describe('Arabic (G-08)', () => {
  it('shows Arabic names and labels, with prices in Western digits and ر.س', async () => {
    await act(() => cartActions.add(P115));
    await renderCart('ar');
    const p = product(P115);
    expect(screen.getByText(p.nameAr)).toBeTruthy();
    expect(screen.getByText('115.00 ر.س للقطعة')).toBeTruthy();
    expect(text(testIds.cartTotal)).toBe('115.00 ر.س');
    expect(screen.getByLabelText('ضريبة القيمة المضافة (15٪), 15.00 ر.س')).toBeTruthy();
    expect(screen.getByLabelText('المجموع (بدون الضريبة), 100.00 ر.س')).toBeTruthy();
    expect(screen.getByTestId(minus(P115)).props.accessibilityLabel).toBe(`إزالة ${p.nameAr} من السلة`);
  });
});

describe('re-renders (F-05)', () => {
  it('a quantity change re-renders that row only, not its neighbours', async () => {
    await act(() => {
      cartActions.add(P4699);
      cartActions.add(P1295);
    });
    await renderCart();
    const useCartLine = jest.spyOn(cartStore, 'useCartLine');

    await pressNative(plus(P4699));
    expect(text(testIds.cartTotal)).toBe('106.93 SAR');
    const renders = (id: string) => useCartLine.mock.calls.filter(([called]) => called === id).length;
    expect(renders(P4699)).toBeGreaterThan(0);
    expect(renders(P1295)).toBe(0);
  });
});
