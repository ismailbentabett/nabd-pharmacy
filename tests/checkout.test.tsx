/**
 * "Place order" on the Cart tab: success removes what was ordered (and only that) and shows the
 * confirmation, a server refusal is explained under the button (naming the product), a retry reuses
 * the request id, and a Supabase build sends a signed-out person to the Account tab instead of
 * ordering (and signs out locally when the server says the session is gone).
 *
 * `ordersApi` is swapped for a controllable stand-in; the rest of `@/state/orders` (the last-order
 * store, the query key) is the real module.
 */
import { act, screen } from '@testing-library/react-native';

import copy from '../docs/fixtures/copy.json';
import { CheckoutFailure, createFakeOrdersApi, type OrderSummary } from '@/core/api/ordersApi';
import { cartActions, getCartState } from '@/state/cart.store';
import * as authModule from '@/features/account/auth';
import * as ordersModule from '@/state/orders';
import { setLastPlacedOrder } from '@/state/orders';
import { OFFLINE_SESSION, setSession } from '@/state/session.store';
import { testIds } from '@/testIds';

import { P5950, P350, product, renderCart, resetCartTest, settle } from './helpers/cart';
import { pressNative } from './helpers/render';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));

// Only `signOut` is used by the button; the real one would talk to Supabase.
jest.mock('@/features/account/auth', () => ({ signOut: jest.fn(() => Promise.resolve({ ok: true })) }));
const mockSignOut = authModule.signOut as jest.Mock;

type MockOrdersApi = {
  kind: 'fake' | 'supabase';
  placeOrder: jest.Mock<Promise<OrderSummary>, [unknown, string]>;
  listOrders: jest.Mock<Promise<OrderSummary[]>, []>;
};

// Built inside the factory: the imports are hoisted above everything else in this file, so the
// factory cannot use a variable declared here. The tests reach it through the mocked module.
jest.mock('@/state/orders', () => ({
  ...jest.requireActual<typeof import('@/state/orders')>('@/state/orders'),
  ordersApi: { kind: 'fake', placeOrder: jest.fn(), listOrders: jest.fn() },
}));

const mockOrdersApi = ordersModule.ordersApi as unknown as MockOrdersApi;

const buttonLabel = () => screen.getByTestId(testIds.checkout.button).props.accessibilityLabel as string;

async function addAndRender(ids: string[], lang: 'en' | 'ar' = 'en') {
  for (const id of ids) cartActions.add(id);
  await renderCart(lang);
}

beforeEach(async () => {
  await resetCartTest();
  setLastPlacedOrder(null);
  setSession(OFFLINE_SESSION);
  const real = createFakeOrdersApi({ delayMs: 0, now: () => Date.UTC(2026, 10, 20) });
  mockOrdersApi.kind = 'fake';
  mockOrdersApi.placeOrder.mockImplementation((lines, requestId) =>
    real.placeOrder(lines as Parameters<typeof real.placeOrder>[0], requestId),
  );
  mockOrdersApi.listOrders.mockImplementation(() => real.listOrders());
});

afterEach(() => {
  setSession(OFFLINE_SESSION);
});

describe('placing an order', () => {
  it('sends the cart lines, empties the cart and shows the order number and total', async () => {
    await addAndRender([P5950, P350]);
    cartActions.setQty(P350, 2);
    await settle();
    expect(buttonLabel()).toBe(copy.en['checkout.placeOrder']);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(mockOrdersApi.placeOrder).toHaveBeenCalledWith(
      [
        { productId: P5950, qty: 1 },
        { productId: P350, qty: 2 },
      ],
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    );
    expect(getCartState().ids).toEqual([]);
    const success = screen.getByTestId(testIds.checkout.success);
    expect(success).toBeOnTheScreen();
    // 5,950.00 + 2 × 350.00 = 6,650.00 DA; the first order of the fake is offline-000001.
    expect(screen.getByText(/Order 000001 · .*6,650\.00/)).toBeOnTheScreen();
    expect(screen.getByText(copy.en['checkout.success.title'])).toBeOnTheScreen();
  });

  it('says it is placing, disabled, until the order comes back', async () => {
    mockOrdersApi.placeOrder.mockImplementation(() => new Promise(() => undefined));
    await addAndRender([P5950]);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(buttonLabel()).toBe(copy.en['checkout.placing']);
    expect(screen.getByTestId(testIds.checkout.button)).toBeDisabled();
    expect(getCartState().ids).toEqual([P5950]);
  });

  it('drops the confirmation once something new goes into the cart', async () => {
    await addAndRender([P5950]);
    await pressNative(testIds.checkout.button);
    await settle();
    expect(screen.getByTestId(testIds.checkout.success)).toBeOnTheScreen();

    cartActions.add(P350);
    await settle();
    expect(screen.queryByTestId(testIds.checkout.success)).toBeNull();
  });
});

