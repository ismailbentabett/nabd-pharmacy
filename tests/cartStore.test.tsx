/**
 * The store around the cart reducer: persistence across a restart, safe restore of a bad saved
 * value, and the re-render promise behind F-05 (a subscriber only re-renders when its own slice
 * changes). The reducer rules themselves are covered in cart.test.ts.
 */
import { act, renderHook } from '@testing-library/react-native';

import { getCatalog } from '@/core/catalog';
import { toCentimes } from '@/core/money';
import {
  CART_STORAGE_KEY,
  cartActions,
  createCart,
  getCartState,
  restoreCart,
  useCartCount,
  useCartLine,
  useCartTotals,
  type CartStorage,
} from '@/state/cart.store';
import { EMPTY_CART } from '@/state/cartMath';

const [first, second, third] = getCatalog().products;
if (!first || !second || !third) throw new Error('catalog is empty');
const A = first.id;
const B = second.id;
const C = third.id;

function memoryStorage(initial?: string): CartStorage & { writes: number; value: () => string | undefined } {
  let value = initial;
  let writes = 0;
  return {
    getString: (key) => (key === CART_STORAGE_KEY ? value : undefined),
    set: (key, next) => {
      if (key !== CART_STORAGE_KEY) return;
      value = next;
      writes += 1;
    },
    get writes() {
      return writes;
    },
    value: () => value,
  };
}

describe('createCart', () => {
  it('starts empty when nothing was saved', () => {
    const { useCart } = createCart(memoryStorage());
    expect(useCart.getState()).toEqual(EMPTY_CART);
  });

  it('saves the lines after each change and restores them in a new store (language switch restart)', () => {
    const storage = memoryStorage();
    const before = createCart(storage);
    before.actions.add(A, 2);
    before.actions.add(B);
    before.actions.setQty(B, 5);

    const after = createCart(memoryStorage(storage.value()));
    expect(after.useCart.getState().ids).toEqual([A, B]);
    expect(after.useCart.getState().byId[A]?.qty).toBe(2);
    expect(after.useCart.getState().byId[B]?.qty).toBe(5);
  });

  it('does not save a deletion that is still waiting for undo; after a restart it is final', () => {
    const storage = memoryStorage();
    const before = createCart(storage);
    before.actions.add(A);
    before.actions.add(B);
    before.actions.remove(A);
    expect(before.useCart.getState().lastRemoved?.line.id).toBe(A);

    const after = createCart(memoryStorage(storage.value()));
    expect(after.useCart.getState().ids).toEqual([B]);
    expect(after.useCart.getState().lastRemoved).toBeNull();
  });

  it('does not notify subscribers or write storage for a no-op action', () => {
    const storage = memoryStorage();
    const { useCart, actions } = createCart(storage);
    actions.add(A);
    const writesAfterAdd = storage.writes;
    const listener = jest.fn();
    const unsubscribe = useCart.subscribe(listener);

    actions.setQty(A, 1); // same quantity
    actions.setQty(B, 3); // not in the cart
    actions.undo(); // nothing to undo
    actions.commitRemoval(); // nothing pending

    expect(listener).not.toHaveBeenCalled();
    expect(storage.writes).toBe(writesAfterAdd);
    unsubscribe();
  });

  it('removeOrdered subtracts an order, saves the rest, and offers no undo', () => {
    const storage = memoryStorage();
    const { useCart, actions } = createCart(storage);
    actions.add(A, 2);
    actions.add(B);
    actions.removeOrdered([
      { productId: A, qty: 1 },
      { productId: B, qty: 1 },
    ]);
    expect(useCart.getState().ids).toEqual([A]);
    expect(useCart.getState().byId[A]?.qty).toBe(1);
    expect(useCart.getState().lastRemoved).toBeNull();
    expect(createCart(memoryStorage(storage.value())).useCart.getState().ids).toEqual([A]);
  });

  it('writes nothing when only the undo slot changes', () => {
    const storage = memoryStorage();
    const { actions } = createCart(storage);
    actions.add(A);
    actions.remove(A);
    const writes = storage.writes;
    actions.commitRemoval();
    expect(storage.writes).toBe(writes);
  });
});

