/**
 * Cart logic as a pure reducer (docs/CART_SPEC.md). The zustand store only wraps this, so every rule
 * here is unit-tested without React. Money is integer halalas; prices are looked up, never copied.
 */
import { splitVat, type Halalas, type VatSplit } from '@/core/money';

export const MAX_QTY = 99;

export interface CartLine {
  id: string;
  qty: number;
}

export interface RemovedLine {
  line: CartLine;
  /** Position the line had, so undo puts it back exactly where it was. */
  index: number;
}

export interface CartState {
  /** Insertion order. Kept as the same array reference when only quantities change. */
  ids: readonly string[];
  byId: Readonly<Record<string, CartLine>>;
  /** The last deletion while its undo is still offered; null once committed. */
  lastRemoved: RemovedLine | null;
}

export type CartAction =
  | { type: 'add'; id: string; qty?: number }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'remove'; id: string }
  | { type: 'undo' }
  | { type: 'commitRemoval' }
  | { type: 'clear' };

export const EMPTY_CART: CartState = { ids: [], byId: {}, lastRemoved: null };

function clampQty(qty: number): number {
  return Math.min(MAX_QTY, Math.max(1, Math.floor(qty)));
}

function removeLine(state: CartState, id: string): CartState {
  const index = state.ids.indexOf(id);
  const line = state.byId[id];
  if (index === -1 || line === undefined) return state;
  const byId = { ...state.byId };
  delete byId[id];
  return {
    ids: state.ids.filter((x) => x !== id),
    byId,
    lastRemoved: { line, index },
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const qty = action.qty ?? 1;
      if (!Number.isFinite(qty) || qty < 1) return state;
      const existing = state.byId[action.id];
      const nextQty = clampQty((existing?.qty ?? 0) + qty);
      return {
        ids: existing ? state.ids : [...state.ids, action.id],
        byId: { ...state.byId, [action.id]: { id: action.id, qty: nextQty } },
        // A new add makes the old deletion final: undo must never resurrect a line next to a fresh one.
        lastRemoved: null,
      };
    }
    case 'setQty': {
      if (!Number.isFinite(action.qty) || action.qty < 0) return state;
      const existing = state.byId[action.id];
      if (!existing) return state;
      if (Math.floor(action.qty) === 0) return removeLine(state, action.id);
      const qty = clampQty(action.qty);
      if (qty === existing.qty) return state;
      return { ...state, byId: { ...state.byId, [action.id]: { id: action.id, qty } } };
    }
    case 'remove':
      return removeLine(state, action.id);
    case 'undo': {
      const removed = state.lastRemoved;
      if (removed === null) return state;
      // The same product was added again meanwhile: the fresh line wins, the undo is dropped.
      if (state.byId[removed.line.id]) return { ...state, lastRemoved: null };
      const index = Math.min(removed.index, state.ids.length);
      const ids = [...state.ids];
      ids.splice(index, 0, removed.line.id);
      return { ids, byId: { ...state.byId, [removed.line.id]: removed.line }, lastRemoved: null };
    }
    case 'commitRemoval':
      return state.lastRemoved === null ? state : { ...state, lastRemoved: null };
    case 'clear':
      return EMPTY_CART;
  }
}

/** Badge number: total units, not distinct lines. */
export function selectCount(state: CartState): number {
  let count = 0;
  for (const id of state.ids) count += state.byId[id]?.qty ?? 0;
  return count;
}

export function selectLine(state: CartState, id: string): CartLine | undefined {
  return state.byId[id];
}

/**
 * Total is the sum of VAT-inclusive prices; the VAT share and the subtotal are derived from it once,
 * on the total, so rounding happens a single time (K-04).
 */
export function selectTotals(state: CartState, lookupPriceH: (id: string) => Halalas | undefined): VatSplit {
  let gross = 0;
  for (const id of state.ids) {
    const line = state.byId[id];
    const price = lookupPriceH(id);
    if (line === undefined || price === undefined) {
      throw new Error(`Cart line ${id} has no price`);
    }
    gross += price * line.qty;
  }
  return splitVat(gross);
}
