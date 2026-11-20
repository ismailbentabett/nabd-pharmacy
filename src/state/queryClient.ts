/**
 * TanStack Query settings for a fake, local backend.
 *
 * - `retry: 0`: the brief wants the 1-in-20 failures to be visible, so a failed page shows its error
 *   and retry row instead of being hidden behind silent retries (D-05).
 * - `staleTime: Infinity`: the catalog never changes while the app runs, so data fetched once is
 *   never fetched again. Scrolling back or reopening a screen does not show a loader twice.
 * - `networkMode: 'always'`: there is no network. Queries must run even when the phone is offline,
 *   instead of pausing until a connection comes back.
 */
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, staleTime: Infinity, networkMode: 'always' },
      mutations: { retry: 0, networkMode: 'always' },
    },
  });
}

export const queryClient = createQueryClient();
