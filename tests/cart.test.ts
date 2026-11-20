/**
 * Cart rules (S-04, K-03, K-04, docs/CART_SPEC.md): quantities, totals, VAT and undo.
 * Pure reducer tests: no React, no store, no timers.
 */
import vectors from '../docs/fixtures/cart-vectors.json';
import { splitVat, toHalalas, type Halalas } from '@/core/money';
import { mulberry32, randInt } from '@/core/rng';
import { formatAmount, formatCount, formatSar } from '@/i18n/format';
import {
  EMPTY_CART,
  MAX_QTY,
  cartReducer,
  selectCount,
  selectLine,
  selectTotals,
  type CartAction,
  type CartState,
} from '@/state/cartMath';

interface VectorLine {
  priceH: number;
  qty: number;
}
interface VectorCase {
  name: string;
  lines: VectorLine[];
  expected: { gross: number; vat: number; net: number };
}

function run(actions: readonly CartAction[], from: CartState = EMPTY_CART): CartState {
  return actions.reduce(cartReducer, from);
}

/** Builds a cart where line i is product `v-i` with the vector's price, and a matching price lookup. */
function cartFromLines(lines: readonly VectorLine[]) {
  const prices = new Map<string, Halalas>();
  let state = EMPTY_CART;
  lines.forEach((line, i) => {
    const id = `v-${i}`;
    prices.set(id, line.priceH);
    state = cartReducer(state, { type: 'add', id, qty: line.qty });
  });
  return { state, lookup: (id: string) => prices.get(id) };
}

describe('1. VAT vectors (docs/fixtures/cart-vectors.json)', () => {
  const cases = (vectors as { cases: VectorCase[] }).cases;

  it('has the 8 agreed cases', () => {
    expect(cases).toHaveLength(8);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const { state, lookup } = cartFromLines(c.lines);
    expect(selectTotals(state, lookup)).toEqual(c.expected);
  });
});

describe('2. VAT split property (10,000 seeded amounts)', () => {
  it('net + vat === gross, and vat is gross × 3/23 rounded', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 10_000; i++) {
      const gross = randInt(rng, 0, 5_000_000);
      const { vat, net } = splitVat(gross);
      expect(Number.isInteger(vat)).toBe(true);
      expect(net + vat).toBe(gross);
      // 6·gross + 23 is always odd, so an exact .5 never happens and Math.round agrees with the integer formula.
      expect(vat).toBe(Math.round((gross * 3) / 23));
    }
  });
});

describe('3. add', () => {
  it('appends new products in insertion order', () => {
    const state = run([
      { type: 'add', id: 'a' },
      { type: 'add', id: 'b' },
      { type: 'add', id: 'c' },
    ]);
    expect(state.ids).toEqual(['a', 'b', 'c']);
    expect(selectLine(state, 'b')).toEqual({ id: 'b', qty: 1 });
  });

  it('merges a repeated product into one line and keeps its position', () => {
    const state = run([
      { type: 'add', id: 'a' },
      { type: 'add', id: 'b' },
      { type: 'add', id: 'a', qty: 2 },
    ]);
    expect(state.ids).toEqual(['a', 'b']);
    expect(selectLine(state, 'a')?.qty).toBe(3);
  });

  it('clamps the merged quantity at MAX_QTY', () => {
    const state = run([
      { type: 'add', id: 'a', qty: 90 },
      { type: 'add', id: 'a', qty: 20 },
    ]);
    expect(selectLine(state, 'a')?.qty).toBe(MAX_QTY);
  });

  it('ignores zero, negative and non-finite quantities', () => {
    const start = run([{ type: 'add', id: 'a' }]);
    for (const qty of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cartReducer(start, { type: 'add', id: 'a', qty })).toBe(start);
    }
  });
});

describe('4. setQty', () => {
  const start = run([
    { type: 'add', id: 'a' },
    { type: 'add', id: 'b' },
  ]);

  it('sets the quantity and clamps to 1…99', () => {
    expect(selectLine(cartReducer(start, { type: 'setQty', id: 'a', qty: 5 }), 'a')?.qty).toBe(5);
    expect(selectLine(cartReducer(start, { type: 'setQty', id: 'a', qty: 500 }), 'a')?.qty).toBe(99);
    expect(selectLine(cartReducer(start, { type: 'setQty', id: 'a', qty: 2.7 }), 'a')?.qty).toBe(2);
  });

  it('removes the line at 0 and offers it for undo', () => {
    const state = cartReducer(start, { type: 'setQty', id: 'a', qty: 0 });
    expect(state.ids).toEqual(['b']);
    expect(state.lastRemoved).toEqual({ line: { id: 'a', qty: 1 }, index: 0 });
  });

  it('ignores negative, NaN and unknown ids (same state object)', () => {
    expect(cartReducer(start, { type: 'setQty', id: 'a', qty: -3 })).toBe(start);
    expect(cartReducer(start, { type: 'setQty', id: 'a', qty: Number.NaN })).toBe(start);
    expect(cartReducer(start, { type: 'setQty', id: 'zzz', qty: 4 })).toBe(start);
  });

  it('returns the same state when the quantity does not change', () => {
    expect(cartReducer(start, { type: 'setQty', id: 'a', qty: 1 })).toBe(start);
  });
});

