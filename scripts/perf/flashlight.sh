#!/usr/bin/env bash
# F-01, second view: Flashlight + Maestro (average UI FPS, CPU, RAM) over a 10 s scroll, 10 iterations.
# Needs: Flashlight (https://docs.flashlight.dev) and Maestro (https://maestro.mobile.dev) installed.
source "$(dirname "$0")/_common.sh"
require_device
require_release
command -v flashlight >/dev/null || { echo "✖ flashlight not installed (see https://docs.flashlight.dev)"; exit 1; }
command -v maestro >/dev/null || { echo "✖ maestro not installed (https://maestro.mobile.dev)"; exit 1; }
flashlight test --bundleId "$PKG" --testCommand "maestro test scripts/perf/flows/scroll-grid.yaml" \
  --iterationCount 10 --duration 10000 --resultsFilePath "$OUT/flashlight-results.json"
echo "▶ opening the report (screenshot it to docs/evidence/flashlight-report.png)"
flashlight report "$OUT/flashlight-results.json"
