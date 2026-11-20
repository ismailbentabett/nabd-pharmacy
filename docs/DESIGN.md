# DESIGN — system, motion language, anti-slop rules

Goal: reads as a **shipped product by a senior team**, not a template. Pharmacy/health-retail: trustworthy, clean, calm, quick. Palette is given; our craft is spacing, type, hierarchy, density, and motion.

## 1. Colour tokens (semantic; components never use raw hex)
| Token | Light | Dark (optional) | Use |
|---|---|---|---|
| `brand.navy` | `#0F2554` | `#0F2554` | headers, primary text on light |
| `brand.blue` | `#1B3577` | `#1B3577` | secondary actions, selected states |
| `brand.gold` | `#FEC627` | `#FEC627` | **fill only** (CTA, badge, active indicator) with navy text |
| `bg.app` | `#F5F6FA` | `#0B1530` | screen background |
| `bg.surface` | `#FFFFFF` | `#121E3F` | cards, sheets |
| `text.primary` | `#0F2554` | `#E8ECF8` | |
| `text.muted` | `#5B6589` | `#AEB6D3` | secondary (AA on bg & surface) |
| `line.hairline` | `#E4E7F0` | `#243158` | borders (decorative only, not text) |
| `state.danger` | `#C42B3A` | `#FF6B78` | delete, errors, out of stock |
| `state.success` | `#17784A` | `#4ADE9A` | in stock, added |
| `state.warn` | `#B45309` | `#FEC627` | low stock |
| `on.gold` | `#0F2554` | `#0B1530` | text on gold |

**Verified contrast** (`node scripts/contrast.mjs`): navy/bg 13.76 · navy/white 14.86 · blue/white 11.52 · muted/white 5.73 · muted/bg 5.30 · navy on gold 9.43 · white on blue 11.52 ·
danger/white 5.59 · success/white 5.49 · warn/white 5.02 · dark: text 15.28 · muted 8.13 · gold 10.38.
**FAIL, never do:** gold as text on light (1.58), muted on navy (2.60), blue on navy (1.29), `#8A93B0` as text (3.05; icons/placeholders only if non-essential), hairline as text.
Gold usage budget: max one gold element prominent per screen region (CTA, active tab indicator, price highlight chip). It's an accent, not wallpaper.

## 2. Typography
IBM Plex Sans (Latin) + IBM Plex Sans Arabic, embedded natively (no async load flash). Scale (sp → px at 1×): Display 28/34 · Title 22/28 · Heading 18/24 · Body 15/22 · Label 13/18 · Caption 12/16, Arabic: same sizes but **line-height ×1.15 min** (body ≥ 24) and optically +1px. Weights: 400/500/600 (avoid 700+ mush). Numerals: prices tabular (`fontVariant: ['tabular-nums']`) so the totals don't jitter when animating. Text follows the system font scale up to a cap of 1.5× (`MAX_FONT_SCALE`, ADR-037) and must not clip anywhere up to that cap (test at 1.3× and at the largest setting on device).
Digits policy lives in `src/i18n/format.ts` only (Western digits for prices/qty in both languages; Arabic-Indic digits optional only for `nameAr` content copy as supplied).

## 3. Spacing, shape, elevation
4-pt grid; common: 4, 8, 12, 16, 20, 24, 32. Screen gutter 16. Grid gap 12. Radii: tile 16, chip 999, sheet 24 (top), button 14, image 12. **No Android `elevation`/shadow on grid tiles** (it forces extra render passes on mid-range GPUs) — use 1px hairline border + surface colour; single soft shadow allowed only on sheet and floating tab bar, pre-rendered via a bordered surface rather than live elevation if jank is observed. No glass/blur. No gradients except one subtle navy→blue on the Home header and banner art.

## 4. Components catalogue (all in `ui/` or `design/`)
Pressable (scale 0.97 + opacity, ≤ 100 ms feedback, ripple on Android where it reads well), Button (primary gold/navy-text, secondary outline, ghost), IconButton (48dp hit), Chip (selected = navy fill/white text), Badge (gold fill navy text, tabular), PriceBlock (price, strikethrough old price muted, discount % chip in danger-tint), RatingStars (SVG, half stars, count), StockPill, Skeleton (shimmer on UI thread, reduced-motion = static; image blocks carry a still 16 % brand-mark watermark, ADR-052), LaunchVeil (splash carried into React, lifts in 460 ms when Home lays out, ADR-052), Toast/Undo bar, BottomSheet, EmptyState, ErrorState, QuantityStepper, PageDots (animated width/opacity pill indicator).
Icons: lucide only; directional ones (chevron, arrow, back) mirror in RTL via `useDirection`. Cart icon, heart, search, filter, sort, trash, plus, minus, check, truck.

