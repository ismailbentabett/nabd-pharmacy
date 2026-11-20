/**
 * The orders adapters without a network: the SQL error tokens map to typed reasons, the Supabase
 * adapter sends snake_case lines to `place_order` and reads history newest first, and the offline
 * fake prices an order exactly as the cart's totals card does.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CheckoutFailure,
  checkoutErrorFromServer,
  createFakeOrdersApi,
  createSupabaseOrdersApi,
  MAX_LINE_QTY,
  MAX_ORDER_LINES,
  ORDER_HISTORY_LIMIT,
  orderFromRow,
  orderNumber,
  toCheckoutError,
  type OrderLineInput,
  type OrderRow,
} from '@/core/api/ordersApi';
import { BackendError } from '@/core/api/types';
import { getCatalog } from '@/core/catalog';
import { priceOfH } from '@/state/cart.store';
import { selectTotals, type CartState } from '@/state/cartMath';

type Result = { data?: unknown; error?: { message: string; code?: string } | null };
type Call = [method: string, ...args: unknown[]];

function fakeClient(result: Result) {
  const calls: Call[] = [];
  const tables: string[] = [];
  const rpcs: [string, unknown][] = [];
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'limit']) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.then = (resolve: (r: Result) => unknown) => resolve({ data: null, error: null, ...result });
  const client = {
    from: (table: string) => {
      tables.push(table);
      return query;
    },
    rpc: (name: string, args: unknown) => {
      rpcs.push([name, args]);
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls, tables, rpcs };
}

const ROW: OrderRow = {
  id: '6f1c2a90-4b1e-4d7a-9c55-0a1b2c3d4e5f',
  created_at: '2026-11-20T09:30:00.000Z',
  status: 'preparing',
  gross_h: 11500,
  vat_h: 1500,
  net_h: 10000,
  item_count: 3,
};

/** A fresh request id per call, so the fake's dedupe never merges two orders a test meant as separate. */
let requestCount = 0;
const newRequestId = () => `req-${String((requestCount += 1))}`;

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the promise to reject');
}

describe('checkoutErrorFromServer', () => {
  it.each([
    ['EMPTY_ORDER', '22023', { kind: 'empty' }],
    ['TOO_MANY_LINES', '22023', { kind: 'tooMany' }],
    ['BAD_QTY', '22023', { kind: 'tooMany' }],
    ['DUPLICATE_LINE', '22023', { kind: 'generic' }],
    ['UNKNOWN_PRODUCT p-0042', '22023', { kind: 'unknownProduct', productId: 'p-0042' }],
    ['OUT_OF_STOCK p-0007', '22023', { kind: 'outOfStock', productId: 'p-0007' }],
    ['NOT_SIGNED_IN', '28000', { kind: 'signedOut' }],
  ])('maps %s (%s)', (message, code, expected) => {
    expect(checkoutErrorFromServer(message, code)).toEqual(expected);
  });

  it('treats code 28000 as signed out whatever the message says', () => {
    expect(checkoutErrorFromServer('JWT expired', '28000')).toEqual({ kind: 'signedOut' });
  });

  it('falls back to generic for a token without its product id, an unknown token, or nothing', () => {
    expect(checkoutErrorFromServer('OUT_OF_STOCK', '22023')).toEqual({ kind: 'generic' });
    expect(checkoutErrorFromServer('UNKNOWN_PRODUCT ', '22023')).toEqual({ kind: 'generic' });
    expect(checkoutErrorFromServer('Failed to fetch', undefined)).toEqual({ kind: 'generic' });
    expect(checkoutErrorFromServer(undefined, undefined)).toEqual({ kind: 'generic' });
  });

  it('toCheckoutError keeps a typed reason and turns anything else into generic', () => {
    expect(toCheckoutError(new CheckoutFailure({ kind: 'tooMany' }))).toEqual({ kind: 'tooMany' });
    expect(toCheckoutError(new TypeError('Network request failed'))).toEqual({ kind: 'generic' });
  });
});

