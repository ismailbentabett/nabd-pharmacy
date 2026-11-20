/**
 * Placing an order and listing past orders. Two implementations behind one contract, like the
 * catalog (`types.ts`):
 *
 * - Supabase: `place_order` (supabase/migrations/20261120000300_place_order.sql) prices the cart on
 *   the server from `products.price_h`, checks stock and writes the order in one transaction. The
 *   client only sends product ids and quantities, never prices. Orders are read back through RLS
 *   (a user sees only their own rows).
 * - Fake: the offline build. Same validation rules as the SQL function, prices from the on-device
 *   catalog, orders kept in memory until the app closes.
 *
 * Money stays integer halalas on both sides (`gross_h`, `vat_h`, `net_h`), and the VAT split uses the
 * same integer formula as the cart (`splitVat`), so the order total always equals the cart total.
 *
 * Idempotency: every call carries a client `requestId` (a uuid). A retry of the same checkout sends the
 * same id, and both backends answer it with the order already written instead of a second one, so a
 * timeout whose request did reach the server cannot charge the cart twice.
 *
 * Failures the user can act on become a typed `CheckoutError` (thrown inside `CheckoutFailure`), so
 * the screen picks a message from the kind, never from a server string.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { findProduct } from '../catalog';
import { splitVat, toHalalas, type Halalas } from '../money';
import { BackendError } from './types';

export type OrderStatus = 'placed' | 'preparing' | 'delivered' | 'cancelled';
const ORDER_STATUSES: readonly OrderStatus[] = ['placed', 'preparing', 'delivered', 'cancelled'];

export interface OrderLineInput {
  productId: string;
  qty: number;
}

export interface OrderSummary {
  id: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  status: OrderStatus;
  grossH: Halalas;
  vatH: Halalas;
  netH: Halalas;
  /** Total units, as the cart badge counts them. */
  itemCount: number;
}

export interface OrdersApi {
  readonly kind: 'fake' | 'supabase';
  /** `requestId`: the same uuid for every retry of one checkout; it returns the first order made with it. */
  placeOrder(lines: readonly OrderLineInput[], requestId: string): Promise<OrderSummary>;
  /** Newest first. */
  listOrders(): Promise<OrderSummary[]>;
}

/** Same limits as `place_order`. */
export const MAX_ORDER_LINES = 50;
export const MAX_LINE_QTY = 99;
/** How many past orders the account screen shows. It is a plain list, not virtualised. */
export const ORDER_HISTORY_LIMIT = 50;

export type CheckoutError =
  | { kind: 'empty' }
  | { kind: 'tooMany' }
  | { kind: 'outOfStock'; productId: string }
  | { kind: 'unknownProduct'; productId: string }
  | { kind: 'signedOut' }
  | { kind: 'generic' };

export class CheckoutFailure extends Error {
  readonly reason: CheckoutError;

  constructor(reason: CheckoutError, detail?: string) {
    super(detail ? `Checkout failed (${reason.kind}): ${detail}` : `Checkout failed (${reason.kind})`);
    this.name = 'CheckoutFailure';
    this.reason = reason;
  }
}

/**
 * Maps a `place_order` error to what the user can do about it. The SQL raises a fixed token as the
 * message (`OUT_OF_STOCK p-0001`); anything else (network, timeout, a bug) is `generic`.
 */
export function checkoutErrorFromServer(message: string | undefined, code: string | undefined): CheckoutError {
  const text = (message ?? '').trim();
  const [token = '', productId = ''] = text.split(/\s+/);
  if (code === '28000' || token === 'NOT_SIGNED_IN') return { kind: 'signedOut' };
  switch (token) {
    case 'EMPTY_ORDER':
      return { kind: 'empty' };
    case 'TOO_MANY_LINES':
    case 'BAD_QTY':
      return { kind: 'tooMany' };
    case 'OUT_OF_STOCK':
      return productId === '' ? { kind: 'generic' } : { kind: 'outOfStock', productId };
    case 'UNKNOWN_PRODUCT':
      return productId === '' ? { kind: 'generic' } : { kind: 'unknownProduct', productId };
    default:
      // DUPLICATE_LINE cannot come from the cart (one line per product), so it is a bug, not a user fix.
      return { kind: 'generic' };
  }
}

/** Whatever `placeOrder` threw, as a `CheckoutError`. */
export function toCheckoutError(error: unknown): CheckoutError {
  return error instanceof CheckoutFailure ? error.reason : { kind: 'generic' };
}

