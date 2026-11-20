# API_NOTES — verified against INSTALLED node_modules (2026-11-16)

Tags: VERIFIED(types) = read from .d.ts; VERIFIED(src) = read from JS/TS source; UNVERIFIED = not proven at runtime.
Paths are relative to `node_modules/`. Web docs were unavailable; node_modules is the source of truth.
Installed: RNGH 3.3.0, worklets 0.13.0, reanimated 4.7.1, flash-list 2.3.2, expo-image 58.0.18, expo-router 58.0.31,
mmkv 4.3.2, expo-font 58.0.12, expo-build-properties 58.0.12, expo-splash-screen 58.0.14, expo-haptics 58.0.8,
expo-localization 58.0.5, lucide-react-native 1.73.0, react-query 5.107.1, zustand 5.1.0, RN 0.88.1.

## 1. Gesture Handler 3.3.0  (react-native-gesture-handler/lib/typescript/v3/**)
```ts
import { GestureHandlerRootView, GestureDetector, usePanGesture, useTapGesture, useNativeGesture,
  useLongPressGesture, useFlingGesture, useSimultaneousGestures, useExclusiveGestures, useCompetingGestures,
  Pressable, ScrollView, FlatList } from 'react-native-gesture-handler';
```
- `usePanGesture(config?: PanGestureConfig): PanGesture`; `useTapGesture(config?)`; `useNativeGesture(config?)`. VERIFIED(types)
- Callbacks: `onBegin, onActivate, onUpdate, onDeactivate, onFinalize, onTouchesDown/Move/Up/Cancel`. Tap has NO `onUpdate`. VERIFIED(types)
- Event payload is FLAT (no `nativeEvent`): `e.translationX, e.translationY, e.velocityX, e.velocityY, e.changeX, e.x, e.absoluteX`
  (translation/velocity/change only on onUpdate/onActivate/onDeactivate). `onDeactivate/onFinalize` also get `{canceled}`. VERIFIED(types)
- Pan config: `minDistance, minPointers, maxPointers, minVelocity(X/Y), activateAfterLongPress, activeOffsetX/Y, failOffsetX/Y
  (number | [number, number]), averageTouches`. Tap: `numberOfTaps, maxDuration(500), maxDelay(500), maxDistance, maxDeltaX/Y`.
  Common: `enabled, hitSlop, shouldCancelWhenOutside, manualActivation, runOnJS, disableReanimated, simultaneousWith, requireToFail, block`.
  Any config value may be a SharedValue. VERIFIED(types)
- Relations take the hook RETURN VALUE (not a tag): `usePanGesture({ requireToFail: tap })`.
- `<GestureDetector gesture={pan}>child</GestureDetector>`; composed: `useSimultaneousGestures(a,b)`.
- Auto-workletize: worklets babel plugin workletizes arg 0 of `use*Gesture` ONLY for inline callbacks in the object literal.
  A named function reference needs `'worklet'`. `runOnJS: true` forces JS-thread callbacks. VERIFIED(src: react-native-worklets/plugin)
- TRAPS: legacy `Gesture.Pan()` builder and `Legacy*` / `PanGestureHandler` are STILL exported - never use them.
  RNGH `Pressable` (v3) has `onPress/onPressIn/onPressOut/onLongPress/android_ripple/hitSlop/disabled`, style/children may be functions.
- Jest: `react-native-gesture-handler/jestSetup.js`. VERIFIED(src)

## 2. worklets 0.13.0  (react-native-worklets/lib/typescript/threads.native.d.ts)
```ts
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
scheduleOnRN(fn, a, b);   // call JS fn from a worklet; args are SEPARATE params
scheduleOnUI(worklet, a); // run worklet on UI runtime
```
- `scheduleOnUI<Args, R>(worklet: (...args: Args) => R, ...args: Args): void`; `scheduleOnRN<Args, R>(fun, ...args: Args): void`. VERIFIED(types)
- Both fire-and-forget (no return). `runOnJS/runOnUI/runOnUIAsync/runOnUISync` still exported but DEPRECATED.
- Reanimated does NOT re-export `scheduleOnRN` - import from `react-native-worklets`.
- Static flags in app package.json key `worklets.staticFeatureFlags`. Supports RN 0.86-0.88. VERIFIED(src)
- Jest mock: `react-native-worklets/src/mock.ts` exists (has both fns); no root `mock.js`. Import path UNVERIFIED at runtime.

