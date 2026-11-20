---
name: reanimated-motion-rules
description: Rules and patterns for Reanimated 4 + worklets + Gesture Handler 3 in this project. Load before writing or reviewing any animation, gesture, scroll-linked effect or transition.
---
# Reanimated 4 / Worklets / RNGH 3 rules
1. **Verify APIs first** (docs-verifier). GH3 is a hook API (`usePanGesture`, `useTapGesture`, …; `onActivate/onDeactivate`; relations via hook options). Don't write `Gesture.Pan()`. Don't mix builder + hooks.
2. **UI thread only.** Shared values + worklets. No `setState` per frame. Never read `sv.value` on JS in render/effects. JS side effects (haptics, navigation, state commits) via `scheduleOnRN(fn, ...args)` from `react-native-worklets`, only for discrete events. `runOnJS/runOnUI` are deprecated.
3. **Animate transform, opacity, backgroundColor.** Never width/height/top/left/margin per frame. Border radius only on the small hero overlay.
4. **Interruptible**: on gesture begin `cancelAnimation(sv)`; release with `withSpring(target, { ...spring, velocity })`; clamp + rubber-band: `y > max ? max + (y-max)*0.35 : y`.
5. **Snap by projected end**: `projected = pos + velocity * 0.2`; choose nearest snap to `projected`.
6. **Tokens only**: import from `src/motion/springs.ts` (spatialFast/Default/Slow, effectsFast/Default/Slow). No inline `damping: 17`.
7. **Reduced motion**: every effect has a fallback (opacity/instant). Use our `useMotionPreference()` (reads `AccessibilityInfo` + listener) — `useReducedMotion()` alone doesn't update live. `ReducedMotionConfig` at root.
8. **Layout animations** (`entering/exiting/layout`) only in the non-virtualised Cart. Stable keys. Never in FlashList items.
9. **Counters**: shared value → animated text props, not React state.
10. **Limits**: < 100 animated components visible; share one shared value across many derived styles instead of one per item.
11. **RTL**: multiply horizontal translations/thresholds by `dir`.
12. **Flags**: don't toggle Reanimated feature flags without a measured before/after (ADR-012).
13. **Comment for the reader**: each gesture file starts with a 6–10 line "how it works" comment.
## Patterns
```ts
// sheet drag (illustrative; confirm hook signature with docs-verifier)
const y = useSharedValue(CLOSED);
const pan = usePanGesture({ onUpdate: e => { y.value = clampWithRubber(start.value + e.translationY) },
  onDeactivate: e => { y.value = withSpring(snapTo(y.value + e.velocityY*0.2), { ...springs.spatialDefault, velocity: e.velocityY }) } });
```
Frame-based effects: `useFrameCallback` only for the perf HUD and carousels if needed; keep callbacks tiny.