describe('restoreCart', () => {
  const saved = (value: unknown) => JSON.stringify(value);

  it.each([
    ['nothing saved', undefined],
    ['broken JSON', '{"ids": ['],
    ['a JSON number', '42'],
    ['null', 'null'],
    ['ids is not a list', saved({ ids: 'a', byId: {} })],
    ['byId missing', saved({ ids: [A] })],
  ])('returns an empty cart for %s', (_label, value) => {
    expect(restoreCart(value)).toEqual(EMPTY_CART);
  });

  it('keeps valid lines in their saved order', () => {
    const state = restoreCart(saved({ ids: [B, A], byId: { [A]: { id: A, qty: 3 }, [B]: { id: B, qty: 1 } } }));
    expect(state.ids).toEqual([B, A]);
    expect(state.byId[A]).toEqual({ id: A, qty: 3 });
    expect(state.lastRemoved).toBeNull();
  });

  it('drops lines the catalog no longer has, bad quantities, mismatched ids and duplicates', () => {
    const state = restoreCart(
      saved({
        ids: [A, 'p-does-not-exist', B, C, A, 7],
        byId: {
          [A]: { id: A, qty: 2 },
          'p-does-not-exist': { id: 'p-does-not-exist', qty: 1 },
          [B]: { id: B, qty: 100 },
          [C]: { id: A, qty: 1 },
        },
      }),
    );
    expect(state.ids).toEqual([A]);
    expect(state.byId).toEqual({ [A]: { id: A, qty: 2 } });
  });

  it('rejects zero, negative and fractional quantities', () => {
    for (const qty of [0, -1, 1.5]) {
      expect(restoreCart(saved({ ids: [A], byId: { [A]: { id: A, qty } } }))).toEqual(EMPTY_CART);
    }
  });
});

describe('cart hooks (F-05: re-render only for your own slice)', () => {
  beforeEach(async () => {
    await act(async () => cartActions.clear());
  });

  it('the badge count does not re-render when only the undo slot changes', async () => {
    await act(async () => {
      cartActions.add(A, 2);
      cartActions.add(B);
    });
    let renders = 0;
    const { result, unmount } = await renderHook(() => {
      renders += 1;
      return useCartCount();
    });
    expect(result.current).toBe(3);
    const rendersBefore = renders;

    await act(async () => cartActions.remove(B));
    expect(result.current).toBe(2);
    const rendersAfterRemove = renders;
    expect(rendersAfterRemove).toBe(rendersBefore + 1);

    await act(async () => cartActions.commitRemoval());
    expect(renders).toBe(rendersAfterRemove);
    await unmount();
  });

  it('a row does not re-render when another row changes quantity', async () => {
    await act(async () => {
      cartActions.add(A);
      cartActions.add(B);
    });
    let renders = 0;
    const { result, unmount } = await renderHook(() => {
      renders += 1;
      return useCartLine(A);
    });
    const rendersBefore = renders;

    await act(async () => cartActions.setQty(B, 4));
    expect(renders).toBe(rendersBefore);

    await act(async () => cartActions.setQty(A, 3));
    expect(renders).toBe(rendersBefore + 1);
    expect(result.current).toEqual({ id: A, qty: 3 });
    await unmount();
  });

  it('totals follow every change in the same update, TVA included in the price', async () => {
    const { result, unmount } = await renderHook(() => useCartTotals());
    expect(result.current).toEqual({ gross: 0, vat: 0, net: 0 });

    await act(async () => {
      cartActions.add(A, 2);
      cartActions.add(B);
    });
    const gross = toCentimes(first.price) * 2 + toCentimes(second.price);
    expect(result.current.gross).toBe(gross);
    expect(result.current.vat + result.current.net).toBe(gross);
    expect(result.current.vat).toBe(Math.round((gross * 19) / 119));
    expect(getCartState().ids).toEqual([A, B]);
    await unmount();
  });
});

describe('store actions guard the edges', () => {
  beforeEach(async () => {
    await act(async () => cartActions.clear());
  });

  it('ignores an id the catalogue cannot price, so the totals never meet one', async () => {
    await act(async () => cartActions.add('not-a-product', 2));
    expect(getCartState().ids).toEqual([]);
  });

  it('a second delete replaces the first one as the undo target; the first is final', async () => {
    await act(async () => {
      cartActions.add(A);
      cartActions.add(B);
      cartActions.add(C);
    });
    await act(async () => {
      cartActions.remove(A);
      cartActions.remove(B);
    });
    await act(async () => cartActions.undo());
    expect(getCartState().ids).toEqual([B, C]);
    await act(async () => cartActions.undo());
    expect(getCartState().ids).toEqual([B, C]);
  });
});
