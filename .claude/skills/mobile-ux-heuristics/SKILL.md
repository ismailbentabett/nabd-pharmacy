---
name: mobile-ux-heuristics
description: Mobile UX principles for this app: thumb zone, hierarchy, feedback, forgiveness, consistency, density, perceived performance. Load when designing screens or reviewing flows.
---
- Thumb zone: primary actions in bottom 40 %; destructive actions away from primary; tab bar always reachable.
- Feedback ≤ 100 ms for every touch; show state change optimistically; never block on network to react.
- Forgiveness: undo over confirm dialogs; reversible actions; clear exits (back, close sheet by drag/backdrop/back button).
- Perceived performance: skeletons that match layout, placeholder → image fade, prefetch, optimistic UI, no layout shift.
- Hierarchy: one primary action per screen region; price and CTA dominant; consistent card anatomy.
- Consistency: same gesture = same meaning everywhere; same spring personality; same haptic for same event.
- Density: pharmacy shopping = scannable; 2-col grid tile shows image, 2-line name, price, rating, quick-add — nothing else.
- Language: plain, short, localized; error copy says what happened and what to do.
- Platform: respect Android back, edge-to-edge insets, ripple where natural.
- Test with one hand on the real phone.
