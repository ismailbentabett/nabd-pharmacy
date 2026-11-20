#!/usr/bin/env bash
# F-07: cold-start TotalTime, 10 runs with a force-stop before each. Reports the median.
source "$(dirname "$0")/_common.sh"
require_device
require_release
F="$OUT/cold-start-$(stamp).txt"
device_info > "$F"
ACT=$(adb shell cmd package resolve-activity --brief "$PKG" | tr -d '\r' | tail -1)
case "$ACT" in
  */*) ;;
  *) echo "✖ could not find the launch activity of $PKG (got: '$ACT')"; exit 1 ;;
esac
vals=()
for i in $(seq 1 10); do
  adb shell am force-stop "$PKG"; sleep 2
  t=$(adb shell am start -W -n "$ACT" | tr -d '\r' | grep -E "TotalTime" | grep -oE '[0-9]+' || true)
  [ -n "$t" ] || { echo "✖ run $i: no TotalTime in 'am start -W' output"; exit 1; }
  echo "run $i TotalTime=${t}ms" | tee -a "$F"; vals+=("$t"); sleep 2
done
med=$(printf '%s\n' "${vals[@]}" | sort -n | awk '{a[NR]=$1} END{print (NR%2)?a[(NR+1)/2]:(a[NR/2]+a[NR/2+1])/2}')
echo "median TotalTime: ${med} ms" | tee -a "$F"
echo "✔ saved $F"
echo "NOTE: TotalTime = launch to the activity's first frame. Also record time to first product visible"
echo "      (slow-motion video, or Maestro assertVisible on 'best-sellers'), and paste both into docs/PERF_LOG.md (F-07)."
