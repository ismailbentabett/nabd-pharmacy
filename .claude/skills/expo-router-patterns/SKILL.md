---
name: expo-router-patterns
description: Expo Router (SDK 58) file-based routing, tabs, custom tab bar, transparent/stack presentation for the hero transition, params and deep links. Load for navigation work. Always verify against current docs.
---
- Re-verify current Router docs (SDK 56+ changed internals): tabs layout, custom `tabBar`, stack `presentation` options (`transparentModal`/`containsTransparentContent`), `animation: 'none'` when our overlay owns the motion, `router.push/back`, typed routes, `useLocalSearchParams`.
- Routes are thin: compose feature components, no business logic. `product/[id]` takes only `id` (+ optional `fromRect` kept in the hero registry, not in URL).
- Custom tab bar: three tabs, animated icon/indicator, cart badge subscribing only to `selectCount`, RTL order via normal flex row (auto mirrors), hides behind product route.
- Android back: product back = hero reverse; sheet open → back closes sheet first; tab back follows default.
- Preserve tab state (Category scroll position + filters) when switching tabs (don't unmount heavy lists unnecessarily; `lazy` for first mount only).
- Splash: native splash hidden once Home's first content is ready (not JS-managed splash delay).
