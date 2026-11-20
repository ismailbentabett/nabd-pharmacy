---
name: image-pipeline
description: Image URL sizing/bucketing, expo-image caching, placeholders, fade-once logic, prefetch and memory. Load when touching any image.
---
`imageUri(id, n, displayPx)` → bucket ≥ displayPx×min(DPR,2) in {160,240,320,480,640,800} → `https://picsum.photos/seed/${id}-${n}/${b}/${b}`. Tiles use tile bucket; hero/gallery use 800 (cap). Same URL string ⇒ cache hit ⇒ no flicker. `expo-image`: `cachePolicy="memory-disk"`, `recyclingKey`, `placeholder={{blurhash}}`, `transition` only when URL not in a module-level `seen` Set (add on `onLoad`); `contentFit="cover"`. Prefetch: first 2 pages on boot (idle), next page's first row on scroll. Memory: don't hold bitmaps in state; clear nothing manually (let cache evict); verify flat PSS after 2 passes. Never request larger than displayed.
