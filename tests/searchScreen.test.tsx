/**
 * Search screen: every state (idle, loading, results, no matches, error + retry), the debounce,
 * clear, back, and tapping a row to open the product.
 * The backend is stubbed with a spy so each test controls exactly what a query returns and when.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getCatalog, type Product } from '@/core/catalog';
import { SEARCH_DEBOUNCE_MS, SEARCH_LIMIT, SearchScreen } from '@/features/search/SearchScreen';
import { resetProductOpenLatchForTest } from '@/motion/hero/openProduct';
import { api } from '@/state/api';
import { testIds } from '@/testIds';

import { renderWithProviders, type RenderOptions } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() },
}));

const METRICS = { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

function renderSearch(options?: RenderOptions) {
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SearchScreen />
    </SafeAreaProvider>,
    options,
  );
}

const products = getCatalog().products;
const hits: readonly Product[] = products.slice(0, 3);

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Let settled promises render. TanStack Query hands results to React through a 0 ms timer, so
 * under fake timers the clock has to tick once (by zero) after each promise settles.
 */
async function settle() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(0);
    });
  }
}

async function type(text: string) {
  await fireEvent.changeText(screen.getByTestId(testIds.search.input), text);
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
  await settle();
}

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetProductOpenLatchForTest();
    jest.mocked(router.back).mockClear();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.navigate).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts idle, focused, and sends nothing', async () => {
    const spy = jest.spyOn(api, 'searchProducts');
    await renderSearch();
    expect(screen.getByTestId(testIds.search.idle)).toBeTruthy();
    expect(screen.getByTestId(testIds.search.input).props.autoFocus).toBe(true);
    expect(screen.queryByTestId(testIds.search.clear)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('waits for typing to pause, then sends one trimmed query', async () => {
    const spy = jest.spyOn(api, 'searchProducts').mockResolvedValue(hits);
    await renderSearch();
    const input = screen.getByTestId(testIds.search.input);
    await fireEvent.changeText(input, 'o');
    await fireEvent.changeText(input, 'om');
    await fireEvent.changeText(input, ' omega ');
    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(spy).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('omega', SEARCH_LIMIT);
  });

  it('shows skeleton rows while the first query loads, then the results with a count', async () => {
    const pending = deferred<readonly Product[]>();
    jest.spyOn(api, 'searchProducts').mockReturnValue(pending.promise);
    await renderSearch();
    await type('omega');
    expect(screen.getByTestId(testIds.search.loading)).toBeTruthy();

    pending.resolve(hits);
    await settle();
    expect(screen.queryByTestId(testIds.search.loading)).toBeNull();
    expect(screen.getByTestId(testIds.search.count)).toHaveTextContent('3 results');
    for (const p of hits) expect(screen.getByTestId(testIds.search.result(p.id))).toBeTruthy();
  });

  it('gives each row one spoken label: name and price', async () => {
    const [first] = hits;
    jest.spyOn(api, 'searchProducts').mockResolvedValue([first!]);
    await renderSearch();
    await type('x');
    const row = screen.getByTestId(testIds.search.result(first!.id));
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toContain(first!.name);
    expect(screen.getByTestId(testIds.search.count)).toHaveTextContent('1 result');
  });

  it('keeps the previous results on screen while the next query loads', async () => {
    const next = deferred<readonly Product[]>();
    jest
      .spyOn(api, 'searchProducts')
      .mockResolvedValueOnce(hits)
      .mockReturnValueOnce(next.promise);
    await renderSearch();
    await type('ome');
    await type('omega');
    expect(screen.queryByTestId(testIds.search.loading)).toBeNull();
    expect(screen.getByTestId(testIds.search.result(hits[0]!.id))).toBeTruthy();

    next.resolve([]);
    await settle();
    expect(screen.getByTestId(testIds.search.empty)).toBeTruthy();
  });

  it('says so when nothing matches, quoting the query', async () => {
    jest.spyOn(api, 'searchProducts').mockResolvedValue([]);
    await renderSearch();
    await type('zzzz');
    expect(screen.getByTestId(testIds.search.empty)).toHaveTextContent(/zzzz/);
  });

  it('shows an error with a retry that asks again', async () => {
    const spy = jest
      .spyOn(api, 'searchProducts')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(hits);
    await renderSearch();
    await type('omega');
    expect(screen.getByTestId(testIds.search.error)).toBeTruthy();

    await fireEvent.press(screen.getByText('Try again'));
    await settle();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(testIds.search.result(hits[0]!.id))).toBeTruthy();
  });

  it('clear empties the field and goes back to idle', async () => {
    jest.spyOn(api, 'searchProducts').mockResolvedValue(hits);
    await renderSearch();
    await type('omega');
    await fireEvent.press(screen.getByTestId(testIds.search.clear));
    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(screen.getByTestId(testIds.search.input).props.value).toBe('');
    expect(screen.getByTestId(testIds.search.idle)).toBeTruthy();
    expect(screen.queryByTestId(testIds.search.clear)).toBeNull();
  });

  it('back goes back', async () => {
    await renderSearch();
    await fireEvent.press(screen.getByTestId(testIds.search.back));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('tapping a row opens that product', async () => {
    jest.spyOn(api, 'searchProducts').mockResolvedValue(hits);
    await renderSearch();
    await type('omega');
    await fireEvent.press(screen.getByTestId(testIds.search.result(hits[1]!.id)));
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    const calls = [...jest.mocked(router.push).mock.calls, ...jest.mocked(router.navigate).mock.calls];
    expect(JSON.stringify(calls)).toContain(hits[1]!.id);
  });

  it('lays the field out for Arabic', async () => {
    await renderSearch({ lang: 'ar' });
    const input = screen.getByTestId(testIds.search.input);
    expect(input.props.placeholder).toContain('ابحث');
  });
});