## 3. Reanimated 4.7.1  (react-native-reanimated/src/**)
```ts
import Animated, { useSharedValue, useAnimatedStyle, useDerivedValue, useAnimatedReaction, useAnimatedRef,
  useAnimatedScrollHandler, useScrollOffset, useFrameCallback, useReducedMotion, withSpring, withTiming, withDecay,
  withDelay, withSequence, withRepeat, cancelAnimation, interpolate, interpolateColor, Extrapolation, Easing,
  measure, scrollTo, ReduceMotion, ReducedMotionConfig, LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
```
- `withSpring(to, cfg?, cb?)`; cfg is EITHER `{stiffness, damping, mass, velocity, overshootClamping, energyThreshold, reduceMotion}`
  OR `{duration, dampingRatio, clamp:{min,max}}` - mixing = TYPE ERROR. Default = Gentle preset (mass 4, damping 120, stiffness 900).
  `duration` is perceptual (real ~1.5x). Presets exported: `GentleSpringConfig, SnappySpringConfig, WigglySpringConfig`. VERIFIED(src)
- `withTiming(to, {duration=300, easing=Easing.inOut(Easing.quad), reduceMotion}, cb?)`; easing must be a worklet. `Easing.bezier()` returns a factory object; `Easing.bezierFn()` returns a function.
- `withDecay({velocity, deceleration=0.998, clamp:[min,max], rubberBandEffect, rubberBandFactor=0.6})`; `rubberBandEffect` requires `clamp`.
- `cancelAnimation(sv)`; `Extrapolation.CLAMP/EXTEND/IDENTITY` (`Extrapolate` deprecated); `interpolate(v, inRange, outRange, Extrapolation.CLAMP)`.
- `useAnimatedScrollHandler({onScroll,onBeginDrag,onEndDrag,onMomentumBegin,onMomentumEnd}, deps?)`; `useScrollOffset(ref)` (old `useScrollViewOffset` deprecated alias).
- `useFrameCallback(cb({timestamp,timeSincePreviousFrame,timeSinceFirstFrame}), autostart=true)` returns `{setActive,isActive,callbackId}`.
- `measure(ref): {x,y,width,height,pageX,pageY} | null` (worklet only). `useAnimatedRef<T>()` resolves FlashList's scrollable node.
- Reduce motion: `ReduceMotion.System|Always|Never`; per-animation `reduceMotion` option; `<ReducedMotionConfig mode={ReduceMotion.System}/>`.
  `useReducedMotion()` reads value at app start only - does NOT update on later system change. VERIFIED(src)
- Layout builders: `.duration() .delay() .springify() .damping() .stiffness() .dampingRatio() .withCallback() .reduceMotion()`.
  `LinearTransition` animates originX/Y/width/height (list gap-closing; cart only).
- Feature flags (app `package.json` key `reanimated.staticFeatureFlags`, needs native rebuild). Defaults:
  `ENABLE_SHARED_ELEMENT_TRANSITIONS:false` (must enable for SharedTransition API), `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS:true`,
  `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS:true`, `USE_ANIMATION_BACKEND:false`, `USE_LEGACY_LAYOUT_ANIMATIONS_PROXY:false`,
  `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS:false`, `DISABLE_COMMIT_PAUSING_MECHANISM:false`. Build fails if
  (LEGACY_PROXY && SHARED_ELEMENTS) or (ANIMATION_BACKEND && FORCE_REACT_RENDER). Source: `src/featureFlags/staticFlags.json`.
- Jest: `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` (root `mock.js` exists); UNVERIFIED at runtime. Pure cart tests need none.

