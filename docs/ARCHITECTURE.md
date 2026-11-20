# ARCHITECTURE

Principle: **small, boring, explainable**. Every module has one reason to change. The author must be able to redraw this on a whiteboard.

## 1. Folder layout (target)
```
app/                      Expo Router (routes are thin: compose features only)
  _layout.tsx             root: providers, fonts ready gate, ReducedMotionConfig, perf flags import, GestureHandlerRootView
  (tabs)/_layout.tsx      custom animated tab bar (Home, Category, Cart)
  (tabs)/index.tsx        Home
  (tabs)/category.tsx     Category
  (tabs)/cart.tsx         Cart
  product/[id].tsx        Product (transparentModal-style host for hero transition)
src/
  core/                   framework-free + testable
    money.ts              integer centimes, formatDzd(), TVA split (docs/CART_SPEC.md)
    rng.ts                mulberry32
    catalog/              generator (seeded), copy tables (EN/AR), types
    api/                  fakeApi.ts (pages of 20, delay, 1-in-20 failure, deterministic failure option for tests)
  state/
    cart.store.ts         zustand: items by id, add/remove/setQty/undo; pure reducer in cartMath.ts
    favourites.store.ts   (NOT on main — see _prep/LIVE_SESSION_PREP.md)  
    (no prefs store)      the language comes from the native direction (ADR-031); theme override only with W3
  i18n/                   dictionary (en/ar), useT(), useDirection(), formatters, direction switching
  design/                 tokens (colors, spacing, radii, type), useTheme(), Text/Button/Pressable primitives
  motion/                 springs.ts (tokens), motionPreference.tsx (live reduce motion), hero/ (transition engine), haptics.ts
  features/
    home/                 HomeHeader (collapsing), BannerCarousel, CategoryRail, BestSellersRail
    category/             ProductGrid (FlashList), ProductTile, FilterSortSheet, useProducts (infinite query)
    product/              HeroImage, Gallery, AddToCartBar, PriceBlock
    cart/                 CartList, CartRow (swipe + stepper), Summary, UndoToast
  ui/                     BottomSheet, Skeleton, Badge, IconButton, EmptyState, ErrorState, Toast
  perf/                   PerfHud (flag-gated), flags.ts (Reanimated feature flags set once)
assets/ fonts/ images/(local fallback + app icon + splash)
__tests__/ (or colocated *.test.ts)   cart math, reducer, money, fakeApi, i18n parity, catalog determinism
```
Rules: `core/` imports nothing from React Native. `features/*` never import each other (share via `ui/`, `design/`, `state/`).
Routes contain no business logic. No barrel files that cause import cycles.

## 2. State
| Concern | Tool | Why |
|---|---|---|
| Cart | zustand, **selector subscriptions**; `byId` map + ordered `ids` | row re-renders only when its own line changes; badge subscribes to `selectCount` only |
| Server-ish data | TanStack Query `useInfiniteQuery` over fake API | loading/error/retry/refetch for free; `getNextPageParam`; stable `select` flattening |
| Language | derived from `I18nManager.isRTL`, not stored | Android persists the RTL flags itself, so text and layout can never disagree and a failed flip cannot loop (ADR-031) |
| Animation | Reanimated shared values only | never React state |
| Hero transition | module-level shared values + a registry of measured tile rects | UI-thread driven |

Re-render proof (F-05): React DevTools "highlight updates" + `why-did-you-render` is **not** shipped; instead a dev-only render counter in `ProductTile` (stripped in release) and a screenshot in `docs/evidence/`.

## 3. Data flow (Category grid)
`useInfiniteQuery(fakeApi.getPage)` → flatten → `FlashList` (`numColumns=2`, `keyExtractor=id`, `getItemType`, `renderItem` memoized tile) →
tile reads `item` + `isFav` (later) only. Prefetch next page when within ~40 items of end (`onEndReached` + `onEndReachedThreshold≈2`).
Images: `expo-image` `source={uri(sized)}` `recyclingKey={id}` `cachePolicy="memory-disk"` `placeholder={{blurhash}}` `transition={160}`.
Image URL helper buckets sizes (e.g., 200/300/400/600/800) so the cache is hit consistently; request ≤ displayed px × DPR.

## 4. Navigation + hero transition
Tabs: Home / Category / Cart. Product is a stack route over tabs (tab bar hidden or covered). Hero engine (see `.claude/skills/hero-transition`, ADR-004):
1. Tile `onPress` → `measure` source rect on UI thread (`measure()` worklet or `onLayout` cache refreshed on scroll end) → write `{id, rect, uri, radius}` to the registry shared value.
2. Navigate to `product/[id]` with a transparent presentation; the destination mounts with **overlay layer** rendering the *cached* thumbnail at the source rect.
3. `progress` shared value 0→1 via spring (or pan gesture); overlay interpolates `translateX/Y/scale` (+ border radius via `borderRadius` interpolation on the overlay only) from source rect to hero rect; destination content fades/slides in on `progress`.
4. Back = reverse; edge-swipe/vertical-drag drives `progress` by finger, release springs with velocity; any new touch `cancelAnimation`s and takes over (interruptible).
5. Direction-aware: horizontal edge-swipe origin and dismiss direction multiply by `dir`.
6. Reduced motion: cross-fade 120 ms, no translate/scale.
If the spike fails the acceptance criteria, fallback in ADR-004 (library `react-native-screen-transitions` Bounds, else a simplified overlay).

## 5. Motion layer
`src/motion/springs.ts` holds named springs (spatialFast/Default/Slow, effects*) from `docs/DESIGN.md`; no inline magic numbers in components.
Gestures: Gesture Handler 3 hook API; all handlers worklets; JS callbacks only through `scheduleOnRN` and only for discrete events (snap settled, delete confirmed, page changed for a11y announce).

## 6. i18n + direction
`useDirection()` → `{ dir: 1 | -1, isRTL, start: 'left'|'right' }`. One module (`src/i18n/direction.tsx`) owns the direction: Plan B ships (`allowRTL` + `forceRTL` + `reloadAppAsync()`, ADR-005) and the language is derived from the native direction (ADR-031). See the `rtl-first` skill. Dictionary keys are typed; a test asserts EN/AR key parity and that no key is empty.

## 7. Error / empty / loading
Every list/screen has skeleton, empty, error-with-retry states (copy in EN/AR). The fake API's 1-in-20 failure is *expected*: a failed page shows an inline retry row at the list footer (not a full-screen error) and never loses already loaded items.

## 8. Testing strategy
- Unit (Jest): money/TVA vectors from `docs/fixtures/cart-vectors.json`, cart reducer (add, merge, setQty, remove, undo, clamp), formatDzd (EN/AR), catalog determinism (hash of all 1000 ids/prices stable), fakeApi paging/failure (seeded), i18n parity.
- Component (RNTL): CartRow stepper, Summary updates, Undo flow, tile press.
- E2E/perf (Maestro): grid scroll flow, add-to-cart → badge, RTL toggle smoke.
- Manual device checklist: `docs/RTL_CHECKLIST.md` + `docs/PERF_PLAN.md`.

## 9. Build
`expo prebuild` → Android release APK with `expo-build-properties` (R8 minify, shrink resources), native splash, fonts embedded via config plugin, Hermes default. Scripts in `scripts/perf/`. No Expo Go reliance.
