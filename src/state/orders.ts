/**
 * Orders wiring: which backend places orders, the query key the history reads, and the last order
 * placed in this session (the cart shows it after it empties itself).
 *
 * Backend choice is the same as the catalog's (`src/state/api.ts`): Supabase when the build has its
 * keys, otherwise the in-memory fake.
 *
 * Offline policy (ADR to record): the offline build CAN place orders. They go to the fake service,
 * live in memory and disappear when the app closes; the cart says so under the button. This keeps
 * the whole flow (cart → order → history) demoable on a fresh clone with no account, and a fake
 * order never reaches a server, so nothing can be mistaken for a real purchase.
 */
import { create } from 'zustand';

import { createFakeOrdersApi, createSupabaseOrdersApi, type OrderSummary, type OrdersApi } from '@/core/api/ordersApi';
import { getSupabase } from '@/core/supabase/client';

const supabase = getSupabase();

export const ordersApi: OrdersApi = supabase === null ? createFakeOrdersApi() : createSupabaseOrdersApi(supabase);

export const ORDERS_QUERY_KEY = ['orders'] as const;

const useLastOrderStore = create<{ order: OrderSummary | null }>(() => ({ order: null }));

/** The order placed most recently in this session, until the confirmation is dismissed. */
export function useLastPlacedOrder(): OrderSummary | null {
  return useLastOrderStore((s) => s.order);
}

export function setLastPlacedOrder(order: OrderSummary | null): void {
  useLastOrderStore.setState({ order });
}
