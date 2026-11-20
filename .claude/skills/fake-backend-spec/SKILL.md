---
name: fake-backend-spec
description: Spec for the seeded catalog generator and fake API (pages of 20, 300–800 ms delay, ~1/20 failures, sized picsum URLs, prefetch). Load when building data layer or tests.
---
Read `docs/FAKE_BACKEND.md` and `docs/fixtures/catalog-seed.json`. Determinism: mulberry32 seed 20261116 for catalog; separate seeded stream for delay; failures injectable (`failEvery`) for tests, probabilistic 5 % at runtime. Names composed from brand × type × variant, unique per category, EN+AR. Image helper buckets sizes. Page failure shows inline retry, never drops loaded items.
