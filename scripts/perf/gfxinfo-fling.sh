#!/usr/bin/env bash
# F-01: janky frames over a 10 s fast fling through the Category grid (release build, real phone).
# Prepare: open the Category tab. For a "warm" run, fling to the bottom once first (loads all 50 pages and
# warms the image cache), then go back to the top. Turn the GPU/profile HUD off.
# Usage: bash scripts/perf/gfxinfo-fling.sh [label] [--surfaceflinger]     label e.g. warm | cold
#   MODE=down       (default) every swipe flings further down the grid, like a user hunting for a product
#   MODE=alternate  down, up, down, up... (keeps the list moving if 10 s reaches the end of the grid)
source "$(dirname "$0")/_common.sh"
require_device
require_release
LABEL="${1:-warm}"
MODE="${MODE:-down}"
F="$OUT/gfxinfo-fling-$LABEL-$(stamp).txt"
X=$((W / 2)); Y1=$((H * 80 / 100)); Y2=$((H * 25 / 100))
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
# SurfaceFlinger only collects frame stats once enabled; clear them so the dump covers this fling only.
if [ "${2:-}" = "--surfaceflinger" ]; then adb shell dumpsys SurfaceFlinger --timestats -enable -clear >/dev/null; fi
echo "▶ flinging for 10 s (label: $LABEL, mode: $MODE)"
END=$((SECONDS + 10)); i=0
while [ $SECONDS -lt $END ]; do
  if [ "$MODE" = "alternate" ] && [ $((i % 2)) -eq 1 ]; then
    adb shell input swipe $X $Y2 $X $Y1 120
  else
    adb shell input swipe $X $Y1 $X $Y2 120
  fi
  i=$((i + 1))
done
{ device_info; echo "--- label: $LABEL, mode: $MODE, swipes: $i"; adb shell dumpsys gfxinfo "$PKG" | tr -d '\r'; } > "$F"
if [ "${2:-}" = "--surfaceflinger" ]; then
  # awk, not head: head would exit early and pipefail would stop the script before it saves.
  adb shell dumpsys SurfaceFlinger --timestats -dump | tr -d '\r' | awk 'NR<=40' >> "$F"
  adb shell dumpsys SurfaceFlinger --timestats -disable >/dev/null
fi
echo "✔ saved $F"
grep -E "Total frames rendered|Janky frames|50th|90th|95th|99th|Number Missed Vsync|Number High input latency|Number Slow UI thread|Number Slow bitmap uploads|Number Slow issue draw" "$F" || true
echo "NOTE: copy the 'Janky frames' line into docs/PERF_LOG.md (F-01). Run it 3 times with 3 min rest between."
