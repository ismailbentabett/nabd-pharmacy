---
name: carousel-and-header
description: Home auto-play banner carousel (UI-thread, pause on touch, indicator) and collapsing search header (scroll-linked). Load for Home work.
---
Carousel: horizontal paging scroll (Animated scroll offset shared value); auto-advance via a timer that calls UI-thread `scrollTo` (or `scheduleOnUI`), interval ~4 s; pause on touch begin/drag, resume after 600 ms grace; pause when screen blurred/app background/screen reader/reduced motion. Indicator: pill dots; active segment width/opacity interpolated from scroll progress (transform scaleX preferred). RTL: index↔offset mapping flips; use `dir`. Looping: duplicate edges or reset silently only when off-screen. Parallax on banner art by translate only.
Header: scroll Y shared value → `interpolate` to collapse (title opacity, search height via transform/scale on a fixed-size container; avoid animating height if jank), clamp; snap to collapsed/expanded if scrolling stops mid-way (`onMomentumEnd` worklet). Status bar inset respected; background navy→blue; compact bar pinned.
