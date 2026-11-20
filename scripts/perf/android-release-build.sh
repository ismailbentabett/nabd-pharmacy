#!/usr/bin/env bash
# Builds the RELEASE APK, installs it, AOT-compiles it and prints device info. Run it before any measurement.
# Usage: bash scripts/perf/android-release-build.sh [--demo]
#   (default)   fake API failure rate 0, so a 10 s fling never stops on an error row. Use this for numbers.
#   --demo      fake API failure rate 0.05 (D-05), so error and retry states show up. Use this for the video.
#   PERF_NO_DEVICE=1         build only; no phone needed, nothing is installed
#   PERF_SKIP_PATH_CHECK=1   skip the Windows path-length check
# Expo prebuild signs the release variant with the debug keystore, so adb can install it. It is still a
# release build: minified bundle, Hermes bytecode, not debuggable.
source "$(dirname "$0")/_common.sh"

CHAOS=0
MODE=perf
for arg in "$@"; do
  case "$arg" in
    --demo) CHAOS=0.05; MODE=demo ;;
    *) echo "✖ unknown option: $arg (use --demo or nothing)"; exit 1 ;;
  esac
done
# Read once at bundle time: Expo inlines process.env.EXPO_PUBLIC_* into the release bundle (src/state/api.ts).
export EXPO_PUBLIC_FAKE_API_CHAOS="$CHAOS"

if [ "${PERF_NO_DEVICE:-0}" != "1" ]; then require_device; fi

if [ "$IS_WINDOWS" = "1" ] && [ "${PERF_SKIP_PATH_CHECK:-0}" != "1" ]; then
  # The NDK's CMake ships ninja 1.10.2, which cannot create paths over 260 characters. The app module is
  # fixed by plugins/withShortObjectPaths.ts. Libraries with their own CMake build (reanimated) still name
  # objects after the absolute source path, so the project path counts twice there: the longest one is
  # 2 x root + 249 characters. subst drives and junctions do not help, because CMake resolves them back to
  # the long path. Verified working: a clone at C:\ad (docs/DECISIONS.md, ADR-040).
  MAX_ROOT=5
  root_win=$(cygpath -w "$ROOT")
  if [ "${#root_win}" -gt "$MAX_ROOT" ]; then
    echo "✖ the project path is ${#root_win} characters: $root_win"
    echo "  The Android native build on Windows needs $MAX_ROOT or fewer. Commit your work, then build from a short clone:"
    echo "    git clone \"$(cygpath -m "$ROOT")\" C:/ad && cd /c/ad && npm ci && bash scripts/perf/android-release-build.sh"
    exit 1
  fi
fi

if [ ! -d android ]; then
  echo "▶ generating the android/ project (expo prebuild)"
  npx expo prebuild --platform android --no-install
fi

if [ "$IS_WINDOWS" = "1" ] && [ -z "${JAVA_TOOL_OPTIONS:-}" ]; then
  # Gradle's daemon opens a Unix socket in %TEMP%. When Windows refuses it ("Unable to establish loopback
  # connection"), a socket folder inside the project works. android/ is gitignored.
  mkdir -p android/.udstmp
  export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$(cygpath -m "$ROOT/android/.udstmp")"
fi

ABI=arm64-v8a
if [ "${PERF_NO_DEVICE:-0}" != "1" ]; then ABI=$(prop ro.product.cpu.abi); fi

echo "▶ building the release APK ($MODE build, fake API failure rate $CHAOS, $ABI). The first build takes a while."
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$ABI" --console=plain)
APK=android/app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "✖ the build finished but $APK is missing"; exit 1; }

dirty=""
if [ -n "$(git status --porcelain)" ]; then dirty=" (plus uncommitted changes)"; fi
{
  echo "app commit: $(git rev-parse --short HEAD)$dirty"
  echo "fake API failure rate: $CHAOS ($MODE build)"
  echo "apk abi: $ABI"
  echo "apk size: $(wc -c < "$APK" | tr -d ' ') bytes"
  echo "built: $(date '+%Y-%m-%d %H:%M %Z')"
} > "$OUT/build-info.txt"
cat "$OUT/build-info.txt"
echo "✔ built $APK"

if [ "${PERF_NO_DEVICE:-0}" = "1" ]; then
  echo "PERF_NO_DEVICE=1: not installing. Later: adb install -r $APK"
  exit 0
fi

echo "▶ installing"
if ! adb install -r "$APK"; then
  echo "✖ install failed. If it says INSTALL_FAILED_UPDATE_INCOMPATIBLE, a build signed with another key is"
  echo "  installed. Remove it with: adb uninstall $PKG   then run this script again."
  exit 1
fi
echo "▶ AOT compile (so every run measures the same compiled code)"
adb shell cmd package compile -m speed -f "$PKG" || echo "⚠ compile failed (non-fatal)"
adb shell am force-stop "$PKG"
device_info | tee "$OUT/device-info.txt"
echo "✔ ready. Next: bash scripts/perf/cold-start.sh, then bash scripts/perf/gfxinfo-fling.sh"
