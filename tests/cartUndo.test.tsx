/**
 * Deleting a cart line and putting it back (K-01, K-02): the bin, the screen-reader action, the red
 * button behind a swiped row, and the undo bar that names what it removed.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import { cartActions, getCartState } from '@/state/cart.store';
import { testIds } from '@/testIds';

import {
  minus,
  nativePress,
  P5950,
  P450,
  P1650,
  P350,
  product,
  renderCart,
  resetCartTest,
  rowOrder,
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

async function threeLines() {
  await act(() => {
    cartActions.add(P1650);
    cartActions.add(P450);
    cartActions.add(P350);
  });
  await renderCart();
  expect(rowOrder()).toEqual([P1650, P450, P350].map(testIds.cartRow));
}

const removedMessage = (id: string) => `Removed ${product(id).name}`;

describe('delete and undo (K-01, K-02)', () => {
  it('minus at 1 is a bin: it removes the line, and Undo puts it back where it was', async () => {
    await threeLines();
    const minusAtOne = screen.getByTestId(minus(P450));
    expect(minusAtOne.props.accessibilityLabel).toBe(`Remove ${product(P450).name} from cart`);

    await pressNative(minus(P450));
    await settle();
    expect(screen.queryByTestId(testIds.cartRow(P450))).toBeNull();
    expect(screen.getByText(removedMessage(P450))).toBeTruthy();
    expect(text(testIds.cartTotal)).toBe('2,000.00 DA');

    await pressNative(testIds.undoAction);
    await settle();
    expect(rowOrder()).toEqual([P1650, P450, P350].map(testIds.cartRow));
    expect(text(testIds.cartTotal)).toBe('2,450.00 DA');
    expect(screen.queryByTestId(testIds.undoAction)).toBeNull();
  });

  it('restores once when Undo is tapped twice in a row', async () => {
    await threeLines();
    await pressNative(minus(P450));
    await settle();

    const tapUndo = nativePress(testIds.undoAction);
    await act(() => {
      tapUndo();
      tapUndo();
    });
    await settle();
    expect(getCartState().ids).toEqual([P1650, P450, P350]);
    expect(rowOrder()).toHaveLength(3);
  });

  it('after two deletes in a row, the bar names the second and Undo restores that one', async () => {
    await threeLines();
    await pressNative(minus(P450));
    await settle();
    await pressNative(minus(P350));
    await settle();
    expect(screen.queryByText(removedMessage(P450))).toBeNull();
    expect(screen.getByText(removedMessage(P350))).toBeTruthy();

    await pressNative(testIds.undoAction);
    await settle();
    expect(getCartState().ids).toEqual([P1650, P350]);
  });

  it('brings the cart back from empty when the last line is undone', async () => {
    await act(() => cartActions.add(P5950));
    await renderCart();
    await pressNative(minus(P5950));
    await settle();
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.getByText(removedMessage(P5950))).toBeTruthy();

    await pressNative(testIds.undoAction);
    await settle();
    expect(screen.getByTestId(testIds.cartRow(P5950))).toBeTruthy();
    expect(text(testIds.cartTotal)).toBe('5,950.00 DA');
  });

  it('deletes with the screen reader action on the line, with the same undo', async () => {
    await threeLines();
    await fireEvent(screen.getByTestId(testIds.cartRowInfo(P350)), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    await settle();
    expect(screen.queryByTestId(testIds.cartRow(P350))).toBeNull();
    expect(screen.getByText(removedMessage(P350))).toBeTruthy();
  });

  it('removes the line once when the red button is tapped twice', async () => {
    await threeLines();
    const remove = jest.spyOn(cartActions, 'remove');
    // The button sits in a layer hidden from screen readers (they get the line's Delete action).
    const tapDelete = nativePress(testIds.cartRowDelete(P450), { includeHiddenElements: true });
    await act(() => {
      tapDelete();
      tapDelete();
    });
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(getCartState().ids).toEqual([P1650, P350]);

    await pressNative(testIds.undoAction);
    await settle();
    expect(getCartState().ids).toEqual([P1650, P450, P350]);
  });
});
