---
name: a11y-and-reduced-motion
description: Accessibility floor and reduced-motion behaviour for every control and animation. Load when building any interactive component or animation.
---
- Touch targets ≥ 48dp (`hitSlop` where visuals are smaller). `accessibilityRole`, `accessibilityLabel` (localised, from dictionary), `accessibilityState` (selected/disabled), `accessibilityValue` for stepper/qty, live-region announcements for add/remove/undo (`AccessibilityInfo.announceForAccessibility`).
- Carousel: pause auto-play when screen reader on; indicator not announced noisily; each slide labelled "Promotion i of n".
- Contrast per `docs/DESIGN.md`. Font scaling to 1.3× without clipping (no fixed heights on text containers).
- Reduced motion (system setting): no translate/scale/parallax/auto-advance; use ≤ 120 ms opacity or instant; sheet snaps without spring; skeleton static; hero cross-fade; haptics unaffected. Provide `useMotionPreference()` that reads `AccessibilityInfo.isReduceMotionEnabled()` and subscribes to `reduceMotionChanged`.
- Test with TalkBack once on device (basic traversal of each screen).
