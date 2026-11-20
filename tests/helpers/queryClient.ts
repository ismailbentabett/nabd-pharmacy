/**
 * The app's query client with one change for tests: no garbage-collection timer. TanStack keeps an
 * unmounted query for 5 minutes by default, and that timeout keeps Jest alive after the last test.
 */
import { createQueryClient } from '@/state/queryClient';

export function testQueryClient() {
  const client = createQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, gcTime: Infinity } });
  return client;
}