## 4. FlashList 2.3.2  (@shopify/flash-list/dist/*.d.ts)
```ts
import { FlashList, FlashListRef, useRecyclingState, useLayoutState, useMappingHelper } from '@shopify/flash-list';
```
- `estimatedItemSize` / `estimatedListSize` DO NOT EXIST. VERIFIED(types)
- Props: `data, renderItem({item,index,target,extraData}), keyExtractor(item,index)=>string, numColumns, getItemType, drawDistance,
  extraData, horizontal, inverted, masonry, overrideItemLayout({span},item,index,maxColumns,extraData), maxItemsInRecyclePool,
  onEndReached, onEndReachedThreshold(0.5), onStartReached, onViewableItemsChanged, viewabilityConfig, ListHeader/Footer/EmptyComponent,
  ItemSeparatorComponent, CellRendererComponent, onLoad({elapsedTimeInMs}), maintainVisibleContentPosition{...}`.
- Ref: `useRef<FlashListRef<T>>(null)`; methods `scrollToIndex({index,animated}):Promise<void>, scrollToOffset, scrollToTop, scrollToEnd,
  getScrollableNode, getFirstVisibleIndex, computeVisibleIndices, recordInteraction, prepareForLayoutAnimationRender`.
- `useRecyclingState(initial|()=>T, deps, onReset?) : [T, set]` - per-item state that resets on recycle.
- `AnimatedFlashList` export is RN core `Animated`, NOT Reanimated.
- TRAP: FlashList calls `props.onScroll` as plain JS (RecyclerView.tsx). For a Reanimated scroll handler use
  `Animated.createAnimatedComponent(FlashList)` or `useAnimatedRef` + `useScrollOffset(ref)`. Mechanism VERIFIED(src); runtime UNVERIFIED.
- Layout animations inside FlashList items are forbidden (project rule).
- Jest: `@shopify/flash-list/jestSetup.js`.

## 5. expo-image 58.0.18  (expo-image/build/Image.types.d.ts)
```tsx
import { Image } from 'expo-image';
<Image source={{uri}} placeholder={{blurhash}} contentFit="cover" placeholderContentFit="cover"
  transition={{ duration: 200, skipOnCacheHit: 'all' }} recyclingKey={id} cachePolicy="memory-disk" priority="normal" />
```
- `transition`: `number | {duration, timing, effect, skipOnCacheHit: 'none'|'memory'|'all'}`; `skipOnCacheHit` = fade first time, instant on scroll-back (C-02).
- `placeholderContentFit` defaults to `'scale-down'` - set it equal to `contentFit` to avoid a jump.
- `cachePolicy`: `'none'|'disk'|'memory'|'memory-disk'` (default `'disk'`). `recyclingKey` for FlashList. `allowDownscaling` default true.
  `decodeFormat: 'argb'|'rgb'` (Android; rgb = RGB_565). `onLoad` payload has `cacheType: 'none'|'disk'|'memory'` and `source:{url,width,height,mediaType}`.
- `Image.prefetch(urls: string|string[], cachePolicy?: 'disk'|'memory-disk'|'memory'): Promise<boolean>`. Also `clearMemoryCache, clearDiskCache, loadAsync`.
- Blurhash placeholder: object with a `blurhash` string (plus optional width/height); a string beginning "blurhash:/" is also parsed. VERIFIED(types)

## 6. expo-router 58.0.31  (expo-router/build/**)
- NO `@react-navigation/*` installed: Expo Router vendors it (`expo-router/build/react-navigation/*`). Do not install/import them.
- `Tabs` from `'expo-router'` is `@deprecated`. Use `import { Tabs } from 'expo-router/js-tabs'` (JS tabs, custom `tabBar` supported).
  Other entry points: `expo-router/js-stack`, `expo-router/native-tabs` (NativeTabs), `expo-router/unstable-native-tabs`.
  `Stack` from `'expo-router'` is the NATIVE stack. VERIFIED(types: build/layouts/Tabs.d.ts)
- Custom tab bar: `tabBar={(props: BottomTabBarProps) => ...}`. Props are `{ state:{index,routes}, descriptors, emitter, navigateToTab(routeKey), insets }`.
  There is NO top-level `navigation`; it is `descriptors[route.key].navigation`. Press:
  `const e = emitter.emit({type:'tabPress', target: route.key, canPreventDefault:true}); if(!focused && !e.defaultPrevented) navigateToTab(route.key);`
