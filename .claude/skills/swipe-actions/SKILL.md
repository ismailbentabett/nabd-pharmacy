---
name: swipe-actions
description: Swipe-to-delete row (reveal, threshold haptic, collapse, undo) in the Cart, RTL-aware. Load when building CartRow.
---
Row translates on X with `usePanGesture` (activate after ~10 px horizontal, fail on vertical to let the list scroll). Delete direction is the **end** edge: sign = `-dir`. Reveal danger background + trash; at 40 % width fire `Haptics.impact` once (guard flag); release: past threshold or fast fling → animate off-screen (≤ 180 ms), then `scheduleOnRN(remove)`; else spring back. Collapse: parent uses `exiting={FadeOut}`/`LinearTransition` so siblings close the gap. Undo: store `lastRemoved{line,index}`; Undo bar slides up (5 s); undo reinserts at index with `entering` animation. Also expose accessible "Delete" action via `accessibilityActions`. Reduced motion: no slide; instant remove with fade. Cart only (non-virtualised).