describe('orderNumber and orderFromRow', () => {
  it('shows the last 6 characters of the id, without hyphens, upper case', () => {
    expect(orderNumber(ROW.id)).toBe('3D4E5F');
    expect(orderNumber('offline-000012')).toBe('000012');
  });

  it('maps a row to camelCase and keeps money as integer halalas', () => {
    expect(orderFromRow(ROW)).toEqual({
      id: ROW.id,
      createdAt: ROW.created_at,
      status: 'preparing',
      grossH: 11500,
      vatH: 1500,
      netH: 10000,
      itemCount: 3,
    });
  });

  it('shows a status the app does not know yet as placed', () => {
    expect(orderFromRow({ ...ROW, status: 'refunded' }).status).toBe('placed');
  });
});

describe('createSupabaseOrdersApi', () => {
  it('calls place_order with snake_case lines and returns the order', async () => {
    const { client, rpcs } = fakeClient({ data: ROW });
    const api = createSupabaseOrdersApi(client);
    const order = await api.placeOrder(
      [
        { productId: 'p-0952', qty: 1 },
        { productId: 'p-0380', qty: 2 },
      ],
      'b7e2c1d0-0000-4000-8000-000000000001',
    );
    expect(api.kind).toBe('supabase');
    expect(rpcs).toEqual([
      [
        'place_order',
        {
          lines: [
            { product_id: 'p-0952', qty: 1 },
            { product_id: 'p-0380', qty: 2 },
          ],
          request_id: 'b7e2c1d0-0000-4000-8000-000000000001',
        },
      ],
    ]);
    expect(order.grossH).toBe(11500);
    expect(order.id).toBe(ROW.id);
  });

  it('throws a typed CheckoutFailure from the SQL error', async () => {
    const { client } = fakeClient({ error: { message: 'OUT_OF_STOCK p-0007', code: '22023' } });
    const error = await rejection(createSupabaseOrdersApi(client).placeOrder([{ productId: 'p-0007', qty: 1 }], newRequestId()));
    expect(error).toBeInstanceOf(CheckoutFailure);
    expect(toCheckoutError(error)).toEqual({ kind: 'outOfStock', productId: 'p-0007' });
  });

  it('throws generic when place_order returns nothing', async () => {
    const { client } = fakeClient({ data: null });
    const error = await rejection(createSupabaseOrdersApi(client).placeOrder([{ productId: 'p-0952', qty: 1 }], newRequestId()));
    expect(toCheckoutError(error)).toEqual({ kind: 'generic' });
  });

  it('reads the orders table newest first, capped, and maps each row', async () => {
    const { client, calls, tables } = fakeClient({ data: [ROW] });
    const orders = await createSupabaseOrdersApi(client).listOrders();
    expect(tables).toEqual(['orders']);
    expect(calls).toEqual([
      ['select', 'id, created_at, status, gross_h, vat_h, net_h, item_count'],
      ['order', 'created_at', { ascending: false }],
      ['limit', ORDER_HISTORY_LIMIT],
    ]);
    expect(orders).toEqual([orderFromRow(ROW)]);
  });

  it('turns a read error into a BackendError', async () => {
    const { client } = fakeClient({ error: { message: 'permission denied', code: '42501' } });
    const error = await rejection(createSupabaseOrdersApi(client).listOrders());
    expect(error).toBeInstanceOf(BackendError);
  });
});

