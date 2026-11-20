#!/usr/bin/env bash
# F-08: memory must be flat after scrolling the whole grid down and up, twice.
# Prepare: Category tab visible at the top. Say in PERF_LOG whether the image cache was warm or cold.
#   SWIPES=70   swipes per direction per pass. Check one pass really reaches the last product
#               (1,000 items = 500 rows); raise it if it doesn't.
source "$(dirname "$0")/_common.sh"
require_device
require_release
SWIPES="${SWIPES:-70}"
F="$OUT/memory-$(stamp).txt"
X=$((W / 2)); Y1=$((H * 80 / 100)); Y2=$((H * 25 / 100))
pss() { adb shell dumpsys meminfo "$PKG" | tr -d '\r' | grep -m1 -E "TOTAL PSS|TOTAL:" | grep -oE '[0-9]+' | awk 'NR==1'; }
pass() {
  for _ in $(seq 1 "$SWIPES"); do adb shell input swipe $X $Y1 $X $Y2 80; done
  sleep 2
  for _ in $(seq 1 "$SWIPES"); do adb shell input swipe $X $Y2 $X $Y1 80; done
  sleep 2
}
{ device_info; echo "--- swipes per direction: $SWIPES"; } > "$F"
echo "baseline PSS (KB): $(pss)" | tee -a "$F"
pass; sleep 8; echo "after pass 1 PSS (KB): $(pss)" | tee -a "$F"
pass; sleep 8; echo "after pass 2 PSS (KB): $(pss)" | tee -a "$F"
adb shell dumpsys meminfo "$PKG" | tr -d '\r' >> "$F"
echo "✔ saved $F"
echo "NOTE: flat = pass 2 within about 8% of pass 1. Repeat 3 times and paste all three into docs/PERF_LOG.md (F-08)."
