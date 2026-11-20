/**
 * Account tab: every session state, the email → code sign-in, and what signing in and out does
 * to favourites. Supabase is replaced by a fake client whose auth calls are `jest.fn`s, so each
 * test decides exactly what the server answers.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getCatalog } from '@/core/catalog';
import { AccountScreen } from '@/features/account/AccountScreen';
import { applySession, isValidCode, isValidEmail } from '@/features/account/auth';
import { favoriteActions, getFavoritesState } from '@/state/favorites.store';
import { ORDERS_QUERY_KEY } from '@/state/orders';
import { queryClient } from '@/state/queryClient';
import { getSession, OFFLINE_SESSION, setSession } from '@/state/session.store';
import { testIds } from '@/testIds';

import { renderWithProviders, type RenderOptions } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() },
}));
// Owned by the orders feature; stubbed so these tests only exercise the account code.
// The stub leaves a marker so the tests can still check where the section is mounted.
jest.mock('@/features/orders/OrdersSection', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { OrdersSection: () => <View testID="orders-section-stub" /> };
});

type Result = { data: unknown; error: { message: string } | null };

/** A thenable query builder: every chain method returns itself, awaiting it gives `result`. */
type QueryStub = {
  select: jest.Mock<QueryStub, []>;
  eq: jest.Mock<QueryStub, []>;
  upsert: jest.Mock<QueryStub, []>;
  delete: jest.Mock<QueryStub, []>;
  then: (resolve: (r: Result) => unknown) => Promise<unknown>;
};

