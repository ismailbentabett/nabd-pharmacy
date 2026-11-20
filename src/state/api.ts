/**
 * The backend the app talks to: Supabase when the build has its keys (.env, see .env.example),
 * otherwise the offline fake (docs/FAKE_BACKEND.md: seeded catalog, 300–800 ms delay, about
 * 1 request in 20 failing). Screens only see `CatalogApi`, so they never know which one is live.
 *
 * `fakeApi` is always created: the cart, favourites and the dev menu read product data
 * synchronously from the on-device catalog, which is identical to the seeded database
 * (`npm run supabase:seed` writes supabase/seed.sql from the same generator).
 *
 * `EXPO_PUBLIC_FAKE_API_CHAOS` is inlined by Expo at build time. Unset = the brief's 1-in-20
 * failures; the perf build sets it to 0 (ADR-040). Which requests fail changes per launch (ADR-048).
 */
import { createFakeApi, parseChaos, type FakeApi } from '@/core/api/fakeApi';
import { createSupabaseApi } from '@/core/api/supabaseApi';
import type { CatalogApi } from '@/core/api/types';
import { getSupabase } from '@/core/supabase/client';

export const fakeApi: FakeApi = createFakeApi({
  chaos: parseChaos(process.env.EXPO_PUBLIC_FAKE_API_CHAOS),
  failureSeed: Date.now() >>> 0,
});

const supabase = getSupabase();

export const api: CatalogApi = supabase === null ? fakeApi : createSupabaseApi(supabase);
