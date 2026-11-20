# DECISIONS (ADRs)

Format: **Status** (Proposed → Accepted → Superseded) · Context · Decision · Consequences · Verify-by. Never delete; supersede.

> **History note.** ADR-001 to ADR-054 were written while the app was first built against a fixed performance spec. Codes such as F-01 (scroll), F-02 (off-JS-thread motion), F-03 (touch response), F-04 (transitions), F-05 (list re-renders), F-06 (images), F-07 (cold start) and F-08 (memory) are those targets; they live on in `docs/PERF_PLAN.md`. Letters like G-, H-, C-, P-, K-, D- name the original screen requirements (Global, Home, Category, Product, Cart, Data). ADR-055 onward cover the Nabd rebrand, the Supabase backend and the new features.

## ADR-001 Stack: Expo SDK 58 + development builds — *Accepted*
Context: SDK 58 (Oct 2026, RN 0.88) is current stable; New Architecture mandatory; SDK 56 has a Hermes V1 memory regression with worklets/Reanimated (fixed ≥ 57.0.17) that would threaten F-08. Expo Go is not used (limited for SDK 58; native modules/flags).
Decision: SDK 58, `expo run:android --variant release` for all measurements; fallback SDK 57 ≥ 57.0.17. **Never** 56.
Verify-by: `npx expo-doctor` clean; `node -p "require('expo/package.json').version"` starts with `58.`.

## ADR-002 Routing: Expo Router — *Accepted*
Tabs (Home, Category, Cart) + `product/[id]` stack route. Rationale: fastest to a clean structure; typed routes; the brief says "production stack". Risk: transition customisation limits → hero engine owns its overlay (ADR-004). Verify the SDK-58 Router docs (Router has changed vs React Navigation in SDK 56+).

