/**
 * Order history on the Account tab: skeleton while loading, empty, error with retry, and the list
 * (number, date, status, item count, total), in English and Arabic. Who may see it: anyone on the
 * offline build, only a signed-in person on a Supabase build.
 */
import { act, screen } from '@testing-library/react-native';

import copy from '../docs/fixtures/copy.json';
import type { OrderSummary } from '@/core/api/ordersApi';
import { formatOrderDate, OrdersSection } from '@/features/orders/OrdersSection';
import * as ordersModule from '@/state/orders';
import { OFFLINE_SESSION, setSession } from '@/state/session.store';
import { testIds } from '@/testIds';

import { renderWithProviders, pressNative } from './helpers/render';

type MockOrdersApi = {
  kind: 'fake' | 'supabase';
  placeOrder: jest.Mock<Promise<OrderSummary>, [unknown]>;
  listOrders: jest.Mock<Promise<OrderSummary[]>, []>;
};

// Built inside the factory: imports are hoisted above everything else in this file.
jest.mock('@/state/orders', () => ({
  ...jest.requireActual<typeof import('@/state/orders')>('@/state/orders'),
  ordersApi: { kind: 'fake', placeOrder: jest.fn(), listOrders: jest.fn() },
}));

const mockOrdersApi = ordersModule.ordersApi as unknown as MockOrdersApi;

const ORDERS: OrderSummary[] = [
  {
    id: '6f1c2a90-4b1e-4d7a-9c55-0a1b2c3d4e5f',
    createdAt: '2026-11-20T09:30:00.000Z',
    status: 'preparing',
    grossH: 13298,
    vatH: 1735,
    netH: 11563,
    itemCount: 3,
  },
  {
    id: 'offline-000001',
    createdAt: '2026-11-02T18:00:00.000Z',
    status: 'delivered',
    grossH: 11500,
    vatH: 1500,
    netH: 10000,
    itemCount: 1,
  },
];

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOrdersApi.kind = 'fake';
  setSession(OFFLINE_SESSION);
});

afterEach(() => {
  setSession(OFFLINE_SESSION);
});

describe('OrdersSection', () => {
  it('shows the skeleton while the orders load', async () => {
    mockOrdersApi.listOrders.mockImplementation(() => new Promise(() => undefined));
    await renderWithProviders(<OrdersSection />);

    expect(screen.getByTestId(testIds.orders.loading)).toBeOnTheScreen();
    expect(screen.getByLabelText(copy.en['orders.loading'])).toBeOnTheScreen();
    expect(screen.getByText(copy.en['account.orders.title'])).toBeOnTheScreen();
  });

  it('says there are no orders yet', async () => {
    mockOrdersApi.listOrders.mockResolvedValue([]);
    await renderWithProviders(<OrdersSection />);
    await flush();

    expect(screen.getByTestId(testIds.orders.empty)).toBeOnTheScreen();
    expect(screen.getByText(copy.en['orders.empty.title'])).toBeOnTheScreen();
    expect(screen.queryByTestId(testIds.orders.list)).toBeNull();
  });

  it('shows an error with a retry that loads again', async () => {
    mockOrdersApi.listOrders.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(ORDERS);
    await renderWithProviders(<OrdersSection />);
    await flush();

    expect(screen.getByTestId(testIds.orders.error)).toBeOnTheScreen();
    expect(screen.getByText(copy.en['orders.error.title'])).toBeOnTheScreen();

    await pressNative(testIds.orders.error);
    await flush();

    expect(mockOrdersApi.listOrders).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(testIds.orders.list)).toBeOnTheScreen();
  });

  it('lists each order with number, date, status, item count and total, newest first', async () => {
    mockOrdersApi.listOrders.mockResolvedValue(ORDERS);
    await renderWithProviders(<OrdersSection />);
    await flush();

    const rows = screen.getAllByTestId(/^orders-row-/).map((row) => row.props.testID as string);
    expect(rows).toEqual(ORDERS.map((o) => testIds.orders.row(o.id)));

    expect(screen.getByText('Order 3D4E5F')).toBeOnTheScreen();
    expect(screen.getByText('Order 000001')).toBeOnTheScreen();
    expect(screen.getByText(copy.en['orders.status.preparing'])).toBeOnTheScreen();
    expect(screen.getByText(copy.en['orders.status.delivered'])).toBeOnTheScreen();
    expect(screen.getByText('20 Nov 2026 · 3 items')).toBeOnTheScreen();
    expect(screen.getByText('2 Nov 2026 · 1 item')).toBeOnTheScreen();
    expect(screen.getByText(/132\.98/)).toBeOnTheScreen();
    expect(screen.getByText(/115\.00/)).toBeOnTheScreen();
  });

  it('renders in Arabic with Western digits', async () => {
    mockOrdersApi.listOrders.mockResolvedValue(ORDERS);
    await renderWithProviders(<OrdersSection />, { lang: 'ar' });
    await flush();

    expect(screen.getByText(copy.ar['account.orders.title'])).toBeOnTheScreen();
    expect(screen.getByText('الطلب 3D4E5F')).toBeOnTheScreen();
    expect(screen.getByText(copy.ar['orders.status.delivered'])).toBeOnTheScreen();
    const date = formatOrderDate(ORDERS[0]!.createdAt, 'ar');
    expect(date).toMatch(/^20 .+ 2026$/);
    expect(screen.getByText(new RegExp(`^${date} · `))).toBeOnTheScreen();
  });

  it('on a Supabase build, shows nothing while signed out and loads once signed in', async () => {
    mockOrdersApi.kind = 'supabase';
    mockOrdersApi.listOrders.mockResolvedValue(ORDERS);
    setSession({ status: 'signedOut', email: null, userId: null });
    await renderWithProviders(<OrdersSection />);
    await flush();

    expect(screen.queryByText(copy.en['account.orders.title'])).toBeNull();
    expect(mockOrdersApi.listOrders).not.toHaveBeenCalled();

    await act(async () => setSession({ status: 'signedIn', email: 'test@example.test', userId: 'user-1' }));
    await flush();

    expect(mockOrdersApi.listOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(testIds.orders.list)).toBeOnTheScreen();
  });
});
