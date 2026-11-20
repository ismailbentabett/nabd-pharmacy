---
name: debugging-rn
description: Systematic debugging for RN/Expo on Android: logcat, red screens, Metro, native builds, Reanimated/gesture issues, release-only bugs. Load when something breaks.
---
1) Reproduce in release if jank/memory related. 2) `adb logcat -s ReactNative ReactNativeJS AndroidRuntime` (filter by pid). 3) Check versions with `npx expo-doctor`; mismatched native deps are the #1 cause. 4) Clean: `npx expo prebuild --clean` (never `rm -rf`; use `git clean` only with human OK). 5) Reanimated issues: confirm worklets package/babel preset, check flags, test with one animation. 6) Gesture issues: ensure `GestureHandlerRootView` at root, check hook API usage. 7) Layout issues: Layout Inspector / `adb shell uiautomator dump`. 8) Perf: Perfetto, gfxinfo. 9) Bisect with git. 10) Write the root cause in the commit message. Don't paper over with timeouts.
