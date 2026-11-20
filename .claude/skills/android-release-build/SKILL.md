---
name: android-release-build
description: Building and installing a measurable Android RELEASE build with Expo SDK 58 (prebuild, signing for local, R8, splash, fonts, AOT). Load for build/perf runs.
---
1. `npx expo prebuild --platform android` (CNG; don't hand-edit `android/` beyond what plugins can't do; commit config plugins in `app.config.ts`).
2. `expo-build-properties`: `android.enableMinifyInReleaseBuilds: true`, `enableShrinkResourcesInReleaseBuilds: true`, `enablePngCrunchInReleaseBuilds: true`.
3. Fonts via `expo-font` config plugin (embedded). Native splash via `expo-splash-screen` plugin config.
4. Build/install: `npx expo run:android --variant release --device` (uses debug keystore for release locally — fine for measurement).
5. AOT: `adb shell cmd package compile -m speed -f <package>`; then force-stop, relaunch.
6. Verify it IS release: no dev menu/red box, bundle embedded, `adb shell dumpsys package <pkg> | grep -i debuggable` → not debuggable.
7. Record versions: `adb shell getprop ro.product.model`, `ro.build.version.release`, refresh rate (`dumpsys display | grep -i fps`).
8. Shareable APK (optional): `cd android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/`.