describe('5. remove and undo', () => {
  const start = run([
    { type: 'add', id: 'a' },
    { type: 'add', id: 'b', qty: 3 },
    { type: 'add', id: 'c' },
  ]);

  it('undo puts the line back at its old index with its old quantity', () => {
    const removed = cartReducer(start, { type: 'remove', id: 'b' });
    expect(removed.ids).toEqual(['a', 'c']);
    const restored = cartReducer(removed, { type: 'undo' });
    expect(restored.ids).toEqual(['a', 'b', 'c']);
    expect(selectLine(restored, 'b')?.qty).toBe(3);
    expect(restored.lastRemoved).toBeNull();
  });

  it('a second undo is a no-op', () => {
    const once = run([{ type: 'remove', id: 'b' }, { type: 'undo' }], start);
    expect(cartReducer(once, { type: 'undo' })).toBe(once);
  });

  it('a second delete replaces the undo target', () => {
    const state = run(
      [
        { type: 'remove', id: 'a' },
        { type: 'remove', id: 'c' },
        { type: 'undo' },
      ],
      start,
    );
    expect(state.ids).toEqual(['b', 'c']);
    expect(selectLine(state, 'a')).toBeUndefined();
  });

  it('after two deletes, undo restores the latest one at its own index', () => {
    const state = run(
      [
        { type: 'remove', id: 'c' },
        { type: 'remove', id: 'a' },
      ],
      start,
    );
    // Only 'a' can be undone now (the second delete replaced the target); it returns to index 0.
    expect(cartReducer(state, { type: 'undo' }).ids).toEqual(['a', 'b']);
  });

  it('adding any product after a delete makes the delete final', () => {
    const state = run(
      [
        { type: 'remove', id: 'b' },
        { type: 'add', id: 'd' },
        { type: 'undo' },
      ],
      start,
    );
    expect(state.ids).toEqual(['a', 'c', 'd']);
  });

  it('commitRemoval clears the undo and is a no-op when there is nothing to commit', () => {
    const removed = cartReducer(start, { type: 'remove', id: 'a' });
    const committed = cartReducer(removed, { type: 'commitRemoval' });
    expect(committed.lastRemoved).toBeNull();
    expect(cartReducer(committed, { type: 'undo' })).toBe(committed);
    expect(cartReducer(committed, { type: 'commitRemoval' })).toBe(committed);
  });

  it('removing an unknown id returns the same state', () => {
    expect(cartReducer(start, { type: 'remove', id: 'zzz' })).toBe(start);
  });

  it('clear empties everything', () => {
    expect(cartReducer(start, { type: 'clear' })).toBe(EMPTY_CART);
  });
});

describe('5b. removeOrdered (after a successful checkout)', () => {
  // The order took 1 × a and 3 × b; meanwhile the cart may have changed.
  const ordered = [
    { productId: 'a', qty: 1 },
    { productId: 'b', qty: 3 },
  ];
  const start = run([
    { type: 'add', id: 'a' },
    { type: 'add', id: 'b', qty: 3 },
  ]);

  it('empties the cart when nothing changed during the order, without offering undo', () => {
    const state = cartReducer(start, { type: 'removeOrdered', lines: ordered });
    expect(state.ids).toEqual([]);
    expect(state.byId).toEqual({});
    expect(state.lastRemoved).toBeNull();
  });

  it('keeps extra units and new lines added while the order was in flight', () => {
    const during = run(
      [
        { type: 'add', id: 'b', qty: 2 },
        { type: 'add', id: 'c' },
      ],
      start,
    );
    const state = cartReducer(during, { type: 'removeOrdered', lines: ordered });
    expect(state.ids).toEqual(['b', 'c']);
    expect(selectLine(state, 'b')?.qty).toBe(2);
    expect(selectLine(state, 'c')?.qty).toBe(1);
    expect(state.lastRemoved).toBeNull();
  });

  it('a line lowered or removed meanwhile is simply gone, never negative', () => {
    const during = run(
      [
        { type: 'setQty', id: 'b', qty: 1 },
        { type: 'remove', id: 'a' },
        { type: 'commitRemoval' },
      ],
      start,
    );
    const state = cartReducer(during, { type: 'removeOrdered', lines: ordered });
    expect(state.ids).toEqual([]);
  });

  it('keeps a pending undo for a product that was not ordered, drops one for a product that was', () => {
    const withC = run([{ type: 'add', id: 'c' }], start);
    const cRemoved = cartReducer(withC, { type: 'remove', id: 'c' });
    expect(cartReducer(cRemoved, { type: 'removeOrdered', lines: ordered }).lastRemoved?.line.id).toBe('c');

    // `a` removed by hand while its order was in flight: undo must not put a bought line back.
    const aRemoved = cartReducer(start, { type: 'remove', id: 'a' });
    expect(cartReducer(aRemoved, { type: 'removeOrdered', lines: ordered }).lastRemoved).toBeNull();
  });

  it('keeps the ids array when only quantities drop, and the same state when nothing matches', () => {
    const during = run([{ type: 'add', id: 'a', qty: 4 }, { type: 'add', id: 'b' }], start);
    const state = cartReducer(during, { type: 'removeOrdered', lines: ordered });
    expect(state.ids).toBe(during.ids);
    expect([selectLine(state, 'a')?.qty, selectLine(state, 'b')?.qty]).toEqual([4, 1]);

    expect(cartReducer(start, { type: 'removeOrdered', lines: [{ productId: 'zzz', qty: 1 }] })).toBe(start);
    expect(cartReducer(start, { type: 'removeOrdered', lines: [] })).toBe(start);
  });
});

