# FAKE BACKEND SPEC (D-01…D-08)

## Generator (`src/core/catalog/`)
- PRNG: **mulberry32(seed=20261116)** — never `Math.random()` anywhere in catalog/api code paths that must be deterministic.
- Ids `p-0001…p-1000`. Category = `categories[(i-1) % 8]` shuffled once with the seeded RNG so neighbours differ (grid looks varied, still deterministic). Exactly 125 per category.
- Each category has ≥ 12 **name templates** (EN+AR) × brand pool × variant pool (size/strength/pack). Names are composed, e.g. `${brand} ${type} ${variantEn}` / `${brandAr} ${typeAr} ${variantAr}` — see `docs/fixtures/catalog-seed.json`. Fictional brands only. No duplicates of full `name` within a category (retry/vary with seeded pick).
- Price (SAR, 2 decimals): category band, e.g. Vitamins 24.95–189.00, Skincare 29.00–259.00, Baby care 12.50–149.00, Personal care 8.95–99.00, Medicines (OTC) 5.50–79.00, Hair care 15.00–139.00, Fitness 39.00–349.00, Fragrance 79.00–689.00. Prices end in .00/.50/.95/.99 weighted.
- `oldPrice`: ~35 % of products, 10–40 % above price; UI shows discount % = `round((1−price/oldPrice)*100)`.
- `rating` 3.4–4.9 (1 decimal, skewed up), `reviews` 0–2 400 (log-skewed), `inStock` ~92 % true.
- `images`: 3 per product: `https://picsum.photos/seed/${id}-${n}/${w}/${h}` n∈{1,2,3}. **Helper `imageUri(id,n,displayPx)`** buckets `w=h` to {160,240,320,480,640,800} ≥ displayPx×DPR (cap 800 for hero). Never request 800 for a tile.
- Extra deterministic fields (beyond the core shape, harmless): `blurhash`/`dominantColor` derived from seed for placeholders; `descriptionEn/Ar`; `sku`. Keep the core shape intact: the Supabase `products` table mirrors it.
- Bestsellers: deterministic subset (top 12 by seeded score) for Home.

## Fake API (`src/core/api/fakeApi.ts`)
```ts
getProductsPage({ page, pageSize = 20, category?, sort?, filters? }): Promise<{ items: Product[]; page: number; hasMore: boolean; total: number }>
getBestSellers(): Promise<Product[]>   // same latency/failure rules
getBanners(): Promise<Banner[]>        // static, still goes through delay (no failure) 
getCategories(): Promise<Category[]>   // static, instant
getProductById(id): Promise<Product>   // delay + failure rules (product page can show error state)
```
- Delay: `300 + rng() * 500` ms (seeded **separate** stream so catalog determinism is unaffected).
- Failure: ~1 in 20 requests: implement as a counter-based deterministic pattern in tests (`failEvery: 20`, offset configurable) and a randomised one at runtime (`p = 0.05`) via an injectable `chaos` option. Failed requests reject with `FakeNetworkError` (typed) → UI maps to friendly EN/AR copy. The runtime failure stream is seeded per launch (`failureSeed`, ADR-048), so which request fails changes between launches while the products never do.
- Filters/sort operate over the full 1,000 dataset *in the fake service* (so pagination remains honest): sort = relevance(default id order) / price asc / price desc / rating / discount; filters = categories (multi), price range, in-stock only, rating ≥ 4. Total reflects filtered count.
- TanStack Query: `retry: 0` for pages (we show our own retry UI so the failure is visible), `staleTime: Infinity` (dataset is static), `gcTime` long, `placeholderData: keepPreviousData` when filters change.

## Prefetch strategy (protects F-01 fling test)
`onEndReachedThreshold` ≈ 2.0 screens **and** an explicit prefetch when `index > loadedCount − 40`; after the first page loads, background-prefetch pages 2–5 on idle (`InteractionManager.runAfterInteractions`). For the *measurement protocol*, pre-warm by flinging to the bottom once (all 50 pages cached) before the measured run — documented honestly in README (the fake service is intentionally slow; prefetch is the engineering answer, not a trick). Also report the cold (un-warmed) run if numbers differ.

## Test hooks
`createFakeApi({ seed, delayMs: [0,0], failEvery })` for Jest (no timers pain); `__DEV__` knob to force failure/slow mode for demo (hidden dev menu via long-press title — dev only, stripped in release).