/** The short number shown to people: the last 6 characters of the id, upper case. */
export function orderNumber(id: string): string {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

// ---------------------------------------------------------------------------------------------
// Supabase

/** `place_order`'s jsonb result and one row of `public.orders`: the same columns. */
export interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  gross_h: number;
  vat_h: number;
  net_h: number;
  item_count: number;
}

const ORDER_COLUMNS = 'id, created_at, status, gross_h, vat_h, net_h, item_count';

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function orderFromRow(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
    // The table has a check constraint on these four; a new server status shows as "placed" until
    // the app learns it, rather than crashing the whole history.
    status: isOrderStatus(row.status) ? row.status : 'placed',
    grossH: Number(row.gross_h),
    vatH: Number(row.vat_h),
    netH: Number(row.net_h),
    itemCount: Number(row.item_count),
  };
}

export function createSupabaseOrdersApi(supabase: SupabaseClient): OrdersApi {
  return {
    kind: 'supabase',

    async placeOrder(lines, requestId) {
      const payload = lines.map((line) => ({ product_id: line.productId, qty: line.qty }));
      const { data, error } = await supabase.rpc('place_order', { lines: payload, request_id: requestId });
      if (error) throw new CheckoutFailure(checkoutErrorFromServer(error.message, error.code), error.message);
      if (data === null || typeof data !== 'object') {
        throw new CheckoutFailure({ kind: 'generic' }, 'place_order returned no order');
      }
      return orderFromRow(data as unknown as OrderRow);
    },

    async listOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(ORDER_HISTORY_LIMIT);
      if (error) throw new BackendError('orders', error.message, error.code);
      return ((data ?? []) as unknown as OrderRow[]).map(orderFromRow);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Fake (offline build)

export interface FakeOrdersOptions {
  /** Simulated round trip. Short: placing an order should feel quick in the demo. Tests pass 0. */
  delayMs?: number;
  /** Clock for `createdAt`. Tests pass a fixed one. */
  now?: () => number;
}

const DEFAULT_FAKE_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

/** The `place_order` checks, in the same order, against the on-device catalog. */
function priceFakeOrder(lines: readonly OrderLineInput[]): { gross: Halalas; itemCount: number } {
  if (lines.length === 0) throw new CheckoutFailure({ kind: 'empty' });
  if (lines.length > MAX_ORDER_LINES) throw new CheckoutFailure({ kind: 'tooMany' });
  const seen = new Set<string>();
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_LINE_QTY) {
      throw new CheckoutFailure({ kind: 'tooMany' });
    }
    if (seen.has(line.productId)) throw new CheckoutFailure({ kind: 'generic' }, 'duplicate line');
    seen.add(line.productId);
  }
  let gross = 0;
  let itemCount = 0;
  for (const line of lines) {
    const product = findProduct(line.productId);
    if (product === undefined) throw new CheckoutFailure({ kind: 'unknownProduct', productId: line.productId });
    if (!product.inStock) throw new CheckoutFailure({ kind: 'outOfStock', productId: line.productId });
    gross += toHalalas(product.price) * line.qty;
    itemCount += line.qty;
  }
  return { gross, itemCount };
}

export function createFakeOrdersApi(options: FakeOrdersOptions = {}): OrdersApi {
  const delayMs = options.delayMs ?? DEFAULT_FAKE_DELAY_MS;
  const now = options.now ?? Date.now;
  // Newest first, like the server query.
  const orders: OrderSummary[] = [];
  // Like the unique (user_id, request_id) index on the server: one order per request id.
  const byRequestId = new Map<string, OrderSummary>();
  let sequence = 0;

  return {
    kind: 'fake',

    async placeOrder(lines, requestId) {
      await wait(delayMs);
      // Checked before validation, as the SQL does: a retry gets its order back even if stock changed since.
      const existing = byRequestId.get(requestId);
      if (existing !== undefined) return existing;
      const { gross, itemCount } = priceFakeOrder(lines);
      const { vat, net } = splitVat(gross);
      sequence += 1;
      const order: OrderSummary = {
        // Deterministic: the n-th order of a run always has the same id.
        id: `offline-${String(sequence).padStart(6, '0')}`,
        createdAt: new Date(now()).toISOString(),
        status: 'placed',
        grossH: gross,
        vatH: vat,
        netH: net,
        itemCount,
      };
      orders.unshift(order);
      byRequestId.set(requestId, order);
      return order;
    },

    async listOrders() {
      await wait(delayMs);
      return orders.slice(0, ORDER_HISTORY_LIMIT);
    },
  };
}