## 5. Layout patterns by screen (thumb zone: primary actions in lower 40%)
- **Home**: header (navy→blue) with greeting row (location chip "Riyadh", language toggle, cart shortcut none—tab exists) + search field that **collapses** (height 56→44, title fades, field pins under status bar). Banner carousel 16:7 with rounded 20 corners and **pill page indicator**. Category rail: circular 64dp icon tiles + 12sp label (8 categories, tap → Category with that filter preselected). Best sellers: 156dp-wide cards with rating, price, quick-add `+` (gold).
- **Category**: sticky compact bar [title · count · Filter/Sort button with active-filter dot]. 2-col grid, tile = square image (rounded 12), name 2 lines max, brand muted, price block, rating, quick-add. Footer = skeleton row while loading / retry row on failure.
- **Product**: full-bleed gallery (aspect 1:1) with dots, back button (mirrors), fav slot reserved (do **not** build heart on `main`; see live-session plan). Body: brand, name, rating, price block, VAT note ("Prices include 15% VAT"), stock pill, short description (EN/AR copy), delivery line (truck + "Free delivery over 100 SAR"). Sticky bottom bar: quantity stepper + gold "Add to cart" (shows total).
- **Cart**: rows (image 72, name, brand, stepper, line price), swipe-to-delete reveals danger surface with trash; after delete, Undo bar (5 s) slides from bottom above tab bar. Summary card: Subtotal (excl. VAT) · VAT 15% · **Total (SAR)** with tabular animated digits; free-delivery progress bar (display only). Empty state: illustration (SVG, original) + "Browse categories" CTA.

## 6. Motion language (physical, calm, fast; one personality everywhere)
Springs (mass 1; `damping = ζ·2·√k`): **spatialFast** k800 ζ0.6 → 33.9 · **spatialDefault** k380 ζ0.8 → 31.2 · **spatialSlow** k200 ζ0.8 → 22.6 · **effectsFast** k3800 ζ1 → 123.3 · **effectsDefault** k1600 ζ1 → 80 · **effectsSlow** k800 ζ1 → 56.6. Starting points — tune on the real device; record final values in ADR-006.
Timing: micro 100–150 ms, standard 200–250 ms, hero ≤ 320 ms (budget: < 350). Easing for timing fallbacks: `Easing.bezier(0.2, 0, 0, 1)` (emphasised decelerate).
Rules: (1) motion explains cause/effect (where did it come from / go); (2) every gesture-driven motion is interruptible and velocity-continuous; (3) entrance > exit in prominence, exits ≤ 150 ms; (4) stagger ≤ 30 ms steps, max 6 items, never on scroll-recycled rows; (5) one motion at a time gets the spotlight; (6) reduce-motion = swap movement for opacity/instant; haptics still fire (selection/impact-light) unless system haptics off; (7) nothing animates layout properties per frame.

## 7. Anti-slop checklist (`ui-designer` uses this literally)
**Never**: emoji as icons · lorem/“Product 42”/“Item” names · identical card rows with no hierarchy · centre-aligned everything · more than 2 font families · >3 font weights · gradient everywhere / purple-blue AI gradient · stock "glassmorphism" · drop shadows on every card · gold text on white · inconsistent radii · mixed icon styles/stroke widths · fake “analytics” widgets · placeholder buttons that do nothing · dead scroll areas · layout shift when images/prices load · spinner-only loading · English strings in Arabic mode · mirrored numerals/logos · raw error text ("Network request failed").
**Always**: real bilingual product copy with fictional brands · consistent 4-pt rhythm · optical alignment of icons/text · skeletons matching final layout · pressed/disabled/focus states for every control · tabular numbers for money · 48dp targets · empty+error states designed (not defaults) · Arabic proofread by a human (flag in `_prep/START_HERE.md`) · a settled, intentional gold budget.
**Squint test**: blur the screenshot — primary action and price must still be the two loudest things.

## 8. Copy & content
Fictional brands only (e.g., VitaWell, NordaCare, Dermaluxe, BabyNest, FitFuel, Aroma Nuur, HairRoots, PharmaPlus-style generic). No real trademarks. Names combine brand + type + size/variant: “VitaWell Vitamin C 1000 mg, 60 tablets” / “فيتاويل فيتامين سي ١٠٠٠ ملغ، ٦٠ قرصاً”. Medicines screen shows OTC-style items only and **no medical claims**. Seeds in `docs/fixtures/catalog-seed.json`; UI strings in `docs/fixtures/copy.json`.

## 9. Dark mode (stretch, only after everything else is ✅)
Semantic tokens make it a theme swap; follow system via `useColorScheme`; images get a 0.9 opacity overlay only if too bright; verify contrast with the dark column above.