function queryStub(result: Result): QueryStub {
  const q: QueryStub = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    upsert: jest.fn(() => q),
    delete: jest.fn(() => q),
    then: (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return q;
}

function makeClient(serverFavorites: string[] = []) {
  return {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
      verifyOtp: jest.fn(async () => ({ data: { session: null }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
    },
    from: jest.fn((_table: string) => queryStub({ data: serverFavorites.map((product_id) => ({ product_id })), error: null })),
  };
}

let mockClient: ReturnType<typeof makeClient> | null = null;

jest.mock('@/core/supabase/client', () => ({
  getSupabase: () => mockClient,
  isSupabaseConfigured: () => mockClient !== null,
}));

const METRICS = { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

function renderAccount(options?: RenderOptions) {
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AccountScreen />
    </SafeAreaProvider>,
    options,
  );
}

const SIGNED_OUT = { status: 'signedOut', email: null, userId: null } as const;
const products = getCatalog().products;

function fakeSession(email: string, id = 'user-1') {
  // Only the fields applySession reads; the cast keeps the test free of supabase-js internals.
  return { user: { id, email } } as unknown as Parameters<typeof applySession>[1];
}

beforeEach(() => {
  mockClient = makeClient();
  favoriteActions.setRemote(null);
  favoriteActions.clear();
  favoriteActions.claimFor(null); // the app store persists between tests: start owned by nobody
  setSession(SIGNED_OUT);
});

afterEach(() => {
  queryClient.clear();
});

describe('validation helpers', () => {
  it('accepts a normal address and rejects obvious typos', () => {
    expect(isValidEmail('  sara@example.com ')).toBe(true);
    expect(isValidEmail('sara@example')).toBe(false);
    expect(isValidEmail('sara example.com')).toBe(false);
  });

  it('wants exactly six digits', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
  });
});

describe('AccountScreen', () => {
  it('offline build: explains that sign-in is unavailable and names the fake backend', async () => {
    setSession(OFFLINE_SESSION);
    await renderAccount();
    expect(screen.getByTestId(testIds.account.offline)).toBeTruthy();
    expect(screen.getByTestId(testIds.account.backend)).toHaveTextContent(/demo|fake|local/i);
    expect(screen.queryByTestId(testIds.account.email)).toBeNull();
  });

  it('offline build: still shows local favourites and the in-memory order history', async () => {
    setSession(OFFLINE_SESSION);
    favoriteActions.set(products[0]!.id, true);
    await renderAccount();
    expect(screen.getByTestId(testIds.account.favorites)).toBeTruthy();
    expect(screen.getByTestId('orders-section-stub')).toBeTruthy();
    favoriteActions.clear();
  });

  it('loading: shows the skeleton, not the form', async () => {
    setSession({ status: 'loading', email: null, userId: null });
    await renderAccount();
    // The skeleton is hidden from screen readers on purpose, so the query has to opt in to see it.
    expect(screen.getByTestId(testIds.account.loading, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId(testIds.account.loading)).toBeNull();
    expect(screen.queryByTestId(testIds.account.email)).toBeNull();
    expect(screen.queryByTestId(testIds.account.signedIn)).toBeNull();
  });

  it('rejects an invalid email without calling the server', async () => {
    await renderAccount();
    await fireEvent.changeText(screen.getByTestId(testIds.account.email), 'not-an-email');
    await fireEvent.press(screen.getByTestId(testIds.account.sendCode));
    expect(screen.getByTestId(testIds.account.error)).toHaveTextContent('Enter a valid email address.');
    expect(mockClient!.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends a code and moves to the code step', async () => {
    await renderAccount();
    await fireEvent.changeText(screen.getByTestId(testIds.account.email), 'sara@example.com');
    await fireEvent.press(screen.getByTestId(testIds.account.sendCode));
    expect(mockClient!.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'sara@example.com',
      options: { shouldCreateUser: true },
    });
    expect(await screen.findByTestId(testIds.account.code)).toBeTruthy();
    expect(screen.getByText(/sara@example\.com/)).toBeTruthy();

    // Change email goes back to step one.
    await fireEvent.press(screen.getByTestId(testIds.account.changeEmail));
    expect(screen.getByTestId(testIds.account.email)).toBeTruthy();
  });

  it('shows an error line when the code is wrong and stays signed out', async () => {
    mockClient!.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Token has expired or is invalid' },
    } as never);
    await renderAccount();
    await fireEvent.changeText(screen.getByTestId(testIds.account.email), 'sara@example.com');
    await fireEvent.press(screen.getByTestId(testIds.account.sendCode));
    // Non-digits are stripped as they are typed.
    await fireEvent.changeText(await screen.findByTestId(testIds.account.code), '12a3456');
    await fireEvent.press(screen.getByTestId(testIds.account.verify));
    expect(mockClient!.auth.verifyOtp).toHaveBeenCalledWith({ email: 'sara@example.com', token: '123456', type: 'email' });
    expect(await screen.findByTestId(testIds.account.error)).toHaveTextContent(/did not work/);
    expect(getSession().status).toBe('signedOut');
  });

  it('a correct code signs in and merges the server favourites into the list', async () => {
    const [a, b] = [products[0]!.id, products[1]!.id];
    mockClient = makeClient([b]);
    favoriteActions.toggle(a); // a local favourite from before sign-in
    mockClient.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: fakeSession('sara@example.com') },
      error: null,
    } as never);
    await renderAccount();
    await fireEvent.changeText(screen.getByTestId(testIds.account.email), 'sara@example.com');
    await fireEvent.press(screen.getByTestId(testIds.account.sendCode));
    await fireEvent.changeText(await screen.findByTestId(testIds.account.code), '123456');
    await fireEvent.press(screen.getByTestId(testIds.account.verify));

    expect(await screen.findByTestId(testIds.account.signedIn)).toBeTruthy();
    expect(screen.getByText('Signed in as sara@example.com')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId(testIds.account.favorite(b))).toBeTruthy());
    expect(screen.getByTestId(testIds.account.favorite(a))).toBeTruthy();
    // The local-only id was pushed to the server through the remote.
    const tablesUsed = mockClient.from.mock.calls.map((call) => call[0]);
    expect(tablesUsed.length).toBeGreaterThan(0);
    expect(tablesUsed.every((t) => t === 'favorites')).toBe(true);
    expect(mockClient.from.mock.results.some((r) => (r.value as QueryStub).upsert.mock.calls.length > 0)).toBe(true);
  });

  it('signed in with no favourites shows the empty state', async () => {
    await act(async () => applySession(mockClient as never, fakeSession('sara@example.com')));
    await renderAccount();
    expect(screen.getByTestId(testIds.account.signedIn)).toBeTruthy();
    expect(await screen.findByTestId(testIds.account.favoritesEmpty)).toBeTruthy();
  });

  it('sign out returns to the form and clears this device’s favourites', async () => {
    const id = products[2]!.id;
    await act(async () => applySession(mockClient as never, fakeSession('sara@example.com')));
    await act(async () => {
      favoriteActions.toggle(id);
    });
    await renderAccount();
    expect(screen.getByTestId(testIds.account.favorite(id))).toBeTruthy();

    await fireEvent.press(screen.getByTestId(testIds.account.signOut));
    expect(mockClient!.auth.signOut).toHaveBeenCalled();
    expect(await screen.findByTestId(testIds.account.email)).toBeTruthy();
    expect(getFavoritesState().ids).toEqual([]);
    expect(getSession()).toEqual(SIGNED_OUT);
  });

  it('falls back to a local sign-out when the global one fails (offline phone)', async () => {
    mockClient!.auth.signOut
      .mockResolvedValueOnce({ error: { message: 'network' } } as never)
      .mockResolvedValueOnce({ error: null } as never);
    await act(async () => applySession(mockClient as never, fakeSession('sara@example.com')));
    await renderAccount();
    await fireEvent.press(screen.getByTestId(testIds.account.signOut));
    expect(mockClient!.auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    expect(await screen.findByTestId(testIds.account.email)).toBeTruthy();
  });

  it('Arabic (RTL) signed out: Arabic error copy', async () => {
    await renderAccount({ lang: 'ar' });
    await fireEvent.press(screen.getByTestId(testIds.account.sendCode));
    expect(screen.getByTestId(testIds.account.error)).toHaveTextContent('أدخل بريدًا إلكترونيًا صحيحًا.');
  });

  it('Arabic (RTL) signed in: email and Arabic sign-out label', async () => {
    await act(async () => applySession(mockClient as never, fakeSession('sara@example.com')));
    await renderAccount({ lang: 'ar' });
    expect(screen.getByTestId(testIds.account.signedIn)).toHaveTextContent(/sara@example\.com/);
    expect(screen.getByTestId(testIds.account.signOut)).toHaveTextContent(/[؀-ۿ]/);
  });
});

