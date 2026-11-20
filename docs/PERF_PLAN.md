# PERF PLAN — how we prove F-01…F-10 (release build, real mid-range Android)

**Golden rules**: release build only · real phone (Pixel 6a / Galaxy A54 class; note exact model + OS + build type) · screen brightness fixed, battery > 30 %, **not charging over USB during FPS runs if possible** (use wireless adb), thermal state cool (rest 3 min between runs), airplane mode off (images need network; or warm cache first), all dev overlays/HUD off, no other apps, Do-Not-Disturb on · 3 runs each, report **median and worst** · honest misses go in the README.

## What & how
| Target | Tool | Command / method | Pass |
|---|---|---|---|
| F-01 janky frames, 10 s fling | `dumpsys gfxinfo` | `scripts/perf/gfxinfo-fling.sh` (reset → scripted fast swipes for 10 s → dump) | Janky frames < 1 %; also p90/p95/p99 frame time |
| F-01 fps view | Flashlight + Maestro | `scripts/perf/flashlight.sh` (10 iterations, 10 s) | avg UI FPS ≥ 58 (60 Hz) ; screenshot of report |
| 120 Hz devices | `dumpsys SurfaceFlinger --timestats` | `scripts/perf/gfxinfo-fling.sh --surfaceflinger` | note refresh rate honestly |
| F-04 transition | Perfetto / Android Studio profiler **or** gfxinfo reset→one transition→dump | `scripts/perf/transition-gfxinfo.sh` | 0 janky frames during hero; duration ≤ 350 ms (video frame count: 60 fps video → ≤ 21 frames) |
| F-07 cold start | `am start -W` ×10 after `force-stop` | `scripts/perf/cold-start.sh` | TotalTime median < 2000 ms; plus time-to-first-product-visible (Maestro `assertVisible`) |
| F-08 memory | `dumpsys meminfo` samples | `scripts/perf/memory-scroll.sh` (baseline → fling down/up ×2 → settle 10 s → sample) | PSS after pass 2 ≈ after pass 1 (within ~5–8 %), no monotonic climb across 3 repeats |
| F-03 touch feedback | slow-mo video (240 fps phone cam) | tap tile/CTA, count frames until visual response | ≤ 100 ms (≤ 24 frames @240) |
| F-05 rerenders | React DevTools Profiler / dev render counters | add to cart while on grid: tiles must not re-render | 0 tile renders |

## Protocol details
1. **Build**: `scripts/perf/android-release-build.sh` (prebuild if needed → `expo run:android --variant release`), AOT warm: `adb shell cmd package compile -m speed -f <pkg>`.
2. **Pre-warm data**: open Category, fling to bottom once so all pages (and images) are cached; return to top. Report the *cold* (un-warmed) run too.
3. **Fling**: `adb shell input swipe` with short duration produces high velocity; the script alternates down/up swipes for 10 s. Keep coordinates in the grid's safe area.
4. **Record**: raw outputs into `docs/evidence/raw/` (committed), screenshots into `docs/evidence/`, summary table into `docs/PERF_LOG.md` and README.
5. **If a target misses**: profile (Perfetto), fix the biggest offender, re-measure, keep the before/after in `PERF_LOG.md`. Typical suspects: image decode sizes, tile re-renders, JS-thread work in `renderItem`, elevation/shadows, `onScroll` JS handlers, too many animated components, unsized images, FlatList-style inline lambdas, layout animations in the list.
6. **Never** quote a number you did not measure. Unmeasured → `NOT MEASURED YET`.

## Candidate optimisations backlog (apply only if measurement says so)
`getItemType` per layout variant · fewer views per tile (flatten) · drop `borderRadius` clipping on image container using expo-image `contentFit` + radius on image · `drawDistance` tuning · `recyclingKey` · avoid inline objects/functions (compiler helps) · precomputed `priceLabel` strings per item · lower `transition` duration · prefetch window · Reanimated flags (ADR-012) · R8/shrink (already) · Baseline Profile · `renderToHardwareTextureAndroid` for animated overlay only during transition · reduce simultaneous animated components (<100).
