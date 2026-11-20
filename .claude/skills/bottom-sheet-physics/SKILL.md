---
name: bottom-sheet-physics
description: Custom finger-tracking bottom sheet (snap points, velocity projection, rubber band, backdrop link, scroll handoff, interruption). Load when building the filter/sort sheet.
---
State: `translateY` shared value; snaps `[closed, half, full]` as Y offsets. Gesture: `usePanGesture` (verify API) on handle + header; content scroll hands off to sheet drag only when scrollY ≤ 0 and dragging down. Update: `y = clampRubber(startY + translationY)`; backdrop opacity = `interpolate(y, [closed, open], [0, 0.45], CLAMP)`. Release: `projected = y + velocityY*0.2`; target = nearest snap; `withSpring(target, {...spatialDefault, velocity: velocityY})`; close when target = closed (then unmount via `scheduleOnRN`). Interruptible: `cancelAnimation(y)` on begin. Android back closes. RTL-safe (vertical only). Reduced motion: timing 120 ms, no overshoot. a11y: dialog role, focus to title, announce open/close, explicit Close button. Don't re-render on drag.
