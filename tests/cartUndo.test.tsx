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
  P115,
  P1295,
  P4699,
  P899,
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
    cartActions.add(P4699);
    cartActions.add(P1295);
    cartActions.add(P899);
  });
  await renderCart();
  expect(rowOrder()).toEqual([P4699, P1295, P899].map(testIds.cartRow));
}

const removedMessage = (id: string) => `Removed ${product(id).name}`;

describe('delete and undo (K-01, K-02)', () => {
  it('minus at 1 is a bin: it removes the line, and Undo puts it back where it was', async () => {
    await threeLines();
    const minusAtOne = screen.getByTestId(minus(P1295));
    expect(minusAtOne.props.accessibilityLabel).toBe(`Remove ${product(P1295).name} from cart`);

    await pressNative(minus(P1295));
    await settle();
    expect(screen.queryByTestId(testIds.cartRow(P1295))).toBeNull();
    expect(screen.getByText(removedMessage(P1295))).toBeTruthy();
    expect(text(testIds.cartTotal)).toBe('55.98 SAR');

    await pressNative(testIds.undoAction);
    await settle();
    expect(rowOrder()).toEqual([P4699, P1295, P899].map(testIds.cartRow));
    expect(text(testIds.cartTotal)).toBe('68.93 SAR');
    expect(screen.queryByTestId(testIds.undoAction)).toBeNull();
  });

  it('restores once when Undo is tapped twice in a row', async () => {
    await threeLines();
    await pressNative(minus(P1295));
    await settle();

    const tapUndo = nativePress(testIds.undoAction);
    await act(() => {
      tapUndo();
      tapUndo();
    });
    await settle();
    expect(getCartState().ids).toEqual([P4699, P1295, P899]);
    expect(rowOrder()).toHaveLength(3);
  });

  it('after two deletes in a row, the bar names the second and Undo restores that one', async () => {
    await threeLines();
    await pressNative(minus(P1295));
    await settle();
    await pressNative(minus(P899));
    await settle();
    expect(screen.queryByText(removedMessage(P1295))).toBeNull();
    expect(screen.getByText(removedMessage(P899))).toBeTruthy();

    await pressNative(testIds.undoAction);
    await settle();
    expect(getCartState().ids).toEqual([P4699, P899]);
  });

  it('brings the cart back from empty when the last line is undone', async () => {
    await act(() => cartActions.add(P115));
    await renderCart();
    await pressNative(minus(P115));
    await settle();
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.getByText(removedMessage(P115))).toBeTruthy();

    await pressNative(testIds.undoAction);
    await settle();
    expect(screen.getByTestId(testIds.cartRow(P115))).toBeTruthy();
    expect(text(testIds.cartTotal)).toBe('115.00 SAR');
  });

  it('deletes with the screen reader action on the line, with the same undo', async () => {
    await threeLines();
    await fireEvent(screen.getByTestId(testIds.cartRowInfo(P899)), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    await settle();
    expect(screen.queryByTestId(testIds.cartRow(P899))).toBeNull();
    expect(screen.getByText(removedMessage(P899))).toBeTruthy();
  });

  it('removes the line once when the red button is tapped twice', async () => {
    await threeLines();
    const remove = jest.spyOn(cartActions, 'remove');
    // The button sits in a layer hidden from screen readers (they get the line's Delete action).
    const tapDelete = nativePress(testIds.cartRowDelete(P1295), { includeHiddenElements: true });
    await act(() => {
      tapDelete();
      tapDelete();
    });
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(getCartState().ids).toEqual([P4699, P899]);

    await pressNative(testIds.undoAction);
    await settle();
    expect(getCartState().ids).toEqual([P4699, P1295, P899]);
  });
});
