---
description: Run the real-device performance protocol and fill docs/PERF_LOG.md with measured numbers only.
---
Load skill `perf-measurement`. Check `adb devices`; if none, print the exact steps from `_prep/DEVICE_RUNBOOK.md` for the human and stop. Otherwise build release, AOT compile, run all scripts ×3, store raw outputs in `docs/evidence/raw/`, fill `docs/PERF_LOG.md` (median/worst, device/OS/build). On misses: profile, fix top offender, re-measure, journal. Never estimate.