describe('createFakeOrdersApi', () => {
  const NOW = Date.UTC(2026, 10, 20, 9, 30);
  const fake = () => createFakeOrdersApi({ delayMs: 0, now: () => NOW });

  it('prices an order exactly as the cart totals card does', async () => {
    const lines: OrderLineInput[] = [
      { productId: 'p-0952', qty: 1 },
      { productId: 'p-0380', qty: 3 },
      { productId: 'p-0001', qty: 2 },
      { productId: 'p-0002', qty: 1 },
    ];
    const cart: CartState = {
      ids: lines.map((l) => l.productId),
      byId: Object.fromEntries(lines.map((l) => [l.productId, { id: l.productId, qty: l.qty }])),
      lastRemoved: null,
    };
    const expected = selectTotals(cart, priceOfH);

    const order = await fake().placeOrder(lines, newRequestId());
    expect(order.grossH).toBe(expected.gross);
    expect(order.vatH).toBe(expected.vat);
    expect(order.netH).toBe(expected.net);
    expect(order.itemCount).toBe(7);
    expect(order.status).toBe('placed');
    expect(order.createdAt).toBe('2026-11-20T09:30:00.000Z');
  });

  it('115.00 SAR is 100.00 net + 15.00 VAT', async () => {
    const order = await fake().placeOrder([{ productId: 'p-0952', qty: 1 }], newRequestId());
    expect([order.grossH, order.netH, order.vatH]).toEqual([11500, 10000, 1500]);
  });

  it('gives deterministic ids and lists newest first', async () => {
    const api = fake();
    const first = await api.placeOrder([{ productId: 'p-0952', qty: 1 }], newRequestId());
    const second = await api.placeOrder([{ productId: 'p-0380', qty: 1 }], newRequestId());
    expect([first.id, second.id]).toEqual(['offline-000001', 'offline-000002']);
    expect((await api.listOrders()).map((o) => o.id)).toEqual(['offline-000002', 'offline-000001']);
  });

  it('rejects what place_order rejects, with the same reasons', async () => {
    const api = fake();
    const outOfStock = getCatalog().products.find((p) => !p.inStock);
    if (outOfStock === undefined) throw new Error('the seed has no out-of-stock product');
    const tooManyLines = Array.from({ length: MAX_ORDER_LINES + 1 }, (_, i) => ({
      productId: getCatalog().products[i]!.id,
      qty: 1,
    }));

    const reason = async (lines: OrderLineInput[]) => toCheckoutError(await rejection(api.placeOrder(lines, newRequestId())));
    expect(await reason([])).toEqual({ kind: 'empty' });
    expect(await reason(tooManyLines)).toEqual({ kind: 'tooMany' });
    expect(await reason([{ productId: 'p-0952', qty: MAX_LINE_QTY + 1 }])).toEqual({ kind: 'tooMany' });
    expect(await reason([{ productId: 'p-0952', qty: 0 }])).toEqual({ kind: 'tooMany' });
    expect(
      await reason([
        { productId: 'p-0952', qty: 1 },
        { productId: 'p-0952', qty: 1 },
      ]),
    ).toEqual({ kind: 'generic' });
    expect(await reason([{ productId: 'p-9999', qty: 1 }])).toEqual({ kind: 'unknownProduct', productId: 'p-9999' });
    expect(await reason([{ productId: outOfStock.id, qty: 1 }])).toEqual({
      kind: 'outOfStock',
      productId: outOfStock.id,
    });
    expect(await api.listOrders()).toEqual([]);
  });

  it('answers a retry with the same request id with the first order, and writes no second one', async () => {
    const api = fake();
    const requestId = newRequestId();
    const first = await api.placeOrder([{ productId: 'p-0952', qty: 1 }], requestId);
    // Even with other lines: the request id decides, as the unique index does on the server.
    const retry = await api.placeOrder([{ productId: 'p-0380', qty: 2 }], requestId);
    expect(retry).toBe(first);
    expect(await api.listOrders()).toEqual([first]);

    const next = await api.placeOrder([{ productId: 'p-0952', qty: 1 }], newRequestId());
    expect(next.id).not.toBe(first.id);
    expect(await api.listOrders()).toHaveLength(2);
  });

  it('a refused attempt does not reserve its request id', async () => {
    const api = fake();
    const requestId = newRequestId();
    await rejection(api.placeOrder([{ productId: 'p-9999', qty: 1 }], requestId));
    const order = await api.placeOrder([{ productId: 'p-0952', qty: 1 }], requestId);
    expect(order.grossH).toBe(11500);
  });
});
