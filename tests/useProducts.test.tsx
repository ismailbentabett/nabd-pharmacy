/**
 * The Category grid's data hook (C-01, D-03, D-05): pages of 20 appended in order, a failed page
 * that keeps what is loaded and waits for retry, a failed first page, and no requests past the end.
 * Each test gets its own fake API with no random delay or failure, so the outcome is fixed.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createFakeApi, type ProductQuery } from '@/core/api/fakeApi';
import { getCatalog } from '@/core/catalog';
import { useProducts } from '@/features/category/useProducts';

import { queryWrapper } from './helpers/category';

describe('useProducts', () => {
  it('loads pages of 20 and appends the next page without replacing the first', async () => {
    const source = createFakeApi({ delayMs: [0, 0], chaos: 0 });
    const { result } = await renderHook(() => useProducts({}, source), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.firstPage).toBe('ready'));
    expect(result.current.items).toHaveLength(20);
    expect(result.current.total).toBe(1000);
    const firstPage = result.current.items;

    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(40));
    expect(result.current.items.slice(0, 20)).toEqual(firstPage);
    expect(new Set(result.current.items.map((p) => p.id)).size).toBe(40);
  });

  it('keeps loaded products when the next page fails, waits for retry, then fetches only that page', async () => {
    // Request 1 (first page) succeeds, request 2 (second page) fails, request 3 (the retry) succeeds.
    const source = createFakeApi({ delayMs: [0, 0], failEvery: 2 });
    const calls = jest.spyOn(source, 'getProductsPage');
    const { result } = await renderHook(() => useProducts({}, source), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.firstPage).toBe('ready'));

    await act(async () => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.nextPageError).toBe(true));
    expect(result.current.items).toHaveLength(20);
    expect(result.current.firstPage).toBe('ready');

    // Reaching the end again does not start a request loop on a failing network.
    await act(async () => result.current.fetchNextPage());
    expect(calls).toHaveBeenCalledTimes(2);

    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.items).toHaveLength(40));
    expect(result.current.nextPageError).toBe(false);
    expect(calls.mock.calls.map(([request]) => request.page)).toEqual([0, 1, 1]);
  });

  it('reports a failed first page as an error and recovers on retry', async () => {
    const source = createFakeApi({ delayMs: [0, 0], chaos: 0 });
    source.debug.forceFailure = true;
    const { result } = await renderHook(() => useProducts({}, source), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.firstPage).toBe('error'));
    expect(result.current.items).toHaveLength(0);

    source.debug.forceFailure = false;
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.firstPage).toBe('ready'));
    expect(result.current.items).toHaveLength(20);
  });

  it('stops asking once the last page is in', async () => {
    const prices = getCatalog()
      .products.map((p) => p.price)
      .sort((a, b) => b - a);
    const query: ProductQuery = { filters: { priceMin: prices[4] } };
    const source = createFakeApi({ delayMs: [0, 0], chaos: 0 });
    const calls = jest.spyOn(source, 'getProductsPage');
    const { result } = await renderHook(() => useProducts(query, source), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.firstPage).toBe('ready'));
    expect(result.current.total).toBe(source.countProducts(query));
    expect(result.current.hasNextPage).toBe(false);

    await act(async () => result.current.fetchNextPage());
    expect(calls).toHaveBeenCalledTimes(1);
  });
});
