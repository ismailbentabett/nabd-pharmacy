/**
 * The Category grid's data: pages of 20 products from the fake API (D-03), stitched into one list.
 *
 * Three rules shape this hook:
 * - The first page and the next pages fail differently. With nothing loaded the screen shows a full
 *   error with retry. With products already on screen a failed next page only adds a retry row at
 *   the end, and retry fetches that one page again, so loaded products never disappear.
 * - After a failed page, scrolling does not fetch again by itself. The retry row stays until the
 *   person taps it, so a flaky network cannot start a request loop while they fling.
 * - The query key is `queryKeyOf(query)`, the same stable string the fake API caches on, so the
 *   same filters always hit the same cache entry whatever order they were picked in.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeyOf, type FakeApi, type ProductQuery } from '@/core/api/fakeApi';
import type { Product } from '@/core/catalog';
import { api } from '@/state/api';

/** What the screen draws before the grid: skeletons, a full error, or the grid itself. */
export type FirstPageStatus = 'loading' | 'error' | 'ready';

export type ProductsSource = Pick<FakeApi, 'getProductsPage'>;

export type ProductsResult = {
  /** Every loaded product, in order. Same identity until a page is added. */
  items: readonly Product[];
  /** How many products the whole query matches (0 until the first page arrives). */
  total: number;
  firstPage: FirstPageStatus;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** The last next-page request failed and nothing is retrying it yet. */
  nextPageError: boolean;
  /** Ask for the next page. Safe to call on every end-reached event: it ignores calls it cannot serve. */
  fetchNextPage: () => void;
  /** Retry whatever failed: the first page, or only the next page. */
  retry: () => void;
  /** The cache key for this query, also used to give each query its own grid (fresh scroll position). */
  queryKey: string;
};

const EMPTY: readonly Product[] = [];

export function useProducts(query: ProductQuery, source: ProductsSource = api): ProductsResult {
  const key = queryKeyOf(query);
  const {
    data,
    isError,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['products', key],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => source.getProductsPage({ ...query, page: pageParam }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items = useMemo(() => (data ? data.pages.flatMap((page) => page.items) : EMPTY), [data]);

  // React Query keeps `isFetchNextPageError` true while a retry of that page is running, so the
  // error only counts when nothing is fetching. The footer then shows the loading row, not both.
  const nextPageError = isFetchNextPageError && !isFetchingNextPage;

  const firstPage: FirstPageStatus = data !== undefined ? 'ready' : isError && !isFetching ? 'error' : 'loading';

  const loadMore = () => {
    if (!hasNextPage || isFetchingNextPage || nextPageError) return;
    // cancelRefetch false: a second end-reached event during a fetch joins it instead of restarting it.
    void fetchNextPage({ cancelRefetch: false });
  };

  const retry = () => {
    if (data === undefined) {
      void refetch();
      return;
    }
    // Not `refetch()`: that would fetch every loaded page again. Only the missing page is asked for.
    void fetchNextPage({ cancelRefetch: false });
  };

  return {
    items,
    total: data?.pages[0]?.total ?? 0,
    firstPage,
    hasNextPage,
    isFetchingNextPage,
    nextPageError,
    fetchNextPage: loadMore,
    retry,
    queryKey: key,
  };
}