describe('who owns this device’s favourites and orders', () => {
  const ordersKey = (userId: string) => [...ORDERS_QUERY_KEY, userId];

  it('cold start with the last user’s list saved, whose session is gone: the list is wiped', async () => {
    const id = products[3]!.id;
    favoriteActions.claimFor('user-a');
    favoriteActions.toggle(id);
    // What initAuth does on launch: loading, then the stored session turns out to be empty.
    setSession({ status: 'loading', email: null, userId: null });
    await act(async () => applySession(mockClient as never, null));
    expect(getFavoritesState().ids).toEqual([]);
    expect(getSession()).toEqual(SIGNED_OUT);
  });

  it('user A then user B: B starts without A’s favourites or A’s cached orders', async () => {
    const id = products[4]!.id;
    await act(async () => applySession(mockClient as never, fakeSession('a@example.com', 'user-a')));
    favoriteActions.toggle(id);
    queryClient.setQueryData(ordersKey('user-a'), []);
    await act(async () => applySession(mockClient as never, fakeSession('b@example.com', 'user-b')));
    expect(getFavoritesState().ids).toEqual([]);
    expect(queryClient.getQueryData(ordersKey('user-a'))).toBeUndefined();
  });

  it('signed-out hearts survive sign-in; the same user after a restart keeps them', async () => {
    const id = products[5]!.id;
    favoriteActions.toggle(id);
    await act(async () => applySession(mockClient as never, fakeSession('a@example.com', 'user-a')));
    expect(getFavoritesState().ids).toEqual([id]);
    // A restart: the session store starts over, the saved list and owner do not.
    setSession({ status: 'loading', email: null, userId: null });
    await act(async () => applySession(mockClient as never, fakeSession('a@example.com', 'user-a')));
    expect(getFavoritesState().ids).toEqual([id]);
  });

  it('sign-out drops the cached order history; a token refresh does not', async () => {
    await act(async () => applySession(mockClient as never, fakeSession('a@example.com', 'user-a')));
    queryClient.setQueryData(ordersKey('user-a'), []);
    await act(async () => applySession(mockClient as never, fakeSession('a@example.com', 'user-a')));
    expect(queryClient.getQueryData(ordersKey('user-a'))).toEqual([]);
    await act(async () => applySession(mockClient as never, null));
    expect(queryClient.getQueryData(ordersKey('user-a'))).toBeUndefined();
  });
});
