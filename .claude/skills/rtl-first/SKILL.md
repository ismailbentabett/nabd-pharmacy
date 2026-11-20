---
name: rtl-first
description: RTL/Arabic rules for layout, gestures, transitions, icons, numerals, fonts and the language-switch strategy. Load for any UI or gesture work.
---
# RTL-first
- One abstraction: `useDirection()` → `{ dir: 1|-1, isRTL }`. Never read `I18nManager` in components.
- Layout: `marginStart/End`, `paddingStart/End`, `start/end` insets, `alignItems: 'flex-start'`, `flexDirection: 'row'` (auto-flips). Never `left/right/marginLeft/marginRight` for layout. Absolute positioning uses `start/end`.
- Gestures/transitions: every horizontal translation, threshold and snap sign × `dir`; swipe-to-delete reveals from the **end** edge (left in RTL); hero edge-swipe starts at the start edge; carousel index↔offset mapping flips; FlashList 2-col order mirrors.
- Icons: mirror chevrons/arrows/back/"next"; don't mirror search, cart, plus/minus, check, trash, logos. Implement `<DirIcon>` wrapper with `mirror` prop.
- Text: Plex Sans Arabic; line-height ≥ 1.6 for body; +1px optical; `textAlign: 'auto'`; numerals/prices via `format.ts` (tabular); isolate mixed text (`⁨…⁩`) for product names with Latin brands.
- Switching: Plan A instant (Yoga `direction` + context) or Plan B `forceRTL` + persisted state + `reloadAsync` (ADR-005). Persist locale/cart/tab/prefs (MMKV).
- Test matrix per screen × {LTR, RTL} × {gesture}: tab order, grid, rails, carousel, header collapse, sheet, hero, delete swipe, toast position, badge position (end-top of cart icon).
- Check after navigation round trips (stale LTR bugs).