- Tab options: `tabBarLabel, tabBarIcon, tabBarBadge, tabBarAccessibilityLabel, tabBarButton, tabBarStyle, lazy, freezeOnBlur,
  popToTopOnBlur, sceneStyle, animation('none'|'fade'|'shift'), headerShown`. `Tabs.Screen`, `Tabs.Protected`.
- Native-stack options: `presentation('card'|'modal'|'transparentModal'|'containedTransparentModal'|'fullScreenModal'|'formSheet'|'pageSheet')`,
  `animation('default'|'fade'|'fade_from_bottom'|'flip'|'simple_push'|'slide_from_bottom'|'slide_from_right'|'slide_from_left'|'ios_from_right'|'ios_from_left'|'none')`,
  `animationDuration` (iOS only), `gestureEnabled, fullScreenGestureEnabled, animationMatchesGesture, contentStyle, headerShown, statusBarTranslucent`.
- Hooks: `useRouter()` returns `{back, canGoBack, push, navigate, replace, dismiss, dismissTo, dismissAll, setParams, prefetch}`;
  `useLocalSearchParams<T>()`, `useGlobalSearchParams`, `useNavigation`, `useFocusEffect(stableCallback)`, `useIsFocused`, `usePathname`,
  `useSegments`, `usePreventRemove(prevent, cb?, opts?)`, `useScrollToTop`, `useTheme`, `ThemeProvider`, `DefaultTheme`, `DarkTheme`.
- Shared element (P-01) is NOT provided by the router; Reanimated `SharedTransition` needs `ENABLE_SHARED_ELEMENT_TRANSITIONS:true` (section 3) - spike it.

## 7. react-native-mmkv 4.3.2  (react-native-mmkv/src/*)
```ts
import { createMMKV, useMMKVString, useMMKVBoolean, useMMKVNumber, useMMKVObject } from 'react-native-mmkv';
const storage = createMMKV({ id: 'app' });  // NOT new MMKV()
storage.set('k', 'v'); storage.getString('k'); storage.getBoolean('k'); storage.getNumber('k'); storage.remove('k'); storage.getAllKeys();
```
- `MMKV` is a TYPE only. Config: `{id, path, encryptionKey, encryptionType, mode, readOnly, compareBeforeSet, recoveryStrategy}`.
- Reads return `undefined` if missing. Requires `react-native-nitro-modules` (installed). Auto-mock under Jest (`JEST_WORKER_ID`). VERIFIED(src)

## 8. expo-font plugin 58.0.12 + IBM Plex  (expo-font/plugin/build/withFonts.d.ts, plugin/src/withFontsAndroid.ts)
```json
["expo-font", { "fonts": [
  "./node_modules/@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-sans-arabic/500Medium/IBMPlexSansArabic_500Medium.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold/IBMPlexSansArabic_600SemiBold.ttf" ] }]
```
- Props: `{fonts?: string[]; android?: {fonts?: Font[]}; ios?: {fonts?: string[]}}`; top-level `fonts` applies to both. Dirs expand; only ttf/otf/woff/woff2 kept; Android loads ttf/otf only.
- String entries go to `assets/fonts/`; the `fontFamily` used in styles is the FILE BASENAME (`IBMPlexSans_400Regular`). VERIFIED(src); files VERIFIED(on disk)
- Object form `{fontFamily, fontDefinitions:[{path, weight, style}]}` generates res/font XML so ONE family name maps weights. Duplicate weight+style throws.
- Runtime check: `Font.isLoaded(family)`; `Font.loadAsync` only needed for non-embedded fonts.
- Gotcha: with the string form use one family name per weight (`fontFamily: 'IBMPlexSans_600SemiBold'`), not `fontWeight`. Arabic family must be chosen explicitly per direction.

