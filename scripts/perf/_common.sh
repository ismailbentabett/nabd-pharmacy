#!/usr/bin/env bash
# Shared helpers for the perf scripts (docs/PERF_PLAN.md). Source it, then call require_device and,
# for measurements, require_release. Works in macOS/Linux bash and in Git Bash on Windows.
#   PKG=com.x.y            app id (default: the one in app.config)
#   ANDROID_SERIAL=<id>    pick a phone when more than one is attached (adb reads it too)
#   PERF_ALLOW_EMULATOR=1  let the scripts run on an emulator (the numbers do not count, F-10)
set -euo pipefail

# Always run from the repo root, so OUT and the android/ folder resolve the same way from anywhere.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PKG="${PKG:-com.nabd.pharmacy}"
OUT="${OUT:-docs/evidence/raw}"
mkdir -p "$OUT"

# Git Bash rewrites arguments that look like POSIX paths; adb arguments must reach the phone as typed.
export MSYS_NO_PATHCONV=1

IS_WINDOWS=0
case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) IS_WINDOWS=1 ;; esac

# Find the Android SDK in the usual folders. Gradle needs it (ANDROID_HOME, or sdk.dir in
# android/local.properties, which a fresh prebuild does not write), and adb is often not on PATH.
to_posix() { if command -v cygpath >/dev/null 2>&1; then cygpath -u "$1"; else printf '%s' "$1"; fi; }
SDK_DIR=""
for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "${LOCALAPPDATA:-}/Android/Sdk" \
  "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
  [ -n "$sdk" ] || continue
  if [ -d "$(to_posix "$sdk")/platform-tools" ]; then SDK_DIR="$(to_posix "$sdk")"; break; fi
done
if [ -n "$SDK_DIR" ]; then
  if [ -z "${ANDROID_HOME:-}" ]; then
    if [ "$IS_WINDOWS" = "1" ]; then export ANDROID_HOME="$(cygpath -m "$SDK_DIR")"; else export ANDROID_HOME="$SDK_DIR"; fi
  fi
  if ! command -v adb >/dev/null 2>&1; then PATH="$SDK_DIR/platform-tools:$PATH"; fi
fi

stamp() { date +%Y%m%d-%H%M%S; }
prop() { adb shell getprop "$1" | tr -d '\r'; }

# Exactly one real phone must be attached (or ANDROID_SERIAL must name one). Sets W, H and SIZE.
require_device() {
  command -v adb >/dev/null 2>&1 || {
    echo "✖ adb not found. Install Android platform-tools or set ANDROID_HOME to your SDK folder."
    exit 1
  }
  local devices
  devices=$(adb devices | tr -d '\r' | awk 'NR>1 && $2=="device" {print $1}')
  if [ -z "$devices" ]; then
    echo "✖ no device. Connect a REAL phone with USB debugging on, accept the prompt, then run: adb devices"
    exit 1
  fi
  if [ -z "${ANDROID_SERIAL:-}" ] && [ "$(printf '%s\n' "$devices" | wc -l | tr -d ' ')" -gt 1 ]; then
    echo "✖ more than one device attached. Pick one: export ANDROID_SERIAL=<serial>"
    printf '  %s\n' $devices
    exit 1
  fi
  if [ "$(prop ro.kernel.qemu)" = "1" ] || [ "$(prop ro.boot.qemu)" = "1" ]; then
    if [ "${PERF_ALLOW_EMULATOR:-0}" != "1" ]; then
      echo "✖ this is an emulator. Emulator numbers do not count (F-10). Use a real phone."
      exit 1
    fi
    echo "⚠ emulator allowed by PERF_ALLOW_EMULATOR=1: these numbers must not go into PERF_LOG."
  fi
  # "Physical size: 1080x2400", then "Override size: ..." if one is set; the last line is what is drawn.
  SIZE=$(adb shell wm size | tr -d '\r' | tail -1 | sed 's/.*: //')
  W=${SIZE%x*}
  H=${SIZE#*x}
}

# The app must be installed and must be a release build: debug builds do not count (F-10).
require_release() {
  local pkg_dump
  pkg_dump=$(adb shell dumpsys package "$PKG" | tr -d '\r')
  if ! printf '%s' "$pkg_dump" | grep -q "versionName"; then
    echo "✖ $PKG is not installed. Run: bash scripts/perf/android-release-build.sh"
    exit 1
  fi
  if printf '%s' "$pkg_dump" | grep -m1 -E '^ *flags=' | grep -q DEBUGGABLE; then
    echo "✖ the installed $PKG is a debug build. Install the release build: bash scripts/perf/android-release-build.sh"
    exit 1
  fi
}

device_info() {
  echo "model: $(prop ro.product.manufacturer) $(prop ro.product.model)"
  echo "android: $(prop ro.build.version.release) (SDK $(prop ro.build.version.sdk))"
  echo "build: $(prop ro.build.display.id)"
  echo "abi: $(prop ro.product.cpu.abi)"
  echo "screen: $SIZE"
  echo "refresh: $(adb shell dumpsys display | tr -d '\r' | grep -m1 -oE 'fps=[0-9.]+' || echo unknown)"
  echo "app: $PKG $(adb shell dumpsys package "$PKG" | tr -d '\r' | grep -m1 -oE 'versionName=[^ ]+' || true)"
  if adb shell dumpsys package "$PKG" | tr -d '\r' | grep -m1 -E '^ *flags=' | grep -q DEBUGGABLE; then
    echo "build type: DEBUG (does not count)"
  else
    echo "build type: release"
  fi
  if [ -f "$OUT/build-info.txt" ]; then cat "$OUT/build-info.txt"; fi
}
