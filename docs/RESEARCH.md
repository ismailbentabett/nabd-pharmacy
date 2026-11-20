# RESEARCH (verified 2026-11-16) — facts, versions, traps

> Versions drift. **Phase 0 must re-verify** with `npm view <pkg> version` and `npx expo install` (which resolves SDK-compatible ones). Treat this file as a starting map, not truth. When docs and this file disagree, the docs win; update this file.

## 1. Platform versions
| Item | Finding |
|---|---|
| Expo | **SDK 58** (Oct 15 2026; RN 0.88; `expo@58.0.x`), New Architecture only (mandatory since SDK 55). Fallback SDK 57 ≥ **57.0.17**. **Avoid SDK 56**: Hermes V1 memory regression with worklets/Reanimated (fixed in 57.0.17 via RN 0.86.3) → threatens F-08. |
| Expo Go | Limited for SDK 58 → use **development builds**; measure with `expo run:android --variant release`. |
| Reanimated | 4.7.x (worklets in `react-native-worklets` 0.13.x). `runOnJS/runOnUI` deprecated → `scheduleOnRN`/`scheduleOnUI`. Babel plugin handled by `babel-preset-expo` (don't hand-edit). |
| Gesture Handler | **3.x hook API**: `usePanGesture`, `useTapGesture`, … callbacks renamed (`onStart→onActivate`, `onEnd→onDeactivate`); relations via hook options (`simultaneousWith`, `requireToFail`, `block`); builder and hooks can't be mixed; `GestureDetector` stays. Read the installed version's docs: swmansion upgrading-to-3 guide. |
| FlashList | v2 (2.3.x): new-arch only, no `estimatedItemSize`, `masonry`, RTL support, `getItemType`, no `key` inside items, `recyclingKey` for expo-image. |
| expo-image | 58.0.x: `cachePolicy="memory-disk"`, `placeholder` (blurhash/thumbhash), `transition`, `recyclingKey`, `priority`, `Image.prefetch`. |
| React Compiler | On by default (SDK 54+); `eslint-config-expo` includes rules. |
| Others (npm at research time) | zustand 5.1 · react-native-mmkv 4.3 · lucide-react-native 1.73 · react-native-svg 15.16 · expo-haptics 58.0 · expo-router 58.0 · jest-expo 58.0 · @testing-library/react-native 14.1 · typescript 7.0 (Expo 58 may pin 5.x — follow `expo install`) · expo-updates 58.0 · expo-localization 58.0 · safe-area-context 5.11 · `@expo-google-fonts/ibm-plex-sans(-arabic)`. |

## 2. Animation & gesture rules that matter
- Animate **transform/opacity/backgroundColor** only; never layout props per frame. Never read `sv.value` on JS thread; never `setState` per frame; memoise gestures; `cancelAnimation` when a gesture begins; seed release springs with gesture velocity.
- Practical limit ≈ **100 simultaneously animated components** on low-end Android.
- Reanimated feature flags (set once, early in entry): `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` (many simultaneous animations; use RNGH `Pressable`), `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS` (scroll FPS drops), `DISABLE_COMMIT_PAUSING_MECHANISM` + RN `preventShadowTreeCommitExhaustion` (sticky-header flicker). Test each in **release**; regressions often appear only in debug.
- Reduced motion: `ReducedMotionConfig` at root (`System`); `useReducedMotion()` reads the setting **only at app start**; under reduce motion spring/timing jump to final and `entering/exiting` are skipped. For live-toggle proof, restart or read `AccessibilityInfo.isReduceMotionEnabled` + listener in our own hook.
- Layout animations (`entering/exiting/layout`) break recycling in virtualised lists → Cart only (non-virtualised).
- Animated counters: shared value + `AnimatedTextInput` (`defaultValue` via `useAnimatedProps`) — not React state.
- Shared Element Transitions in Reanimated are **experimental** (flag `ENABLE_SHARED_ELEMENT_TRANSITIONS`, changes layout-animation engine) → custom overlay engine (ADR-004). Alternative to spike: `react-native-screen-transitions`.

## 3. Lists & images
FlashList v2 for the 1,000-item grid and rails; `keyExtractor` stable ids; `getItemType`; memoised tile; avoid inline closures (compiler helps). Request sized images (picsum `/seed/<id>-n/<w>/<h>`), bucket sizes, ≤ 2× DPR; `expo-image` cache `memory-disk`; fade only on first load; prefetch ahead. **No elevation/shadows** on tiles (Android overdraw). `contentFit="cover"`, radius on image. Memory flat target: avoid holding bitmaps outside the cache; keep `drawDistance` modest.

## 4. Measurement (Android)
- **Flashlight** (`flashlight measure`, `flashlight test --bundleId X --testCommand "maestro test flow.yml" --iterationCount 10 --duration 10000 --resultsFilePath results.json`, `flashlight report results.json`); `npx @perf-profiler/maestro@latest test` for meaningful TTI.
- `adb shell dumpsys gfxinfo <pkg>` (+ `reset`, `framestats`) → "Janky frames: N (x%)", percentiles. `adb shell input swipe x1 y1 x2 y2 <ms>` for flings. `adb shell am start -W` for cold-start TotalTime. `dumpsys SurfaceFlinger --timestats` for 120 Hz FPS. `adb shell cmd package compile -m speed -f <pkg>` for stable AOT. Perfetto / Android Studio Profiler for transitions. HUD overlays **off** while measuring.
- Release build optimisation: `expo-build-properties` → `android.enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`, `enablePngCrunchInReleaseBuilds`; native splash (JS-managed splash costs ~400 ms); embed fonts via config plugin; Baseline Profile = stretch.

## 5. RTL
`I18nManager.forceRTL` requires reload; Android OK after reload; new-arch Yoga edge cases exist. Plan A (instant) vs Plan B (reload + persisted state) decided in Spike 2 (ADR-005). Always: logical props (`start/end`, `marginStart`), `useDirection()`; mirror directional icons only; numbers and logos stay LTR. Arabic typography: IBM Plex Sans Arabic, body line-height ≥ 1.6 (≈24 on 15), +1px optical size, avoid italics, test font scaling. Algerian dinar shown as a text label: "DA" in English, "د.ج" in Arabic (ISO code DZD).

## 6. Motion tokens (M3 Expressive, mass 1, damping = ζ·2·√k)
spatialFast k800 ζ0.6 → 33.9 · spatialDefault k380 ζ0.8 → 31.2 · spatialSlow k200 ζ0.8 → 22.6 · effectsFast k3800 ζ1 → 123.3 · effectsDefault k1600 ζ1 → 80 · effectsSlow k800 ζ1 → 56.6. Quick feedback 100–200 ms; transitions 300–350 ms (budget < 350); add-to-cart feedback < 400 ms parallel to the action.

## 7. E-commerce UX facts
Skeletons over spinners; sticky bottom CTA on product; thumb-zone actions; haptics on stepper/swipe thresholds; free-delivery progress nudge (free delivery over 4,000 DA — display only); undo over confirm-dialogs; badge bump on add.
Real Al-dawaa app (store listings; website blocked for fetch): Saudi pharmacy chain, bilingual EN/AR, prescription upload, clinic booking, Click & Collect, free delivery over a basket threshold, loyalty points. We take **layout & flow only** (G-05), no trademarks/logos.

## 8. Contrast (computed by `scripts/contrast.mjs`)
See `docs/DESIGN.md §1`. Gold is never text on light backgrounds (1.58:1); muted on navy fails (2.60:1).

## 9. Known traps (read before coding)
1. GH3 hook API ≠ GH2 builder API — don't write `Gesture.Pan()`.
2. `runOnJS` is deprecated.
3. Reanimated SET experimental — don't enable by default.
4. SDK 56 memory regression.
5. `useReducedMotion()` doesn't update live.
6. Layout animations inside FlashList break recycling.
7. Elevation on tiles tanks Android fps.
8. Debug builds mislead — measure release only.
9. `forceRTL` needs reload; keep state persisted.
10. Fake API's slow pages stall a fast fling → prefetch + pre-warm; report cold run honestly.
11. Don't put `key` inside FlashList items.
12. Expo Router changed substantially in SDK 56+; read current docs for transparent-modal/presentation options.