describe('what the order removes from the cart', () => {
  it('keeps what was added while the order was in flight', async () => {
    let finish: () => void = () => undefined;
    const real = createFakeOrdersApi({ delayMs: 0 });
    mockOrdersApi.placeOrder.mockImplementation(async (lines, requestId) => {
      const order = await real.placeOrder(lines as Parameters<typeof real.placeOrder>[0], requestId);
      return new Promise<OrderSummary>((resolve) => {
        finish = () => resolve(order);
      });
    });
    await addAndRender([P5950]);

    await pressNative(testIds.checkout.button);
    await settle();
    // While pending: one more of the ordered product and a new product.
    cartActions.add(P5950);
    cartActions.add(P350);
    await settle();

    await act(async () => finish());
    await settle();

    const { ids, byId, lastRemoved } = getCartState();
    expect(ids).toEqual([P5950, P350]);
    expect(byId[P5950]?.qty).toBe(1);
    expect(byId[P350]?.qty).toBe(1);
    // Nothing was deleted by hand, so no undo is offered.
    expect(lastRemoved).toBeNull();
  });
});

describe('the request id', () => {
  const requestIds = () => mockOrdersApi.placeOrder.mock.calls.map(([, requestId]) => requestId);

  it('is reused when the same cart is retried after a failure', async () => {
    mockOrdersApi.placeOrder.mockRejectedValueOnce(new TypeError('Network request failed'));
    await addAndRender([P5950]);

    await pressNative(testIds.checkout.button);
    await settle();
    expect(screen.getByTestId(testIds.checkout.error)).toBeOnTheScreen();
    await pressNative(testIds.checkout.button);
    await settle();

    const [first, retry] = requestIds();
    expect(retry).toBe(first);
    expect(getCartState().ids).toEqual([]);
  });

  it('is fresh when the cart changed after a failure, and for the next order', async () => {
    mockOrdersApi.placeOrder.mockRejectedValueOnce(new TypeError('Network request failed'));
    await addAndRender([P5950]);

    await pressNative(testIds.checkout.button);
    await settle();
    cartActions.add(P350);
    await settle();
    await pressNative(testIds.checkout.button); // changed cart: new id, succeeds
    await settle();
    cartActions.add(P5950);
    await settle();
    await pressNative(testIds.checkout.button); // next order: new id
    await settle();

    const ids = requestIds();
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('a refused order', () => {
  it('names the out-of-stock product and keeps the cart', async () => {
    mockOrdersApi.placeOrder.mockRejectedValue(new CheckoutFailure({ kind: 'outOfStock', productId: P350 }));
    await addAndRender([P5950, P350]);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(screen.getByTestId(testIds.checkout.error)).toHaveTextContent(
      copy.en['checkout.error.outOfStock'].replace('{name}', product(P350).name),
    );
    expect(getCartState().ids).toEqual([P5950, P350]);
    expect(screen.queryByTestId(testIds.checkout.success)).toBeNull();
    expect(buttonLabel()).toBe(copy.en['checkout.placeOrder']);
  });

  it('names it in Arabic on the Arabic layout', async () => {
    mockOrdersApi.placeOrder.mockRejectedValue(new CheckoutFailure({ kind: 'outOfStock', productId: P350 }));
    await addAndRender([P350], 'ar');
    expect(buttonLabel()).toBe(copy.ar['checkout.placeOrder']);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(screen.getByTestId(testIds.checkout.error)).toHaveTextContent(
      copy.ar['checkout.error.outOfStock'].replace('{name}', product(P350).nameAr),
    );
  });

  it('shows the generic message for a network failure', async () => {
    mockOrdersApi.placeOrder.mockRejectedValue(new TypeError('Network request failed'));
    await addAndRender([P5950]);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(screen.getByTestId(testIds.checkout.error)).toHaveTextContent(copy.en['checkout.error.generic']);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out on this phone when the server says the session is gone', async () => {
    mockOrdersApi.kind = 'supabase';
    setSession({ status: 'signedIn', email: 'test@example.test', userId: 'user-1' });
    mockOrdersApi.placeOrder.mockRejectedValue(new CheckoutFailure({ kind: 'signedOut' }));
    await addAndRender([P5950]);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(getCartState().ids).toEqual([P5950]);
  });
});

describe('the sign-in gate (Supabase build)', () => {
  it('signed out: asks to sign in and opens the Account tab instead of ordering', async () => {
    mockOrdersApi.kind = 'supabase';
    setSession({ status: 'signedOut', email: null, userId: null });
    await addAndRender([P5950]);
    expect(buttonLabel()).toBe(copy.en['checkout.signInFirst']);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(mockNavigate).toHaveBeenCalledWith('/account');
    expect(mockOrdersApi.placeOrder).not.toHaveBeenCalled();
    expect(getCartState().ids).toEqual([P5950]);
  });

  it('while the stored session loads, the button waits disabled', async () => {
    mockOrdersApi.kind = 'supabase';
    setSession({ status: 'loading', email: null, userId: null });
    await addAndRender([P5950]);

    expect(screen.getByTestId(testIds.checkout.button)).toBeDisabled();
  });

  it('signed in: places the order', async () => {
    mockOrdersApi.kind = 'supabase';
    setSession({ status: 'signedIn', email: 'test@example.test', userId: 'user-1' });
    await addAndRender([P5950]);
    expect(buttonLabel()).toBe(copy.en['checkout.placeOrder']);

    await pressNative(testIds.checkout.button);
    await settle();

    expect(mockOrdersApi.placeOrder).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(testIds.checkout.success)).toBeOnTheScreen();
  });
});
