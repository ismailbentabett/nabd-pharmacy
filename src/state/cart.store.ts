/**
 * The cart store: a zustand store that only runs `cartReducer` (cartMath.ts holds every rule).
 *
 * - Components subscribe through the small hooks below, each picking one field. A badge that reads
 *   the count does not re-render when a quantity changes elsewhere without changing the count, and a
 *   cart row reading its own line ignores every other row (F-05).
 * - Actions live outside the state, in `cartActions`, so pressing "Add" never subscribes anything.
 * - The lines are saved to MMKV after each change and read back synchronously on start. Switching
 *   language restarts the JS app (ADR-031), and the cart must survive that restart. A deletion that is
 *   still waiting for undo is not saved: after a restart it is final.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

import { findProduct } from '@/core/catalog';
import { splitVat, toCentimes, type Centimes, type VatSplit } from '@/core/money';

import {
  cartReducer,
  EMPTY_CART,
  MAX_QTY,
  selectCount,
  selectTotals,
  type CartAction,
  type CartLine,
  type CartState,
  type OrderedLine,
  type RemovedLine,
} from './cartMath';

/** The two MMKV methods the store uses. Tests pass an in-memory stand-in. */
export interface CartStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

/** Bump the suffix if the saved shape ever changes; an old value is then ignored, not misread. */
export const CART_STORAGE_KEY = 'cart.v1';

export function priceOfH(id: string): Centimes | undefined {
  const product = findProduct(id);
  return product === undefined ? undefined : toCentimes(product.price);
}

function isValidLine(id: unknown, line: unknown): line is CartLine {
  if (typeof id !== 'string' || typeof line !== 'object' || line === null) return false;
  const { id: lineId, qty } = line as { id?: unknown; qty?: unknown };
  return lineId === id && Number.isInteger(qty) && (qty as number) >= 1 && (qty as number) <= MAX_QTY;
}

/**
 * Read a saved cart. Anything unexpected (bad JSON, a wrong shape, a product id the catalog no longer
 * has) is dropped line by line, so a bad value can never crash the totals.
 */
export function restoreCart(saved: string | undefined): CartState {
  if (saved === undefined) return EMPTY_CART;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return EMPTY_CART;
  }
  if (typeof parsed !== 'object' || parsed === null) return EMPTY_CART;
  const { ids, byId } = parsed as { ids?: unknown; byId?: unknown };
  if (!Array.isArray(ids) || typeof byId !== 'object' || byId === null) return EMPTY_CART;

  const keptIds: string[] = [];
  const keptById: Record<string, CartLine> = {};
  for (const id of ids) {
    const line: unknown = (byId as Record<string, unknown>)[id];
    if (!isValidLine(id, line) || keptById[id] !== undefined || priceOfH(id) === undefined) continue;
    keptIds.push(id);
    keptById[id] = { id, qty: line.qty };
  }
  return keptIds.length === 0 ? EMPTY_CART : { ids: keptIds, byId: keptById, lastRemoved: null };
}

export interface CartActions {
  add(id: string, qty?: number): void;
  setQty(id: string, qty: number): void;
  remove(id: string): void;
  undo(): void;
  commitRemoval(): void;
  clear(): void;
  /** Subtract a placed order's lines; what was added meanwhile stays. */
  removeOrdered(lines: readonly OrderedLine[]): void;
}

export interface Cart {
  useCart: UseBoundStore<StoreApi<CartState>>;
  actions: CartActions;
}

/** Build a cart. The app makes exactly one (below); tests make a fresh one per case. */
export function createCart(storage: CartStorage): Cart {
  const useCart = create<CartState>()(() => restoreCart(storage.getString(CART_STORAGE_KEY)));

  // The reducer returns the same object for a no-op, and zustand skips listeners when the state is
  // identical, so a no-op action notifies nobody.
  const dispatch = (action: CartAction) => useCart.setState((state) => cartReducer(state, action), true);

  useCart.subscribe((state, prev) => {
    if (state.ids === prev.ids && state.byId === prev.byId) return;
    storage.set(CART_STORAGE_KEY, JSON.stringify({ ids: state.ids, byId: state.byId }));
  });

  return {
    useCart,
    actions: {
      // An id the catalogue cannot price would make the totals throw in render: ignore it.
      add: (id, qty) => {
        if (priceOfH(id) === undefined) return;
        dispatch({ type: 'add', id, qty });
      },
      setQty: (id, qty) => dispatch({ type: 'setQty', id, qty }),
      remove: (id) => dispatch({ type: 'remove', id }),
      undo: () => dispatch({ type: 'undo' }),
      commitRemoval: () => dispatch({ type: 'commitRemoval' }),
      clear: () => dispatch({ type: 'clear' }),
      removeOrdered: (lines) => dispatch({ type: 'removeOrdered', lines }),
    },
  };
}

const appCart = createCart(createMMKV({ id: 'cart' }));

export const cartActions: CartActions = appCart.actions;

/** For non-React code and tests: read the current state without subscribing. */
export const getCartState = (): CartState => appCart.useCart.getState();

const selectIds = (s: CartState) => s.ids;
const selectLastRemoved = (s: CartState) => s.lastRemoved;
const selectGross = (s: CartState) => selectTotals(s, priceOfH).gross;

/** Units in the cart, for the tab badge. A number, so it only re-renders when the number changes. */
export function useCartCount(): number {
  return appCart.useCart(selectCount);
}

/** Line ids in display order. Same array until a line is added, removed or restored. */
export function useCartIds(): readonly string[] {
  return appCart.useCart(selectIds);
}

/** One line. Changing another line's quantity does not re-render this subscriber. */
export function useCartLine(id: string): CartLine | undefined {
  return appCart.useCart((s) => s.byId[id]);
}

/** The deletion that undo would restore, or null. */
export function useLastRemoved(): RemovedLine | null {
  return appCart.useCart(selectLastRemoved);
}

/** Total, TVA share and amount before TVA. Subscribes to the total only (a number). */
export function useCartTotals(): VatSplit {
  return splitVat(appCart.useCart(selectGross));
}
