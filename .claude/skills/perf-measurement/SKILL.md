---
name: perf-measurement
description: Protocol for measuring FPS/jank, cold start, memory and transitions on a real Android release build, and recording results honestly. Load before any perf claim.
---
Read `docs/PERF_PLAN.md`. Never estimate. Steps: (1) `adb devices` — if none, stop and tell the human which commands to run from `_prep/DEVICE_RUNBOOK.md`. (2) Build release via `scripts/perf/android-release-build.sh`, AOT compile. (3) Fixed conditions (brightness, DND, cool device, HUD off). (4) Run scripts (`gfxinfo-fling.sh`, `flashlight.sh`, `cold-start.sh`, `memory-scroll.sh`, `transition-gfxinfo.sh`) ×3; keep raw output in `docs/evidence/raw/`. (5) Fill `docs/PERF_LOG.md` with median/worst + device/OS/build. (6) Misses → profile, fix top offender, re-measure, journal before/after. (7) README copies numbers verbatim.
