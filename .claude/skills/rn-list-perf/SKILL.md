---
name: rn-list-perf
description: FlashList v2 + expo-image performance rules for the 1,000-product grid and rails. Load when touching Category, Home rails, ProductTile, image URLs or state subscriptions.
---
# List & image performance
- FlashList v2: `numColumns={2}`, `keyExtractor={p=>p.id}`, `getItemType`, **no `estimatedItemSize`**, no `key` inside items, `drawDistance` tuned by measurement, `onEndReachedThreshold≈2`, plus prefetch when index > loaded−40.
- `ProductTile`: memo'd, receives primitives (`id,name,priceLabel,uri,...`) not objects that change identity; no inline closures (compiler helps, still check); precompute `priceLabel`/`discountLabel` once in the selector; ≤ ~12 views per tile; **no elevation/shadow**, hairline border.
- Press feedback: `Pressable` scale 0.97 via shared value (UI thread), ≤ 100 ms.
- Images (`expo-image`): `cachePolicy="memory-disk"`, `recyclingKey={id}`, `placeholder={blurhash}`, `transition={160}` **only first load** (use a seen-set so scroll-back doesn't re-fade), `contentFit="cover"`, sized URL via `imageUri(id,n,px)` bucketed {160,240,320,480,640,800}, `priority` normal for tiles / high for hero. Prefetch next page's first-row images.
- State: tiles never subscribe to the cart. Cart badge subscribes to `selectCount` only. Use zustand selectors with `useShallow` where arrays/objects are selected.
- Rails (Home): FlashList `horizontal`, fixed card width, same tile rules.
- Verify with React DevTools highlight / dev render counter; add-to-cart on Category must re-render 0 tiles.
- If janky: profile first (Perfetto/gfxinfo), change one thing, log in `docs/PERF_LOG.md`.