## 9. expo-build-properties 58.0.12  (expo-build-properties/build/pluginConfig.d.ts)
```json
["expo-build-properties", { "android": {
  "enableMinifyInReleaseBuilds": true, "enableShrinkResourcesInReleaseBuilds": true, "enablePngCrunchInReleaseBuilds": false,
  "extraProguardRules": "...", "minSdkVersion": 24, "usesCleartextTraffic": false, "useLegacyPackaging": false } }]
```
- Names EXACT: `enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds` (use with minify), `enablePngCrunchInReleaseBuilds` (default true). VERIFIED(types)
- Also present: `compileSdkVersion, targetSdkVersion, kotlinVersion, packagingOptions, enableBundleCompression`.
- `newArchEnabled` option NOT FOUND (New Arch only). Hermes: only `useHermesV1?: boolean` (default true; false requires `buildReactNativeFromSource`). No `hermes` option. VERIFIED(types)
- Shared config can be top-level or per `android`/`ios` (platform value wins).

## 10. expo-splash-screen 58.0.14  (expo-splash-screen/build/*.d.ts, plugin/build/types.d.ts)
```ts
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync(): Promise<boolean>;
SplashScreen.hideAsync(): Promise<void>;   // also hide(): void (sync)
SplashScreen.setOptions({ duration?: number, fade?: boolean }): void;
```
- Plugin props: `backgroundColor` (default #ffffff), `image`, `imageWidth` (default 100), `resizeMode: 'contain'|'cover'|'native'`,
  `enableFullScreenImage_legacy`, `android: {backgroundColor,image,mdpi..xxxhdpi,imageWidth,resizeMode,dark:{...}}`,
  `ios: {backgroundColor,image,tabletBackgroundColor,tabletImage,dark}`, `dark: {backgroundColor, image}`. VERIFIED(types)
- Current app.json uses backgroundColor `#208AEF` (template default) - change to Navy `#0F2554` before recording.
- F-07: do not hold the splash waiting on data; hide on first Home layout.

## 11. expo-haptics 58.0.8  (expo-haptics/build/Haptics.d.ts, Haptics.types.d.ts)
```ts
import * as Haptics from 'expo-haptics';
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);              // Light|Medium|Heavy|Soft|Rigid
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Success|Warning|Error
Haptics.selectionAsync();
Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
```
- `performAndroidHapticsAsync(type: AndroidHaptics)` EXISTS. `AndroidHaptics`: `Confirm, Reject, Gesture_Start, Gesture_End, Toggle_On, Toggle_Off,
  Clock_Tick, Context_Click, Drag_Start, Keyboard_Tap/Press/Release, Long_Press, Virtual_Key(_Release), No_Haptics, Segment_Tick, Segment_Frequent_Tick, Text_Handle_Move`. VERIFIED(types)
- All return Promise<void>; JS thread only (call via `scheduleOnRN` from worklets). Don't await in gesture paths.

## 12. Reload / expo-localization / I18nManager
```ts
import { reloadAppAsync } from 'expo';  // reloadAppAsync(reason?: string): Promise<void>
import { getLocales } from 'expo-localization'; // getLocales(): [Locale, ...Locale[]]
```
- `Locale` fields include `languageTag, languageCode|null, languageScriptCode, regionCode, languageRegionCode, currencyCode, languageCurrencyCode,
  digitGroupingSeparator, textDirection: 'ltr'|'rtl', measurementSystem`. `getLocales()[0].textDirection` is the system direction. VERIFIED(types)
- `reloadAppAsync` VERIFIED(src): Android native is `expo-modules-core/.../CoreModule.kt` -> `reactDelegate.reload()`. Works in debug and release, needs no
  updates infrastructure. It resolves before the reload happens, so put no logic after it. `expo-updates` was removed (ADR-026).
- I18nManager (RN 0.88, `react-native/Libraries/ReactNative/I18nManager.js`, VERIFIED(src)):
  `allowRTL(bool)`, `forceRTL(bool)`, `swapLeftAndRightInRTL(bool)`, consts `isRTL`, `doLeftAndRightSwapInRTL`, `getConstants()` returns `{isRTL, doLeftAndRightSwapInRTL, localeIdentifier}`.
  `isRTL` is read ONCE at module load; `forceRTL` takes effect only after native restart/reload. Project rule: components use `useDirection()`, never I18nManager.
- G-08 implication: the language switch needs a full app reload for native RTL (gestures/transitions); budget the restart UX.
- expo-localization plugin RTL, VERIFIED(src) `expo-localization/android/.../LocalizationModule.kt`: with the default config
  (`supportsRTL` true, `forcesRTL` false) it applies `allowRTL(true)`/`forceRTL(false)` only when the config value changes
  (SharedPreferences keys `supportsRTLSetByConfig`/`forcesRTLSetByConfig`), i.e. on first launch. Later launches keep whatever the app
  set with `I18nManager`, so our `forceRTL(true)` survives restarts. Android: `isRTL = allowRTL && (forceRTL || device locale is RTL)`,
  so switching to English must call `allowRTL(false)` too. ADR-031.
- @testing-library/react-native 14.1.0 (`dist/render-hook.d.ts`, `dist/render.d.ts`), VERIFIED(types): `render()` and `renderHook()` are
  ASYNC (`await renderHook(fn, { wrapper })`); `rerender`/`unmount` return promises too.

## 13. lucide-react-native 1.73.0  (lucide-react-native/dist/types/lucide-react-native.d.ts)
```tsx
import { House, ShoppingCart, LayoutGrid, Search, SlidersHorizontal, Minus, Plus, Trash2, ChevronLeft, ChevronRight,
  Star, X, Check, Languages, MapPin, Truck, Heart } from 'lucide-react-native';
<Heart size={24} color="#0F2554" strokeWidth={2} absoluteStrokeWidth />
```
- All 18 requested names exist (both `Home` and `House`; prefer `House`). `LucideProps`: `size?: number|string, color?: string, strokeWidth?: number, absoluteStrokeWidth?: boolean` + SVG props. VERIFIED(types)
- Requires `react-native-svg`. Package `exports` has `./icons/*` deep imports; whether they cut bundle size is UNVERIFIED.
- Favourite fill: pass SVG `fill` prop; animated fill via Reanimated `createAnimatedComponent` is UNVERIFIED.

## 14. @tanstack/react-query 5.107.1  (@tanstack/query-core/build/modern/hydration-9_kOYxJM.d.ts)
```ts
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
const q = useInfiniteQuery({
  queryKey: ['products', category, sort], queryFn: ({ pageParam }) => api.page(pageParam), initialPageParam: 0,
  getNextPageParam: (lastPage, allPages, lastPageParam, allPageParams) => lastPage.nextPage ?? undefined,
  placeholderData: keepPreviousData, retry: 1, staleTime: 5 * 60_000, gcTime: 10 * 60_000 });
q.fetchNextPage({ cancelRefetch: false }); q.isFetchNextPageError; q.isFetchingNextPage; q.hasNextPage;
```
- `initialPageParam` REQUIRED. `getNextPageParam` returns `TPageParam | undefined | null` (undefined/null = no more pages). VERIFIED(types)
- `FetchNextPageOptions.cancelRefetch` defaults TRUE: repeated `onEndReached` cancels the in-flight page; pass `{cancelRefetch:false}` to dedupe. VERIFIED(types)
- `isFetchNextPageError` exists on the result. `keepPreviousData` exported from root. `maxPages` option exists.
- `data` is `InfiniteData<Page>` = `{pages, pageParams}`; flatten with `useMemo` for FlashList `data`.

## 15. zustand 5.1.0  (zustand/package.json exports, zustand/react/shallow.d.ts)
```ts
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';   // also re-exported from 'zustand/shallow'
const ids = useCart(useShallow((s) => s.items.map((i) => i.id)));
```
- `useShallow<S,U>(selector: (s:S)=>U): (s:S)=>U`. Selectors that return new arrays/objects loop without it in v5. VERIFIED(types)
- Use curried `create<State>()((set, get) => ({...}))`; subscribe with selectors `useCart((s) => s.count)`.

## Conflicts / updates for docs/RESEARCH.md
- RESEARCH.md: "Babel plugin handled by babel-preset-expo" - babel-preset-expo passes `reanimated`/`worklets` options (build/index.js L167-168), consistent. No babel.config.js exists yet; confirm auto-add at first build (UNVERIFIED at runtime).
- ADD: `Tabs` import is `expo-router/js-tabs` (root export deprecated); no @react-navigation packages; RNGH payload flat; Reanimated `ENABLE_SHARED_ELEMENT_TRANSITIONS` default false; `cancelRefetch` default true; MMKV v4 uses `createMMKV`.