## ADR-003 State: zustand (selectors) + TanStack Query + MMKV — *Accepted*
Cart/prefs in zustand with per-field selectors (rows don't re-render on count change → F-05). Query for fake API. MMKV for persisted prefs/cart (needed for RTL reload path). No Redux, no context-for-hot-state.

## ADR-004 Shared-element transition: custom overlay engine — *Accepted (A, amended); device check pending*
Options: (A) custom measured-rect overlay + shared `progress` + gesture pan (preferred; fully controllable, RTL-aware, interruptible) · (B) `react-native-screen-transitions` Bounds API · (C) Reanimated Shared Element Transitions (still **experimental**; changes layout-animation engine behaviour; rejected).
Spike-1 acceptance: grid→product→back with 3 different tiles (incl. last row, mid-scroll), swipe-back interrupt at 20/50/80 %, RTL, reduced-motion fallback, UI FPS ≥ 58 in release on the real device, no flash when hi-res loads, ≤ 320 ms. Pass → A. Fail on engineering time-box (3 h) → B; fail B → simplified A (no gesture-driven, spring only) and document honestly.
Plan note (2026-11-16, `docs/PLAN.md` §2/§6): recommend A, cap 75 m, drop B from the ladder (A → A-lite → zoom); back = 24 dp start edge + pull-down; hero gets its own spring because `spatialDefault` rests at ≈ 427 ms in simulation (k700 ζ0.9 ≈ 292 ms).
Decision (2026-11-16, autonomous): **A**, built as a tracer bullet inside the real product route (ADR-023), not a throwaway spike. Ladder if it fails its tests or the 75 m cap: A → A-lite (spring only, no gesture-driven back) → plain zoom. Option B is dropped: it adds a dependency we would have to explain and that owns our transitions. The hero uses the `hero` spring (ADR-030). The device criteria above (UI FPS, interrupt at 20/50/80 %) can only be checked on a phone, so they are in `docs/HUMAN_TODO.md`.

## ADR-005 RTL strategy — *Accepted (Plan B); device check pending*
Plan A: instant flip without reload (Yoga `direction` on root + `DirectionContext`; all gesture math via `dir`). Plan B: `I18nManager.allowRTL/forceRTL` + persisted state (MMKV: locale, cart, tab, scroll anchors where cheap) + `Updates.reloadAsync()`; show a 250 ms fade veil so it reads as intentional.
Spike-2 acceptance (Android release): toggle flips layout, tab order, FlashList 2-col grid order, horizontal rails, carousel, sheet, swipe-to-delete direction, hero swipe; no text clipping; no stale LTR (check after navigating back/forward). Whichever passes fully ships; if A is flaky choose B. In **both**, components only use `useDirection()`.
Plan note (2026-11-16, `docs/PLAN.md` §2/§6): recommend Plan B only, using `reloadAppAsync()` from `expo` (`Updates.reloadAsync()` rejects in dev; keep it as the release fallback); commit any pending undo and persist locale + cart before reloading.
Decision (2026-11-16, autonomous): **Plan B**. Reason: native RTL is what flips Yoga, FlashList horizontal order (`RecyclerView.js` reads `I18nManager.isRTL`), the system back gesture and text alignment all at once, and it is the path RN supports. Plan A would need every one of those patched by hand. Sequence on toggle: commit pending undo → persist locale + cart to MMKV → `I18nManager.allowRTL/forceRTL` → 250 ms navy veil → `reloadAppAsync()` from `expo` (verified to call `reactDelegate.reload()`, works in debug and release; `expo-updates` is removed, ADR-026). `I18nManager` is read only in `src/i18n/`. Locale and cart are read synchronously from MMKV before first render, so the app comes back exactly where it was.

## ADR-006 Motion tokens — *Accepted (values tuned on device, then frozen)*
Springs per `docs/DESIGN.md` §6. After tuning, record the final numbers here: `spatialFast=…, spatialDefault=…, …` (TBD by motion-engineer on device).

## ADR-007 Lists: FlashList v2 for grid/rails; ScrollView+map for Cart — *Accepted*
Grid/rails = FlashList (virtualised, recycling, `getItemType`). Cart = plain ScrollView/`Animated` map with stable keys so Reanimated layout animations (`entering/exiting/layout`) work; cart is small. **Never** layout animations in FlashList items.

## ADR-008 Images — *Accepted*
`expo-image` (memory-disk cache, `recyclingKey`, placeholder blurhash, `transition` only on first load), sized picsum URLs bucketed to {160,240,320,480,640,800}; hero uses 800 with tile image as placeholder; `Image.prefetch` for first 2 pages + next-page images 1 page ahead.

## ADR-009 Fonts: embed via `expo-font` config plugin (IBM Plex Sans + Arabic) — *Accepted*
No async font loading → no FOUT, faster TTI. Subset weights 400/500/600 only.

## ADR-010 Icons: lucide-react-native + react-native-svg — *Accepted*
One style/stroke (1.75). No emoji, no icon fonts. Mirror directional icons in RTL.

## ADR-011 i18n: tiny typed dictionary — *Accepted*
No i18next (bundle/time + the need to explain it live). `t('cart.total')` typed keys; parity test; plural helper only for Arabic dual/plural if copy needs it (count labels).

## ADR-012 Perf flags — *Proposed, decided by measurement*
Candidates: `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`, `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`, `DISABLE_COMMIT_PAUSING_MECHANISM` (+ RN `preventShadowTreeCommitExhaustion`). Enable one at a time in release; keep only those with measured benefit (record before/after in `docs/PERF_LOG.md`). Defaults otherwise.

## ADR-013 React Compiler on — *Accepted*
Default in SDK 54+; keep lint rules; do not add manual `useMemo/useCallback` unless profiler shows need (explain in walkthrough: compiler memoises; shared values are stable refs).

## ADR-014 Favourite heart is NOT on `main` — *Accepted*
The follow-up's live change. `main` leaves a clean seam (per-id selector store pattern, `PriceBlock`/`ProductTile` composition slot). Rehearsal lives on branch `rehearsal/favourite-heart` + `_prep/LIVE_SESSION_PREP.md`. Never ship it unannounced; mention the seam in README "what's next".

## ADR-015 Undo-on-stepper-minus behaviour — *Accepted*
At qty 1, minus removes the line **with undo** (consistent with swipe delete) rather than disabling. Confirm in Phase 1.
Plan note (2026-11-16, `docs/PLAN.md` §6): recommend confirming. At qty 1 the minus shows a trash glyph (a11y label "Remove") and dispatches the same `remove` → UndoBar path as swipe.
Decision (2026-11-16, autonomous): confirmed as noted. One removal path means one undo behaviour to test and explain.

## ADR-016 Dark mode — *Deferred (stretch)*
Semantic tokens ready; implement only after Tier 1+2 ✅ and measured.

## ADR-017 One palette file, shared by the app and the native config — *Accepted*
Context: the splash screen and adaptive icon colours are set in `app.config.ts`, which runs in Node before the JS bundle exists, so it cannot use runtime theme hooks. Decision: all hex values live in `src/design/palette.ts` (no React Native imports). `app.config.ts` imports it with an explicit `.ts` extension, because the SDK 58 config loader uses Node's native type stripping, which needs real file extensions. `tsconfig` sets `allowImportingTsExtensions` (safe with `noEmit`). Consequences: one source of truth for colour; the raw-hex lint rule stays strict everywhere outside `src/design/`. Verify-by: `npx expo config --type public` shows `#0F2554` / `#F5F6FA`.

## ADR-018 Seed data as a typed TS module, not a runtime JSON read — *Accepted*
`docs/fixtures/catalog-seed.json` is the human-readable spec; `src/core/catalog/seed.ts` imports it once and gives it types, so Metro inlines it and Jest reads the same file. The pinned fingerprint test (`tests/catalog.test.ts`) fails if either the fixture or the generator changes by accident.

## ADR-019 Fake API chaos is seeded and injectable — *Accepted*
Runtime failures are ~5 % from a seeded stream, separate from the catalog stream, so a failure never changes the data. Tests pass `failEvery`/`failOffset` for exact failures and `chaos: 0` for none. `debug.forceFailure` lets the demo show the error state on demand.

## ADR-020 Worklet declaration order — *Accepted*
The worklets Babel plugin turns worklet functions into objects that are not hoisted. Rule: declare a worklet above every worklet that calls it (see `src/i18n/format.ts`). Found by a failing test, not guessed.

## ADR-021 TypeScript 6 strictness — *Accepted*
TS 6 defaults `types` to `[]`, so `tsconfig` lists `jest` and `node` explicitly. On top of `strict`: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Array reads return `T | undefined`, which is why the code uses `?.` and `??` on indexed reads instead of `!`.

## ADR-022 Fly-to-cart target is the Product header cart icon — *Accepted*
The product route is pushed above the tabs, so the tab bar badge is not on screen when "Add to cart" is pressed. The flying thumbnail lands on the cart icon in the Product header, which bumps; the tab badge bumps from the same store change when the user goes back. Both read one `count` selector, so they cannot disagree.

## ADR-023 Spikes are tracer bullets — *Accepted*
The three spikes (hero, RTL, grid) are built as the first slice of the real module, with tests, not as throwaway code in `spikes/`. The verdict goes in ADR-004 / ADR-005 / `docs/PERF_LOG.md`. Reason: in a 6–8 h budget, throwaway code is time we cannot spend twice; device-only acceptance checks are listed in `docs/HUMAN_TODO.md`.

## ADR-024 Image placeholder is the catalog `dominantColor`, not blurhash — *Accepted (amends ADR-008)*
Each product already has a `dominantColor` from the seed. The tile paints it as a background and the image fades in over it (160 ms, skipped on cache hit). No blurhash means no extra decode work per tile on a mid-range CPU during a fling (F-01, F-06). Everything else in ADR-008 stands.

## ADR-025 No carousel autoplay under reduce motion — *Accepted*
With the system "reduce motion" setting on, the Home banner carousel does not auto-advance; it stays swipeable and the page indicator still works. Auto-moving content is exactly what the setting asks us to stop (G-09). Every other animation keeps its end state and drops the movement (`ReduceMotion.System` on springs and timings).

## ADR-026 Remove `expo-updates` — *Accepted*
We do not ship over-the-air updates (backend is out of scope, G-07). `expo-updates` was only installed for `Updates.reloadAsync()` in the RTL switch, and `reloadAppAsync()` from `expo` does the same job in debug and release (ADR-005). Removing it takes its launcher, which reads an update database at start, out of cold start (F-07), and leaves one less module to explain.

## ADR-027 `brief-coverage` checks a pinned ID list — *Accepted*
*Amended by ADR-054: `brief/` is now committed; the pinned list stays as a drift check.*

`brief/` is private and never committed, so a fresh clone cannot read `brief/BRIEF.md`. `scripts/brief-coverage.mjs` pins the ID count per section (G 10, H 4, C 3, P 3, K 4, F 10, D 8, S 8, L 1 = 51). When the brief is present it must match the pinned list exactly, or the check fails with `DRIFT`.

## ADR-028 UI copy uses Western digits in both languages — *Accepted*
Saudi pharmacy and retail apps show prices and counts with Western digits (0–9) in Arabic too. One digit set keeps prices easy to compare and the money formatter simple. The catalog seed follows the same rule, so a product never reads "60 tablets" in one place and "٦٠ قرصاً" in another. Enforced by `tests/i18n.test.tsx` (no Eastern Arabic digits ٠–٩ in the copy) and `tests/catalog.test.ts` (none in the seed file or in any product's `nameAr`). The percent sign stays the Arabic ٪. Arabic proofreading by a native speaker is an open task in `docs/PLAN.md`.

## ADR-029 Count strings use CLDR plural categories — *Accepted (amends ADR-011)*
Arabic has six plural forms (zero, one, two, few, many, other), so "{n} items" cannot be built by string concatenation. Count-dependent strings live under `plurals` in `docs/fixtures/copy.json`, one form per category; `tn(lang, key, n)` picks the form with a 10-line rule function. English may add a `zero` form ("No reviews yet"). Still no i18n library: the whole thing fits in one file that can be explained live.

## ADR-030 A dedicated `hero` spring for the shared-element transition — *Accepted (amends ADR-006)*
F-04 needs the transition under 350 ms. In simulation `spatialDefault` (k380, ζ≈0.8) takes ≈ 427 ms to settle, too slow. `hero` is stiffness 700, damping ratio 0.9 (mass 1), which settles in ≈ 292 ms with no visible overshoot. A unit test simulates every spring token and fails if `hero` settles later than 320 ms.

## ADR-031 The language is derived from the native layout direction, not stored — *Accepted (amends ADR-005)*
With Plan B the JS runtime can only run in the direction Android set before it started, and Android already persists the `allowRTL`/`forceRTL` flags across restarts (expo-localization's plugin writes its defaults only on first launch, then leaves them to the app). A separately stored locale could only ever agree with `I18nManager.isRTL` or contradict it, and a contradiction means either Arabic text in an LTR layout or a reload loop. So `src/i18n/direction.tsx` reads `I18nManager.isRTL` once and derives the language from it: RTL → Arabic, LTR → English. Switching = `allowRTL(rtl)` + `forceRTL(rtl)` + `reloadAppAsync()`; `allowRTL(false)` matters on a phone set to Arabic, which Android would otherwise keep laying out RTL. Cost: a phone set to another RTL language (Hebrew, Persian) opens in Arabic, which is the only RTL language the app has. No prefs store is needed until dark mode (W3) adds a theme override.

## ADR-032 Styles are built at module load; the scheme is pinned to light — *Superseded in part by ADR-053 (scheme now follows the system)*
`makeStyles(factory)` in `src/design/theme.tsx` calls the factory twice when the module loads (light and dark palette) and returns a hook that picks one sheet from the scheme context. Render never creates a style object, and the object a component gets keeps its identity across renders, so memoised children are not invalidated by a new `style` prop (F-05). `tests/theme.test.tsx` proves both. RN 0.88's generated types no longer export `StyleSheet.NamedStyles`, so the factory's return type is constrained by `Parameters<typeof StyleSheet.create>[0]`. The `ThemeProvider` is fed `'light'` until dark mode (W3) has had a visual pass on every screen; the dark palette already exists and is contrast-checked, so turning it on is a provider change.

## ADR-033 Pressed feedback is drawn by Gesture Handler's native `Touchable` — *Accepted*
`PressableScale` wraps Gesture Handler 3's `Touchable` with `activeScale` 0.97 and `activeOpacity` 0.88. The native button view animates its own pressed state, so the feedback appears inside the 100 ms budget (F-03) even while JS is busy rendering a page; React only hears about the confirmed press. React Native's `Pressable` reports `onPressIn` on the JS thread, so a scale started from it waits whenever JS is busy. Reduced motion keeps the opacity dip and drops the scale. Every `PressableScale` requires an `accessibilityLabel` by type.

## ADR-034 Reduced motion, haptics and font scale rules — *Accepted*
Reduced motion works on two levels. Every spring and timing token keeps Reanimated's default `ReduceMotion.System`, so animations jump to their end state with no extra code. `useMotionPreference()` is only for places whose behaviour changes (no autoplay, no shimmer, hero becomes a crossfade, no press scale). It starts from Reanimated's start-up value and follows `AccessibilityInfo`'s `reduceMotionChanged` event; `<MotionPreferenceSync />` at the root passes each change on to Reanimated, so flipping the setting while the app is open takes effect for the tokens too (ADR-037). Haptics have four meanings (`tap`, `confirm`, `warn`, `success`) and are rate-limited to one pulse per 60 ms so a held stepper does not turn into a buzz. They do not follow reduce motion, because they are not movement. Text scales with the system font size up to 1.5× (`MAX_FONT_SCALE`, ADR-037), so fixed-height rows (tab bar, stepper, tiles) cannot clip at 2×.

## ADR-035 Jest runs the real libraries with their own mocks — *Accepted*
`jest.setup.ts` loads the mocks each library ships: Gesture Handler's `jestSetup`, FlashList's `jestSetup` and `react-native-reanimated/mock`. MMKV switches to an in-memory store by itself under Jest. Jest accepts one resolver, and two are needed, so `jest.resolver.js` puts Reanimated's resolver (which loads the plain `.ts` files of Reanimated and worklets) in front of React Native's. In that setup worklets runs its web build, which has no UI runtime. Gesture Handler's native `installUIRuntimeBindings` asks for one at import time, so the test setup swaps in Gesture Handler's own `.web` version of that file. `expo-haptics` is replaced by `jest.fn`s so tests can assert which haptic played. Nothing in `src/` knows it is under test, except `resetHapticsForTest()`.

## ADR-036 The pattern linter enforces motion and layout rules — *Accepted*
`scripts/lint-patterns.mjs` runs in `check.sh --quick`, after its own self-test (`scripts/lint-patterns.test.mjs`: one source that must trip each rule and one that must not). It reads the file with comments blanked, so a comment that names `I18nManager` is not a finding.

- **Line rules** fail on: `runOnJS`/`runOnUI`, Gesture Handler 2 builders, `console.log`, JS-driven `Animated`, `Math.random` in `src/core`, physical `left/right` margins and padding, raw hex outside `src/design/palette.ts`, `elevation` outside the sheet and tab bar, `@ts-ignore`, `TouchableOpacity` and friends, inline `stiffness`/`damping` outside `src/motion/springs.ts`, `entering/exiting/layout` props outside `src/features/cart`, and `I18nManager` outside `src/i18n`.
- **Structure rules** first find the code that runs on the UI thread or every frame: bodies of `'worklet'` functions, the arguments of `useAnimatedStyle`, `useDerivedValue`, `use*Gesture` and the other UI-thread hooks, animation callbacks, and JSX `onScroll`. They then fail on a React setter called there (unless it is handed to `scheduleOnRN`), on `.value` on a shared value anywhere (React Compiler is on, so it is `get()`/`set()` everywhere, ADR-037), on `sv.get()` outside those regions (a JS-thread read in render or an effect), and on layout props inside `useAnimatedStyle`.

A line with `lint-ignore: <reason>` is skipped, so every exception carries its reason in the code.

## ADR-037 Foundation review fixes: spring end point, Android haptics, live reduced motion, font cap — *Accepted (amends ADR-030, ADR-034)*
A hostile review of the Foundation layer found five things worth a decision.

- **Spring end point.** Reanimated ends a spring when its energy falls below `energyThreshold` × its starting energy. The default, 6e-9, keeps the animation running for the last fraction of a pixel, so the UI thread does frames nobody sees and the next gesture's "is it still moving?" check stays true longer. Every token now sets `SPRING_ENERGY_THRESHOLD = 2e-6`. `tests/springs.test.ts` simulates each token at 60 Hz and 120 Hz; these are simulated numbers, not device measurements:

  | Token | End at 6e-9 (60 Hz) | End at 2e-6 (60 Hz) | Gap left when it snaps |
  |---|---|---|---|
  | `hero` | 450 ms | 300 ms | 0.123 % |
  | `spatialFast` | 583 ms | 383 ms | 0.033 % |
  | `spatialDefault` | 667 ms | 450 ms | 0.055 % |
  | `spatialSlow` | 917 ms | 633 ms | 0.034 % |
  | `effectsFast` | 217 ms | 150 ms | 0.103 % |
  | `effectsDefault` | 317 ms | 233 ms | 0.094 % |
  | `effectsSlow` | 450 ms | 333 ms | 0.086 % |

  ADR-030's "settles in ≈ 292 ms" measured settling to the eye; the 300 ms above is when Reanimated stops calling the frame callback. The test fails if `hero` ends after 300 ms at 60 Hz or 350 ms at 120 Hz.
- **Android haptics.** `expo-haptics`' iOS-style calls (`impactAsync`, `selectionAsync`) drive the Android vibrator directly, which feels buzzy on mid-range motors next to the system's own key clicks. `src/motion/haptics.ts` calls `performAndroidHapticsAsync` instead, the same `View.performHapticFeedback` the OS keyboard uses: `tap` → `CLOCK_TICK`, `confirm` → `VIRTUAL_KEY`, `warn` → `LONG_PRESS`, `success` → `CONFIRM` on API 30+ and `VIRTUAL_KEY` below (older Android rejects the constant). The platform is read at call time, so one test file covers both platforms. The 60 ms rate limit (`MIN_GAP_MS`) is unchanged.
- **Reduced motion changed while the app is open.** Reanimated reads the system setting once, at start. `useMotionPreference()` already followed `reduceMotionChanged`, but the spring tokens did not. `<MotionPreferenceSync />` is mounted once at the root: it renders nothing while the setting still matches the start-up value, and mounts Reanimated's `ReducedMotionConfig` with the new value when it does not. Unmounting restores the start-up value, which is how flipping the setting back works.
- **Font scale cap.** `DESIGN.md` said text must not clip at 1.3×, while `MAX_FONT_SCALE` is 1.5. The cap stays at 1.5: 1.3 would ignore the setting for many people who chose a large font, and the fixed-height rows (tab bar, stepper, tile price row) are built to fit it: each screen's Definition of Done includes a check at 1.5×. `DESIGN.md` now states the 1.5× cap; the device check is in `docs/HUMAN_TODO.md`.
- **One font table.** `app.config.ts` (which embeds the font files) and `typography.ts` (which names them in styles) each had their own weight list. Both now read `src/design/fonts.ts`, plain data with no React Native import so the config loader can read it in Node.

Two code-level rules came out of the same review. Shared values use `get()`/`set()`, never `.value`, because React Compiler is on and Reanimated's docs say the compiler cannot see `.value` writes (https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue). The pattern linter (ADR-036) now enforces that and the other UI-thread rules by structure rather than by line, and has its own self-test.

## ADR-038 App shell: tab bar, cart badge, language toggle, shared primitives — *Accepted (amends ADR-005)*
**Tab bar.** A custom `tabBar` on expo-router's JS tabs (`expo-router/js-tabs`), not the native bottom tabs: the native bar cannot draw a sliding indicator or bump a badge on the UI thread.
- The selected tab sits on a `bgSunken` pill. A shared value `position` follows `state.index` on `spatialDefault`, and the pill's `translateX` is `indicatorOffset(position, tabWidth) × dir`, so it slides the right way in Arabic (G-08). Under reduced motion it jumps.
- Gold stays out of the tab bar except for the cart badge. `palette.gold` is a fill token only, never text: navy on gold is 9.43:1, while gold on white is 1.58:1.
- A press emits `tabPress` with `canPreventDefault`. It then navigates only if the tab is not already focused and no listener prevented it. A re-press still emits, so a screen can scroll to top.
- `route.name` is checked against a `Set` of the three tab names. That narrows it to `TabRouteName` without indexing an object with a string from the router.
- The cart tab's TalkBack label carries the count ("Cart, 2 items in cart"). Arabic joins the two parts with the Arabic comma "، ".
- The badge is `importantForAccessibility="no-hide-descendants"`, so the count is read once.
- The bar reads the count through `useCartCount()`, a selector, so it re-renders only when the count changes, not on any other cart change. No screen or list row subscribes to the count, so adding to the cart never re-renders the grid (F-05).
- The pill stays at opacity 0 until the row has been measured, so it never flashes at x = 0 on the first frame.

**Badge bump.** The badge bumps only when the count goes up: a 1.35× `timingMicro` scale, then a `spatialFast` spring back, transform only (P-03, F-02). Counts above 99 show "99+". Under reduced motion it does not move. It dips to a lower opacity and back with `timingReducedFade`.

**`timingReducedFade` opts out of Reanimated's reduce-motion switch** (`ReduceMotion.Never`). It is the fade that replaces movement. With the default, Reanimated would skip it as well and the change would cut instead of fading.

**Product route.** `product/[id]` is a `transparentModal` with `animation: 'none'`. The hero transition (P-01) draws all of the motion itself, and a native slide would race it.

**Tabs keep their state.** With `lazy: true`, a tab mounts the first time it is opened and then stays mounted, so the Category grid keeps its scroll position and filters.

**Language toggle (amends ADR-005's 250 ms veil).** The toggle sits in the Home header.
- On a press, in this order:
  - a `tap` haptic;
  - `cartActions.commitRemoval()`, since an undo bar cannot survive the reload;
  - a navy veil fades in over the whole screen;
  - when the fade completes, a worklet callback `scheduleOnRN`s `switchLanguage(next)`.
- The fade is `timingExit` (150 ms), not 250 ms. The veil only hides a reload that is already slow, so the shortest fade that still reads as deliberate is the right one. Under reduced motion it uses `timingReducedFade`.
- The veil is in a transparent `Modal`. On Android a Modal is its own window, so it also covers the tab bar and the system bars, which a view inside the header cannot.
- A ref blocks a second tap before React has re-rendered. If `switchLanguage` rejects, the veil goes away and the toggle works again.
- The veil uses `c.scrim`, which is brand navy in the light scheme. Dark mode (W3) needs its own navy token here.
- The effect that starts the fade is mount-only by design, and carries the project's one `eslint-disable` (`react-hooks/exhaustive-deps`) with the reason next to it.
- The button shows the target language's own name ("ع" or "EN") in that language's font. These are fixed endonyms, not dictionary copy.

**Shared primitives belong to the shell.** These are owned by the shell, not by any one screen, so two screens never grow two versions of them: `PageDots`, `ErrorState`, `EmptyState`, `StateButton`, `Skeleton`, `ProductImage`, `PriceBlock`, `QuantityStepper`, `CartBadge` and `TabBar`.
- `Skeleton` is an opacity pulse (`withRepeat` on a shared value), not a gradient shimmer. No gradient library is installed, and opacity is the cheapest property to animate on the UI thread. Under reduced motion it holds still.
- `QuantityStepper` becomes a bin at its minimum when the caller passes `onRemove` (the cart does), so going from 1 to 0 removes the line, which can be undone. Without `onRemove`, minus disables at the minimum.
- The stepper is mirrored in Arabic: minus at the start, plus at the end, in reading order. Material leaves number-line controls such as sliders and media scrubbers unmirrored. A stepper is a pair of buttons, not a scale, so it follows the row.
- `pageOffset` / `pageIndexFromOffset` in `gestureMath.ts` are the single place the gallery and banner carousel turn a page index into `translateX`. The row mirrors in RTL but transforms do not, so `dir` multiplies in.

**RTL items accepted as known, not fixed.**
- `format.ts` writes a negative amount with a hyphen. No amount in the app is negative (the cart has no discount lines). If one ever is, use U+2212 inside an LTR isolate.
- Product names are not wrapped in bidi isolates (U+2068/U+2069). Each name is entirely in one script (`name` or `nameAr`), and numbers come from our own formatter.

The Arabic hint copy (`lang.toggleHint`) needs a native speaker's read; that is in `docs/HUMAN_TODO.md`.

**Tests.**
- `renderWithProviders` passes the providers as a `wrapper`, so `rerender(newUi)` updates the same instance and keeps refs and shared values, as on a device.
- In React Native Testing Library 14, `act` always returns a promise and must be awaited. An unawaited `act` interleaves scopes, and later queries find nothing.
- Jest maps `lucide-react-native` to its CommonJS build, because Jest could not load the package's ES module entry.

**How the screens were built in parallel.**
- One checkout, and each agent owns a disjoint set of files.
- Agents make no git writes.
- `copy.json` and `testIds.ts` take additive, prefixed edits only.
- The orchestrator owns the shared primitives, the stores, `scripts/check.sh` and every commit, and verifies each agent's tests and lint itself before committing that feature.

## ADR-039 — App shell details: shared skeleton pulse, pill moves on press, splash fallback

- **Skeletons share one pulse.** One module-level shared value drives every visible skeleton; it starts with the first and is cancelled with the last. N skeletons cost one animation, not N. Reduced motion: no shimmer layer at all.
- **Tab pill starts in the press handler**, before `navigateToTab`, so it answers the finger on the next frame even if the next screen is slow to mount (F-03). The `state.index` effect still covers navigation that is not a tap.
- **Splash fallback + root ErrorBoundary.** Home hides the splash on first layout; a 5 s timeout hides it anyway, and the root `ErrorBoundary` brings its own providers and hides the splash, so the app can never be stuck behind it.
- **Test setup:** `jest.setup.ts` maps `makeMutable` to the mock `useSharedValue` (the stock mock returned the raw value).
- **A11y copy:** the cart tab reads one plural entry `a11y.cartTab` ("Cart, 2 items"); `a11y.cartBadge` stays for the product header. The new Arabic strings (cartTab, crash screen) join the HUMAN_TODO proofread.

## ADR-040 — Release builds: perf-mode fake API, Windows short-path build

**Perf builds turn the fake API's failures off.** `EXPO_PUBLIC_FAKE_API_CHAOS` sets the failure rate. Expo inlines it into the bundle at build time, and the built Hermes bundle does not contain the variable name. `scripts/perf/android-release-build.sh` builds with 0 by default, so a 10 s fling (F-01) never stops on an error row. `--demo` builds with 0.05 (D-05) for the video, where error and retry states should show. A dev build keeps the 0.05 default. `build-info.txt` records which mode was built, next to the commit and APK size.

**Windows path limit.** The NDK's CMake 3.22.1 ships ninja 1.10.2, which cannot create paths over 260 characters. CMake names each object file after its source path, absolute path included, so the folder of the codegen objects alone runs to about 265 characters.
- `plugins/withShortObjectPaths.ts` adds `-DCMAKE_OBJECT_PATH_MAX=240` to the app module's CMake arguments. CMake then replaces the start of a longer object path with a hash. After this change, the deepest app object is 217 characters under the project root.
- Libraries with their own CMake build (react-native-reanimated) do not get the app's argument. Their deepest object is about 2 × root + 249 characters, so the project root must be 5 characters or fewer. The build script checks this and prints the exact clone command (`C:/ad`). subst drives and junctions do not help, because CMake resolves them back to the long path.
- Not done: patching every library subproject from the root `build.gradle` would remove the short-clone step. It is one more Gradle hook to explain, the short clone works, and macOS and Linux are unaffected.

**Other build details.**
- `_common.sh` finds the Android SDK in the usual folders and exports `ANDROID_HOME`, because a fresh prebuild writes no `local.properties`.
- On Windows, the Gradle daemon's Unix socket goes in `android/.udstmp` (`JAVA_TOOL_OPTIONS`), because the socket in `%TEMP%` was refused.
- Expo prebuild signs the release variant with the debug keystore, so `adb install` works. It is still a release build: minified, Hermes bytecode, not debuggable.

**Measured on this PC.**
- Built from `C:\ad` at commit 0b57c47: arm64-v8a release APK, 37,204,073 bytes.
- "BUILD SUCCESSFUL in 8m 23s" (cold native build).
- No phone was attached, so no runtime numbers exist yet (`docs/PERF_LOG.md` says NOT MEASURED YET).

## ADR-041 — Cart swipe rows: one open row at a time, touches on an open row

**Decision.** At most one cart row is swiped open. The list owns one shared value, `openRowId`. A row writes its id into it on touch down, and every other row watches it with `useAnimatedReaction` on the UI thread and springs closed if it was left open. A touch on an open row's content closes that row; a touch on the uncovered red button keeps it open, so the press lands. Which side is "the button" comes from the reading direction, so the rule mirrors in Arabic (G-08).

**Why.** Two half-open rows read as a broken list, and a tap that closes the row it is aimed at makes the delete button impossible to press. The iOS Mail and Android Gmail lists behave the same way. A shared value keeps the coordination on the UI thread: no React state changes, and no row re-renders when another row opens (F-02, F-05).

**Rejected.** A `useState` "open row" in CartList: every row would re-render on every open and close. A global gesture that closes rows on any touch outside: it would also swallow taps on the stepper of another row.

**Testing.** Jest covers the direction, the open rest, the touch rules on an open row and the reduced-motion variant (`tests/cartSwipe.test.tsx`). It cannot cover one row closing another: Reanimated's Jest mock never calls `useAnimatedReaction`. That case is on the device checklist (`_prep/DEVICE_RUNBOOK.md`): open row A, touch row B, row A closes.

## ADR-042 — Submission hygiene gate: whole-word TODO, unmeasured numbers warn instead of fail

**Decision.** `scripts/repo-hygiene.sh` (part of `check.sh --full`) changes in two ways:
- The TODO/FIXME check matches whole words only (`\b(TODO|FIXME)\b`), so a reference to `docs/HUMAN_TODO.md` in a comment is not flagged.
- "NOT MEASURED YET" no longer fails the gate on its own. While `docs/PERF_LOG.md` still has unmeasured rows, the gate prints a warning: not ready to submit, see `docs/HUMAN_TODO.md` item 1. Once PERF_LOG has no unmeasured rows, a README that still says NOT MEASURED YET fails, because the numbers were not copied across.

**Why.** The old check failed on `HUMAN_TODO` (not a TODO), and it failed an honest README. Numbers come only from the phone (CLAUDE.md), so before the device run the README must say NOT MEASURED YET. A gate that fails on the honest state makes people either skip the gate or fill the cells with something, and both are worse. The gate still catches the real mistake: numbers measured but not copied into the README.

**Rejected.** Removing the check: then a README could ship with blanks after the numbers exist. Allow-listing `HUMAN_TODO` by name: whole-word matching is simpler and covers any similar name.

## ADR-043 — Filter sheet: the body drag hands off to scrolling at touch-down

**Decision.** The sheet's content area has its own pan. It activates only on a downward move past `DRAG_SLOP` (6 px) and fails on an upward one. The content `ScrollView` waits for that pan to fail (`requireToFail={bodyPan}`). The pan is enabled only while the content is at its top: `bodyAtTop` is a shared value fed on the UI thread by `useScrollOffset` and `useAnimatedReaction` through the `bodyCanDrag` worklet (offset ≤ 1 px). A drag that starts with the content scrolled stays a scroll for the whole gesture (`src/ui/useSheetDrag.ts`, `src/ui/bottomSheetMath.ts`).

**Why.** C-03 says the sheet tracks the finger, and people drag a sheet down by its content, not only by the grip. Deciding once, at touch-down, means the content never moves under the finger while the sheet also moves. 6 px is below Android's 8 dp scroll slop, so the sheet's pan decides before the scroll view would. There is no JS `onScroll` and no per-frame state (F-02).

**Rejected.** Letting both run together and locking the scroll by hand: the content jumps under the finger for a frame. Re-deciding mid-gesture: the sheet jumps when the content reaches its top.

**Gesture Handler detail.** Each pan's worklets are passed to `usePanGesture` one by one. A spread inside the config object fails the Worklets Babel plugin ("SpreadElement ... is not supported for object hooks"), which breaks the bundle, not only the tests.

**Testing.** Jest covers `bodyCanDrag`, the slop bound and three body-drag outcomes (flick closes, slow drag springs back, a failed pan leaves the sheet where it was going) in `tests/bottomSheetMath.test.ts` and `tests/bottomSheetDrag.test.tsx`. The native hand-off itself is on the device checklist.

## ADR-044 — Result counts get their own memo, separate from the page cache

**Decision.** `countProducts` filters without sorting, keyed by category plus filters, in its own 32-entry first-in-first-out map (`src/core/api/fakeApi.ts`).

**Why.** The sheet shows a live result count on every draft change. The old path sorted and cached the full result list in the same 8-entry cache the grid's pages use, so a few taps in the sheet pushed out the pages on screen. A count does not depend on the sort, so sorting it was wasted work.

**Testing.** `tests/fakeApiCount.test.ts`: counting builds no list and leaves page 1 cached; a control shows that 9 page queries do evict it; counts are brute-force checked.

## ADR-045 — Category route param: `'all'` is allowed, a new param closes the sheet, the draft re-seeds

**Decision.**
- `category=<id>` from Home replaces only the category filter; `category=all` clears only the category filter; unknown values are ignored (`asRouteCategory`, `withRouteCategory` in `src/features/category/filterSortValue.ts`).
- A new param closes an open filter sheet.
- The sheet restarts its draft on every open, and whenever `value` changes while it is open.

**Why.** Home's category rail can send a category while the Category tab is still mounted with its sheet open. Before this, pressing Apply in that sheet wrote the old draft over the new category. Either guard alone stops the data loss; together they also match intent, since the person has moved on.

**Testing.** `tests/categorySheetFlow.test.tsx` runs the stale-draft case end to end with the real sheet. It was mutation-checked: it fails with both halves of the fix reverted and with only the screen half reverted. `tests/categoryScreen.test.tsx` covers `'all'` and closing the sheet.

## ADR-046 — Product back gestures: a body swipe and a pull-down, no edge strip

**Decision.** The product page has two finger-driven ways back, both scrubbing the same hero `progress` as the Back button (`src/motion/hero/useHeroBackGestures.ts`):
- **Body swipe**: a horizontal pan on the page body below the gallery. `activeOffsetX: 10 * dir` activates it towards the reading end (right in English, left in Arabic); `failOffsetX: -10 * dir` fails it towards the start; `failOffsetY: ±10` fails it when the finger goes vertical first, so the page scroll wins.
- **Pull-down**: a downward pan on the gallery, enabled only while the page is at its top (`pullEnabled`). Upward and sideways moves fail it, so the gallery pager keeps its swipes.
- **Android Back** (key, button or the system edge gesture) runs the same close through `hardwareBackPress` (`useHeroLifecycle.ts`).
- The 10 pt activation slop is subtracted from the translation, so the image does not jump when the drag takes over.

**Why.** On Android with gesture navigation the system owns both screen edges and turns an edge swipe into Back, so a 24 pt edge strip in the app would fight it, and that Back already runs our close. A swipe on the body reaches with one thumb, and multiplying every horizontal number by `dir` mirrors it for Arabic (G-08). The pull-down is the same in both languages.

**Rejected.** An in-app edge strip (conflicts with system gesture navigation). Closing from a gallery swipe on image 1 (the same finger motion would mean "previous image" or "close" depending on the page, which is surprising).

**Testing.** `tests/productChrome.test.tsx` drives both pans in English and Arabic (close, spring back, wrong direction does nothing). Whether the native pans hand off to the scroll view and the pager as described is on the device checklist (`_prep/DEVICE_RUNBOOK.md` §3).

## ADR-047 — The hero animates `borderRadius` as well as transform and opacity

**Decision.** The flying image starts with the tile's rounded corners (`radius.image`) and squares them off by `CORNERS_SQUARE_AT` (35 % of progress), then stays 0 (`heroCornerRadius` in `src/motion/hero/heroMath.ts`, used in `heroStyles.ts`). The radius is divided by the current scale, because the view is laid out at gallery size and scaled down, and a scaled radius would shrink with it. On the reduced-motion fade path (no tile rect) the radius is 0. The hero view clips its children (`overflow: hidden`).

**Why.** A square image leaving a rounded tile shows sharp corners for the first frames, which reads as a glitch. `borderRadius` is a paint property, not layout, so it does not trigger Yoga. It is the one exception to "transform and opacity only", on one view, and it is constant for the last 65 % of the flight.

**Cost.** Clipping a rounded rect can cost GPU time on some Android devices. That cost is **NOT MEASURED YET**: the F-04 transition trace in `docs/PERF_LOG.md` is the check. If it shows jank, the fallback is a fixed rounded mask that fades out instead of an animated radius.

**Testing.** `tests/heroMath.test.ts` checks the radius at 0, halfway to 35 % and after it, and that radius × scale gives the tile's on-screen radius.

## ADR-048 — The fake API's failures use a per-launch seed; the products stay fixed

**Decision.** `createFakeApi` takes a `failureSeed` that seeds only the failure stream. It defaults to `seed`, so tests stay repeatable. The app passes `Date.now() >>> 0` (`src/state/api.ts`). The catalog and the delay stream keep the fixed seed.

**Why.** With a fixed failure seed, the same request failed on every launch, and on the Expo web preview that was the first request: every cold start opened on an error state. The brief asks for "~1 in 20 requests fails" (D-05), which a reviewer should see sometimes, not every time on the first screen. D-01 (identical products every run) is unaffected.

**Rejected.** Turning failures off for the first request (hides a real state). A fixed offset (still the same request every launch).

**Testing.** `tests/fakeApi.test.ts` "failureSeed moves which requests fail but leaves the products alone (ADR-048)".

## ADR-049 — Expo web preview: language from localStorage, direction from a root `dir`

**Decision.** The web build is a desktop preview for reviewers, not a target platform. On web only:
- The language lives in `localStorage` (`lang`), and switching reloads the page (`switchLanguage` in `src/i18n/direction.tsx`).
- `LocaleProvider` wraps the app in a `View` with `dir="rtl"` or `"ltr"`. `<html dir/lang>` is set too.
- `moveA11yFocus` (`src/ui/moveA11yFocus.ts`) skips `AccessibilityInfo.sendAccessibilityEvent`, which react-native-web does not implement and which threw when the filter sheet opened.
- The Best sellers rail renders its 12 cards in a plain horizontal `ScrollView` instead of FlashList.

**Why.** react-native-web's `I18nManager` is a stub that always reports LTR. Its logical styles (`start`/`end`, row direction) follow the nearest `dir` attribute instead. FlashList 2.3.2 takes its direction from `I18nManager.isRTL`, so in Arabic on web it put card 1 at the far left of a scroller that opens at its right edge, and the rail looked empty. On the phone the native flags are real, so none of this code runs there: `Platform.OS === 'web'` guards every branch.

**Known web-only limitation.** In Arabic, the 1,000-product grid on web places product 1 in the left column, for the same FlashList reason. It is not patched: the grid is the performance-critical path judged on Android, where FlashList reads the native direction. The Android check is in `docs/RTL_CHECKLIST.md` and the device-only checks listed in `docs/HUMAN_TODO.md`.

**Also web-only.** Reanimated on web supports only predefined layout animations, so the cart's custom entering/exiting worklets log a warning there and fall back. Not changed.

## ADR-050 — Expo web preview loads IBM Plex itself

**Decision.** `src/design/useWebFonts.ts` exports `useAppFontsReady()`. On web it calls `useFonts` with the same six IBM Plex files (Sans and Sans Arabic, 400/500/600) under the names `fontName()` gives `typography.ts`, and the root layout renders nothing until they are loaded or have failed. On Android and iOS it returns `true` at once.

**Why.** The `expo-font` config plugin embeds the fonts in the native build, so on the phone they exist before any JS runs. It does nothing for the web bundle: every `fontFamily` named a face the browser did not have, and the preview fell back to the browser's default serif. Waiting at the root means text never changes font after the first paint.

**Cost.** None on the phone: `Platform.OS` picks the hook once at module load, so the native path has no loader, no extra render and no async font loading (CLAUDE.md §2). On web, the first paint waits for six local font files.

**Rejected.** Loading fonts with `useFonts` on every platform (adds an async gate to the native cold start, F-07). A CSS `@font-face` file (a second list of names to keep in sync with `fonts.ts`).

## ADR-051 — One brand mark for the launcher icon, splash, favicon and Home header — *Superseded by ADR-055 (the mark changed; the one-geometry pipeline stayed)*

**Decision.** The mark is a capsule split in two (white and gold), tilted 45 degrees, with a plus cut out of the white half: a pharmacy read in the brand's two colours (G-04). `scripts/brand/make-icons.py` (Pillow, 4x supersampled) draws every bitmap from one geometry: `icon.png` (1024, navy), the Android adaptive foreground/background, the themed-icon monochrome, `splash-icon.png` and the web `favicon.png`. `src/design/BrandMark.tsx` draws the same geometry with `react-native-svg` for the Home header, next to the `app.name` wordmark.

**Why.** The Expo template icon read as unfinished. One script means the icons are reproducible and change together; the in-app mark is vector so it is sharp at any density.

**Details.** The adaptive foreground keeps the mark inside the 66 % safe zone, so circle and squircle masks never clip it. The mark is not mirrored in Arabic (a logo is not text); the row around it is a flex row, so it moves to the reading start. The mark is decorative: the brand row's accessibility label is the app name.

**Original mark.** Drawn for this project; not any pharmacy's trademark.

## ADR-052 — A launch veil that lifts with motion, and the brand mark inside image skeletons

**Decision.** `src/ui/LaunchVeil.tsx` draws the native splash again in React (the brand surface, the mark at 160 px) on top of the routes. The first tab screen to lay out (Home on a cold start; Category or Cart after a web reload on that route) calls `onFirstScreenLayout()`, which hides the native splash and lifts the veil once per launch. The veil then lifts in 460 ms: the mark dips to 92 %, opens out to 150 % and fades, and the brand colour fades off Home. Image skeletons (grid tiles, Best sellers cards) get the mark as a still watermark, one colour at 16 % opacity, centred above the shimmer (`Skeleton`'s `markSize`).

**Why.** A native splash can only cut to the app. Because the veil looks exactly like it, the swap cannot be seen, and the exit becomes the app's first animation. The watermark makes a loading tile read as "a Nabd product is coming here" instead of a grey box. It does not move, so the one shared skeleton pulse stays the only animation.

**Rules it keeps.**
- Nothing waits on it (F-03, F-07): `pointerEvents="none"` from the first frame, and it starts lifting the moment the first screen has laid out. It never delays that screen.
- It runs on the UI thread with two shared values, transform and opacity only, and one `scheduleOnRN` at the end to unmount (F-02).
- Reduce motion (G-09): no dip, no scale, no breath; a 120 ms fade.
- Hidden from screen readers. If no screen ever lays out, the 5 s splash fallback in `app/_layout.tsx` lifts the veil too.
- Web preview only: the veil is also what shows while the fonts load (ADR-050), and the mark breathes slowly there. On a phone the native splash covers that wait.

**Rejected.** A Lottie or video splash (a new dependency and a decode on the cold-start path). Holding the veil for a minimum time to show off the animation (delays F-07 for decoration). Animating the watermark (a second animation per tile in a 1,000-item grid).

## ADR-053 — Dark mode follows the system (G-10)

**Decision.** `app.config.ts` sets `userInterfaceStyle: 'automatic'` and `app/_layout.tsx` feeds React Native's `useColorScheme()` into `ThemeProvider` (the error boundary too). There is no in-app switch. The launch veil uses a new `bgSplash` token, which is the brand navy in both schemes, because the native splash is navy in both and the swap must stay invisible (ADR-052). Dark `bgBrand` (#16295A) stays a shade lighter so the Home header separates from the dark page.

**Why now.** ADR-032 held dark mode back until every screen had a visual pass. That pass is done on the web preview: Home, Category, the filter sheet, Product (before and after Add), Cart and the undo bar. Dark text pairs measured with the WCAG formula: primary on app 15.28, muted on surface 8.13, muted on selected 5.90, danger on surface 5.94, navy on gold 11.44. The lowest is 5.90, above 4.5 for body text.

**Cost.** None at runtime: both style sheets are already built at module load (ADR-032), so a scheme change picks the other sheet and re-renders once. Product photos are not dimmed.

**Open.** Not checked on a phone yet (G-10 is 🟨). An in-app override would need a stored preference (ADR-031 notes the prefs store it would need).


## ADR-054 — Commit `brief/` to the private repo; keep `_prep/` out — *Superseded by ADR-055 (no brief in this repo)*

**Decision.** `brief/` (the take-home PDF and `BRIEF.md`, the structured copy with requirement IDs) is committed. `_prep/` (private interview notes and runbooks) stays ignored, and `scripts/repo-hygiene.sh` still fails if any `_prep/` file is tracked.

**Why.** The repo is private and shared only with the reviewers, who wrote the brief. Every requirement ID in `docs/REQUIREMENTS_TRACE.md` points back to `brief/BRIEF.md`, so a reviewer can follow a trace row to its source, and `scripts/brief-coverage.mjs` runs its drift check on a fresh clone too. `_prep/` is notes for the author, not part of the deliverable.

**Amends** ADR-027.

## ADR-055 — Rebrand to Nabd (نبض, "pulse") — *Accepted*

**Context.** The app started life as a recreation of an existing pharmacy's flows. As a portfolio piece it needs its own identity: a name, a mark, colours and copy that belong to nobody else, while keeping every motion and performance property intact.

**Decision.**
- **Name.** Nabd (Arabic نبض, "pulse"). Short in both scripts, says "health" without a cross or a pill, and gives the mark its idea. Package and bundle id `com.nabd.pharmacy`, scheme `nabd`.
- **Colour.** Deep pine `#0E3B35` (trust, clinical calm, distinct from the navy/blue every pharmacy uses) with one electric lime `#C8F169` accent. Lime is a fill only (CTA, badge, active indicator) and never text on a light surface; pine on lime is AAA. All hex values live in `src/design/palette.ts`; `node scripts/contrast.mjs --tokens` checks every text/background pair the UI uses, in both schemes.
- **Mark.** A lime disc with one pine heartbeat line through it (100-unit box, disc r40, stroke 7, round joins). `src/design/BrandMark.tsx` (SVG) and `scripts/brand/make-icons.py` (bitmaps) share the numbers, so the launcher icon, adaptive layers, themed monochrome icon, splash, favicon, Home header, launch veil and skeleton watermark change together.
- **Token names became role names.** `gold` → `accent`, `textOnNavy` → `textOnBrand`, `brand.navy/blue` → `brand.primary/secondary`. A future rebrand is a palette edit, not a rename.

**Consequences.** No motion, layout or data code changed; typecheck and the full Jest suite passed unchanged after the rename. The pulse line is not mirrored in Arabic (a logo is not text).

**Verify-by.** `node scripts/contrast.mjs --tokens` exits 0; `python scripts/brand/make-icons.py` regenerates identical icons; `grep -ri "navy\|gold" src app` finds no token names.
