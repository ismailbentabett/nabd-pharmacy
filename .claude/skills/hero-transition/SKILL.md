---
name: hero-transition
description: Design and acceptance criteria for the grid-tile → product-image shared-element (hero) transition with interruptible gesture-driven back. Load when building or debugging Product navigation.
---
# Hero transition engine (ADR-004)
**Mechanism**: measure source tile rect (UI thread) → registry `{id, rect, uri, radius}` → navigate to `product/[id]` with transparent presentation → overlay layer renders the **cached tile image** at source rect and animates to the gallery frame using one `progress` shared value (0 → 1).
- Overlay style: `translateX/Y`, `scaleX/Y` (or width/height only on the overlay if scale distorts radius — measure!), `borderRadius` interpolated; destination content `opacity`/`translateY` bound to `progress`; grid tile hidden (`opacity 0`) while overlay is live to avoid double image.
- Open: `progress = withSpring(1, spatialDefault)` ≤ 320 ms effective. Close: reverse; **edge-swipe (start edge in current direction)** or vertical drag drives `progress` by finger (`1 − dx/width` style), release → velocity spring to 0 or 1 by projected end; any touch mid-flight `cancelAnimation` and takes over.
- Hi-res: gallery first image loads 800 px while the overlay shows the cached tile; swap without flash (`placeholder` = tile uri, same `recyclingKey`).
- Scroll safety: refresh the tile rect after scroll end; if the source tile is off-screen on return, animate to nearest edge/fade (never to a stale rect).
- RTL: swipe origin edge and translation sign × `dir`; hero grows toward mirrored layout.
- Reduced motion: 120 ms cross-fade, no scale/translate.
- Acceptance (all on release/device): 3 different tiles incl. last row; interrupt at 20/50/80 %; rapid open-back-open; no blank frame; UI FPS ≥ 58 during; RTL; reduced motion; back from Cart→Product→back lands correctly; Android system back/predictive back doesn't break it.
- Fallbacks: (B) `react-native-screen-transitions` Bounds; (C) simplified spring overlay without finger tracking. Document whichever ships.
- Don't use Reanimated SET (experimental) unless ADR changes.
