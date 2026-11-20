# PERF LOG — real measurements only

> **Everything below is `NOT MEASURED YET` until a run is done on the real device.** Do not fill with estimates. The README's performance table is generated from this file by hand — copy exact numbers.

## Device & build (fill once)
| Field | Value |
|---|---|
| Device model | NOT MEASURED YET |
| Android version / build | |
| SoC / RAM / refresh rate | |
| App build | release APK (`scripts/perf/android-release-build.sh`, built from `C:\ad`), commit `<sha>` — see `evidence/raw/build-info.txt` |
| Date / battery / thermal | |

## Results (median of 3 · worst in brackets)
| ID | Metric | Target | Result | Pass? | Evidence |
|---|---|---|---|---|---|
| F-01 | Janky frames, 10 s grid fling (warm cache) | < 1 % | NOT MEASURED YET | | `evidence/raw/gfxinfo-fling-warm-<stamp>.txt` |
| F-01 | Same, cold (unwarmed) | report | NOT MEASURED YET | | `evidence/raw/gfxinfo-fling-cold-<stamp>.txt` |
| F-01 | Avg UI FPS (Flashlight) | ≥ 58 @60 Hz | NOT MEASURED YET | | `evidence/flashlight-report.png` |
| F-04 | Hero transition janky frames / duration | 0 janky, ≤ 350 ms | NOT MEASURED YET | | `evidence/raw/transition-gfxinfo-<stamp>.txt` + `evidence/transition-profile.png` |
| F-07 | Cold start TotalTime (median of 10) | < 2000 ms | NOT MEASURED YET | | `evidence/raw/cold-start-<stamp>.txt` |
| F-07 | Time to first product visible | report | NOT MEASURED YET | | screen recording, frame count |
| F-08 | PSS after pass 1 → pass 2 | flat (±8 %) | NOT MEASURED YET | | `evidence/raw/memory-<stamp>.txt` |
| F-03 | Touch feedback latency | ≤ 100 ms | NOT MEASURED YET | | slow-mo clip |
| F-05 | Tile re-renders on add-to-cart | 0 | NOT MEASURED YET | | `evidence/rerender-profile.png` (dev build, labelled) |

## Optimisation journal (before → after, each with the command used)
| Date | Problem seen | Change | Before | After | Kept? |
|---|---|---|---|---|---|
| | | | | | |

## Honest misses (copy to README "Known limits")
- _(none recorded yet)_
