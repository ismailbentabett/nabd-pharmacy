---
name: react-native-engineering
description: Core React Native (New Architecture, Hermes, Android-first) engineering rules: rendering, threads, bridgeless, platform quirks, project hygiene. Load for any RN code.
---
- New Architecture only (Fabric, TurboModules, bridgeless). Hermes. Don't use deprecated Animated `useNativeDriver:false` paths; prefer Reanimated.
- Think in threads: JS (React), UI (native + Reanimated worklets), native modules. Keep JS thread free during scroll/gestures; heavy work → precompute at data layer, not in render.
- Android first: test on the real device; mind overdraw (no elevation on tiles), `renderToHardwareTextureAndroid` only for short-lived animated layers, `removeClippedSubviews` unnecessary with FlashList, status/navigation bar edge-to-edge (SDK 58 default) → `react-native-safe-area-context` insets everywhere, back-button handling.
- Use `Pressable` (RNGH `Pressable` where Reanimated flags demand). No `TouchableOpacity` in new code. `StyleSheet.create` outside components; no inline style objects in hot paths.
- Text: set `allowFontScaling` default; avoid fixed heights; `numberOfLines` + `ellipsizeMode`.
- Don't block startup: lazy-load non-critical, no work at import time, no large JSON parse on launch (generate pages lazily).
- Dependencies: only what's needed; each added dep must be explainable in the live session. Install via `npx expo install`. Run `npx expo-doctor`.
- Never ship `console.log`; use a tiny `log` util stripped in release. No `any`; no `@ts-ignore` without comment.
- Error boundaries at route level; designed fallback UI.
