#!/usr/bin/env bash
# F-04: frames during ONE hero transition (grid tile -> product -> back).
# Prepare: Category grid visible, the tile you want at a known position.
# Usage: bash scripts/perf/transition-gfxinfo.sh [tileX tileY]   (default: first row, start-side tile)
source "$(dirname "$0")/_common.sh"
require_device
require_release
TX="${1:-$((W / 4))}"; TY="${2:-$((H * 45 / 100))}"
F="$OUT/transition-gfxinfo-$(stamp).txt"
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
adb shell input tap "$TX" "$TY"; sleep 1.2
adb shell input keyevent KEYCODE_BACK; sleep 1.2
{ device_info; echo "--- tap: $TX,$TY"; adb shell dumpsys gfxinfo "$PKG" | tr -d '\r'; } > "$F"
echo "✔ saved $F"
grep -E "Total frames rendered|Janky frames|90th|95th|99th" "$F" || true
echo "NOTE: in Arabic the start-side tile is on the right: pass its x yourself."
echo "      Also capture a Perfetto / Android Studio profiler screenshot of the transition"
echo "      (docs/evidence/transition-profile.png) and count video frames (21 frames at 60 fps = 350 ms)."