describe('6. selectors', () => {
  it('selectCount sums units, not lines', () => {
    const state = run([
      { type: 'add', id: 'a', qty: 2 },
      { type: 'add', id: 'b', qty: 3 },
    ]);
    expect(selectCount(state)).toBe(5);
    expect(selectCount(EMPTY_CART)).toBe(0);
  });

  it('keeps the ids array reference when only a quantity changes (rows do not re-render)', () => {
    const state = run([
      { type: 'add', id: 'a' },
      { type: 'add', id: 'b' },
    ]);
    const next = cartReducer(state, { type: 'setQty', id: 'b', qty: 4 });
    expect(next.ids).toBe(state.ids);
    expect(next.byId.a).toBe(state.byId.a);
    expect(next.byId.b).not.toBe(state.byId.b);
  });

  it('selectTotals throws when a line has no price, instead of silently pricing it at 0', () => {
    const state = run([{ type: 'add', id: 'ghost' }]);
    expect(() => selectTotals(state, () => undefined)).toThrow('Cart line ghost has no price');
  });
});

describe('7. float safety', () => {
  it('converts SAR prices to exact integer halalas', () => {
    expect(toHalalas(0.1 + 0.2)).toBe(30);
    expect(toHalalas(49.95)).toBe(4995);
    expect(toHalalas(19.99)).toBe(1999);
    expect(toHalalas(1.005)).toBe(100); // 1.005 is 1.00499… in binary; documented, never used as a price.
  });

  it('three items at 0.10 SAR total exactly 0.30 SAR', () => {
    const { state, lookup } = cartFromLines([{ priceH: toHalalas(0.1), qty: 3 }]);
    expect(selectTotals(state, lookup).gross).toBe(30);
  });
});

describe('8. formatSar', () => {
  it('formats English and Arabic with Western digits and two decimals', () => {
    expect(formatSar(4995, 'en')).toBe('49.95 SAR');
    expect(formatSar(4995, 'ar')).toBe('49.95 ر.س');
    expect(formatSar(0, 'en')).toBe('0.00 SAR');
    expect(formatSar(5, 'en')).toBe('0.05 SAR');
    expect(formatSar(100, 'en')).toBe('1.00 SAR');
  });

  it('groups thousands', () => {
    expect(formatSar(1979901, 'en')).toBe('19,799.01 SAR');
    expect(formatAmount(100_000_000)).toBe('1,000,000.00');
    expect(formatAmount(99_999)).toBe('999.99');
  });

  it('keeps the sign on negative amounts', () => {
    expect(formatAmount(-4995)).toBe('-49.95');
  });

  it('formats counts', () => {
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(-3)).toBe('0');
  });
});

describe('9. scale', () => {
  it('1,000 lines × 99 at the highest catalog price stays a safe integer', () => {
    const lines = Array.from({ length: 1000 }, () => ({ priceH: 68_900, qty: 99 }));
    const { state, lookup } = cartFromLines(lines);
    const totals = selectTotals(state, lookup);
    expect(totals.gross).toBe(68_900 * 99 * 1000);
    expect(Number.isSafeInteger(totals.gross)).toBe(true);
    expect(totals.net + totals.vat).toBe(totals.gross);
    expect(selectCount(state)).toBe(99_000);
  });
});
