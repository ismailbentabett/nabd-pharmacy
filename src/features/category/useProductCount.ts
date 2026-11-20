/**
 * How many products a filter set matches, for the sheet's "Show 312 products" button.
 *
 * - Offline backend: the catalog is on the device, so `countSync` answers on the same frame as the
 *   tap and React Query is only a cache around it (`initialData`, never a loading state).
 * - Supabase: a `head: true` count request per filter set, cached by the same stable key the grid
 *   uses. While a new count is on its way the previous number stays (`placeholderData`), so the
 *   button label never flashes to "No results" between two taps.
 *
 * `null` means "not known yet" (first Supabase request in flight, or it failed); the sheet then shows
 * a plain "Show results" label instead of guessing a number.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeyOf, type CatalogApi, type ProductFilters } from '@/core/api/types';
import { api } from '@/state/api';

export type CountSource = Pick<CatalogApi, 'fetchCount' | 'countSync'>;

export function useProductCount(filters: ProductFilters, source: CountSource = api): number | null {
  const query = { filters };
  const instant = source.countSync?.(query);
  const { data } = useQuery({
    queryKey: ['count', queryKeyOf(query)],
    queryFn: () => source.fetchCount(query),
    initialData: instant,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  return instant ?? data ?? null;
}
