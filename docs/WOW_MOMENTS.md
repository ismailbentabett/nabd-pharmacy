# Signature moments — the details that make Nabd feel shipped

Rule: wow = **craft + physics + proof**, not extra screens. Each moment has an owner requirement, an acceptance test, and a reduced-motion fallback. Build in priority order; cut from the bottom, never from the top.

## Tier 1 — must be flawless (this is 55 % of the score: Animation 30 + Performance 25)
1. **Hero transition (P-01, F-04)** — the tile's *actual cached image* lifts out of the grid, grows to the gallery frame on a spring, corners morph 16→0 (overlay only), the rest of the page rises under it. Edge-swipe/drag back drives it by finger; release with velocity; touching mid-flight catches it. Works in RTL (swipe from the *right* edge, grows toward the mirrored layout). ✔ Accept: back-swipe at 50 % then reverse → no flash, no jump; ≤ 320 ms; 60 fps in profiler; no blank frame when the hi-res image loads (placeholder = cached tile image).
2. **Grid that never stutters (C-01/02, F-01/05/06/08)** — 1,000 items, FlashList v2, sized images, fade-in 160 ms once, no re-fade on recycle/scroll-back (cache hit = no transition), prefetch ahead so a 10 s fling never reaches an unloaded page. ✔ Accept: gfxinfo < 1 % janky, memory flat after 2 passes, numbers in README.
3. **Filter/sort sheet that feels like iOS-grade physics (C-03)** — finger-tracking, rubber-band beyond limits, velocity-projected snap between closed / half / full, backdrop opacity bound to translateY, content scroll hands off to sheet drag at top, interruptible mid-snap. ✔ Accept: grab during settle → picks up with no jump.
4. **Cart that feels alive (K-01..04)** — swipe row reveals danger action with haptic tick at threshold, row collapses (height + fade) while the rest slides up (LinearTransition), Undo bar restores the row *in its original position*, stepper with haptics, totals as **rolling tabular digits** updating in the same frame as the tap. ✔ Accept: totals correct vs `cart-vectors.json`; no layout jump on undo.
5. **Add-to-cart choreography (P-03)** — button press-scale (<100 ms) → morph to ✓ ("Added") → a thumbnail "flies" along an arc into the cart tab icon → badge bumps (scale 1→1.35→1 spring + haptic) → button returns. Everything ≤ 400 ms, parallel not sequential. Reduced-motion: badge count swaps with a 120 ms fade, button label swaps.
6. **RTL that is truly mirrored (G-08)** — one tap flips the whole app live (Plan A) or via a fast state-preserving reload (Plan B): layout, tab order, carousel direction, sheet origin, swipe-to-delete direction, hero edge-swipe, chevrons; numbers/prices stay LTR-correct. Arabic typography actually set (Plex Sans Arabic, proper line height).

## Tier 2 — the "senior team" polish layer
7. **Collapsing search header (H-01)** that morphs (title fades, field shrinks, pinned under status bar) and snaps to a resting state if released mid-collapse.
8. **Banner carousel (H-02)** — UI-thread auto-advance, pill indicator whose active segment *stretches* with scroll progress, pause on touch / when screen blurred / app backgrounded, resumes with a 600 ms grace; parallax on banner art (translate only).
9. **Image delight** — dominant-colour/blurhash placeholder per product (deterministic from seed), 160 ms fade only on first load.
10. **Skeletons that match layout** (shimmer on UI thread) and **designed error rows** with Retry (the 1-in-20 failure is a feature demo, not a bug).
11. **Haptics vocabulary** — selection (stepper, tab), impact-light (add, sheet snap), notification-warning (delete threshold). One module, one table.
12. **Free-delivery nudge** in cart: progress bar toward 4,000 DA with animated fill (display only; no backend).

## Tier 3 — only after Tier 1+2 are ✅ and measured
13. Dark mode (semantic tokens). 14. Shared header-to-compact tab bar hide on scroll-down in Category (translate only). 15. Baseline Profile for faster cold start. 16. Maestro-recorded smoke flows saved in `scripts/perf/flows/`.

## Things we deliberately do NOT do (scope + risk)
No real payments, no analytics SDKs. No Lottie (bundle + a second animation runtime). No blur. No confetti. No "AI recommendations". No gimmicks that cost frames.

## Proof pack (judges love evidence; it is 10 % README + 25 % perf)
`docs/evidence/`: profiler screenshot of 10 s fling, profiler screenshot of one hero transition, gfxinfo output, memory-before/after table, cold-start numbers, device photo (model/OS visible in About), 2–3 min screen recording script (see `_prep/DEVICE_RUNBOOK.md`).
