# PLAN — Nabd (portfolio build)

Nabd (نبض, "pulse") is a bilingual (EN/AR, full RTL) pharmacy shopping app for Android, built with Expo SDK 58.
It began as a four-screen take-home. This plan turns it into a portfolio piece:
1. a new brand
2. a real backend (Supabase)
3. the features a real shop needs
4. a perfection pass
5. honest proof.

The original take-home stays untouched in its own repository. Nabd is a separate project with its own name, mark,
colours, repository and history.

Written 2026-11-20. ADRs: `docs/DECISIONS.md` (ADR-055 onward covers this plan).

## 0. Principles (unchanged from the take-home, because they are why the app feels good)

- Motion runs on the UI thread. It is driven by gestures, can be interrupted, and works in RTL. It also has a reduced-motion variant.
- Numbers are only ever measured, never estimated (`docs/PERF_LOG.md`). Unmeasured means `NOT MEASURED YET`.
- Money is integer centimes (1 DA = 100 centimes), and prices include 19% TVA (ADR-061).
- The app keeps working offline and with no backend at all. The fake API is the fallback, so a reviewer can always run it.
- Every new feature ships with:
  - loading, empty and error states
  - Arabic copy
  - accessibility labels
  - tests where there is logic

## 1. Phase A — Rebrand ✅

| # | Task | Done when |
|---|---|---|
| A1 ✅ | Name **Nabd**, package `com.nabd.pharmacy`, scheme `nabd`, app name EN/AR | `app.config.ts`, strings, splash |
| A2 ✅ | Palette: pine `#0E3B35`, secondary `#17564C`, lime `#C8F169` (fill only), light + dark | `src/design/palette.ts`; `node scripts/contrast.mjs --tokens` all pass |
| A3 ✅ | Mark: lime disc with a pine pulse line; one geometry for the SVG and the launcher icons | `BrandMark.tsx`, `scripts/brand/make-icons.py` |
| A4 ✅ | Token renames (no "navy"/"gold" left), `controlOutline` token for off-state controls (WCAG 1.4.11) | grep clean; ADR-055 |
| A5 ✅ | Contrast gate in `scripts/check.sh` | a failing pair fails the check |

## 2. Phase B — Real backend: Supabase

**Why Supabase:** the Upwork search done for this plan returned about 8 Firebase posts and about 3 Supabase posts for
React Native or Expo work. Firebase is asked for more often. We still picked Supabase, for three reasons:
- it is Postgres with Row Level Security, so the security model can be read as SQL
- the user had already used it
- it is a growing ask.

The README states this honestly (ADR-056).

| # | Task | Files | Done when |
|---|---|---|---|
| B1 | Schema: `categories`, `products`, `banners`, `profiles`, `favorites`, `orders`, `order_items`, `reviews`. Prices are stored as integer centimes (columns keep their `_h` names). | `supabase/migrations/0001_schema.sql` | applies cleanly on a fresh project |
| B2 | RLS: catalog is read-only for `anon`; `favorites`/`orders`/`reviews`/`profiles` are owner-only, through `auth.uid()` | `0002_rls.sql` | every table has RLS on; there is no policy without a check |
| B3 | `place_order(lines jsonb)` RPC, `security definer`. It reprices every line from `products` (the client never sends a price), checks stock, writes the order and its items in one transaction, and returns the order with its TVA split. | `0003_place_order.sql` | a tampered price cannot change the total |
| B4 | Seed generated from the deterministic catalog: the same 1,000 products, ids and prices as the fake API | `scripts/supabase/make-seed.ts` → `supabase/seed.sql` | product `p-0001` is identical in both sources |
| B5 | Client: `createClient` with an MMKV-backed auth storage, configured from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; only the anon key ever ships | `src/core/supabase/client.ts`, `.env.example` | the app builds and runs with or without the keys |
| B6 | `SupabaseApi` implements the same `CatalogApi` interface as the fake API (pages of 20, filters, sort, count, best sellers, banners). `src/state/api.ts` picks the backend at start-up. | `src/core/api/supabaseApi.ts`, `src/state/api.ts` | screens do not know which backend they talk to |
| B7 | Mapping and query-building are pure functions with unit tests (row → `Product`, filters → query plan) | `tests/supabaseApi.test.ts` | green without a network |

**Cut-line B:** if B6 slips, ship B1–B5 plus the order RPC, and keep the catalog on the fake API.

## 3. Phase C — Features (what turns a demo into a shop)

| # | Feature | Motion / craft detail | Done when |
|---|---|---|---|
| C1 | **Favourites**: a heart on the grid tile, the product page and the best-sellers rail, always in sync | Heart pops on a spring with a ring burst and a light haptic. One zustand store keyed by id, so each tile subscribes only to its own boolean (F-05). MMKV persists it; when signed in, favourites sync to Supabase. | toggle on the tile → the product page shows it filled; tests on the store |
| C2 | **Search**: debounced, with recent searches, results grid, and an "no results" state with suggestions | The Home search bar opens it; the field keeps focus; results reuse `ProductTile` and the hero transition | typing filters 1,000 products with no jank; recent searches persist |
| C3 | **Account tab**: language switch, appearance, favourites list, order history, sign in with an email one-time code (Supabase Auth) | 4th tab in `TabBar`, same pill motion | works signed-out (local favourites) and signed-in |
| C4 | **Checkout (demo, no payment)**: the cart's "Place order" calls `place_order` (Supabase) or a local order (fake). A confirmation with an animated pulse check follows. | Button morphs to a spinner, then a pulse-line check is drawn. The cart empties with a layout animation. | the order appears in Account → Orders |
| C5 | **Order history**: list plus detail, with the TVA split per order | Skeletons and an empty state | reads from the same backend as C4 |
| C6 | Product page: "Frequently bought together" rail and rating breakdown (stretch) | reuses rails | — |

**Cut-lines C:** C6 first, then C5's detail screen (list only), then the Supabase sync in C1 (local only).

## 4. Phase D — Perfection pass

- **RTL:** every new screen in both directions, gestures included (`docs/RTL_CHECKLIST.md`).
- **Reduced motion:** every new animation has its fade-only variant.
- **Accessibility:**
  - 48 dp targets
  - labels and roles
  - the heart announces "Saved to favourites" / "Removed from favourites"
  - font scale 1.3 holds.
- **Contrast:** the token gate stays green, including the new colours.
- **Hostile review** (`code-reviewer`), fixing every P0 and P1.
- **Pattern lint:** no `runOnJS`, no per-frame state, no layout props animated.

## 5. Phase E — Proof and ship

- A release APK built on the user's machine (`bash scripts/perf/android-release-build.sh`).
- Measurements on a real phone go into `docs/PERF_LOG.md`, with the device model, OS version and build type.
  Until then the README says **NOT MEASURED YET**.
- README:
  - pitch and screenshots
  - run in under 5 commands (fake backend by default; 3 more steps for Supabase)
  - architecture and decisions
  - AI disclosure.
- Steps only the user can do:
  - create the GitHub repository
  - create the Supabase project and paste its URL and anon key into `.env`
  - run `supabase db push` (or paste the SQL in the dashboard)
  - record the phone video.

Nothing is pushed or published without the user's word.

## 6. Order of work today

1. ✅ A1–A5
2. B1–B3 (SQL)
3. B4 (seed)
4. B5–B7 (client, adapter, tests)
5. C1 favourites
6. C2 search
7. C3 account
8. C4 checkout
9. C5 orders
10. D pass
11. README, CLAUDE.md, AI disclosure
12. checks green
13. local commit
