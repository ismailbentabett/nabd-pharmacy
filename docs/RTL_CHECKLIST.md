# RTL verification checklist (G-08)

Run this on the real phone with the release build, once in English and once in Arabic. Switch with the
"ع" / "EN" button in the Home header. The app reloads behind a navy veil (ADR-005); after the reload,
check you land on a clean Home with the cart contents kept.

How to read an item: **Correct** is what you should see; **Bug** is the usual way it goes wrong.
"Start" means the side where reading begins: left in English, right in Arabic.

Mark each line EN / AR when it passes. Anything failing goes into `docs/PLAN.md` as a task, with a clip.

## 0. The switch itself

| Item | Correct | Bug |
|---|---|---|
| Press the toggle | Pressed dip and a light tick at once; navy veil fades over the whole screen including the tab bar in about 150 ms; the app restarts into the other language | Tab bar stays visible over the veil; a flash of the old language after the restart; nothing happens for a second |
| Double tap fast | One switch only | Two reloads, or the app lands in the original language |
| Cart survives | Items and quantities are as before the switch | Empty cart after the restart |
| Delete then switch at once | The deleted line stays deleted, no undo bar after the restart | Undo bar reappears, or the line comes back |
| Round trips | EN to AR to EN to AR: every screen is correct each time | Second switch leaves one screen mirrored wrongly ("stale LTR") |
| Reduce motion on | Veil still fades (about 120 ms), no scale on the toggle press | Veil cuts in with no fade, or the app freezes |

## 1. Tab bar

| Item | Correct | Bug |
|---|---|---|
| Order | English: Home, Category, Cart from the left. Arabic: Home on the right, then Category, Cart toward the left | Same left-to-right order in Arabic |
| Indicator slide | Moves toward the newly selected tab in the correct physical direction (Arabic: tapping Cart slides it leftwards) | Slides the wrong way, or jumps without sliding |
| Cart badge | Sits at the top end corner of the cart icon (top right in English, top left in Arabic) | Badge on the same physical side in both languages, overlapping the neighbouring tab |
| Badge bump | Scales in place, no sideways drift | Pivots around a corner |
| Labels | Arabic labels in IBM Plex Sans Arabic, not clipped at large font size | Labels truncated or fallback system font |

## 2. Home

| Item | Correct | Bug |
|---|---|---|
| Header collapse | Scrolling up shrinks the header to the compact bar; greeting and search stay aligned to the start edge; toggle is at the end edge | Search icon or text on the wrong side; compact bar jumps at the end of the collapse |
| Toggle position | Top end corner of the navy header | Overlaps the greeting |
| Banner swipe | Page 1 is at the start edge. English: finger moves left to reach page 2. Arabic: page 1 is on the right, page 2 is to its left, so the finger moves right | Arabic pages laid out left to right, so the finger must move left to advance |
| Banner autoplay | Advances the way a manual swipe to the next page would (Arabic: content slides rightwards, the next banner comes in from the left) | Autoplay slides the opposite way to a manual swipe; wrap-around from last to first runs backwards |
| Banner pause | Holding a finger on it pauses autoplay in both languages | Resumes while touched |
| Page dots | The sliding pill sits under the current page; page 1 dot is at the start edge | Pill is at the left while the first page is on the right (pill moves the wrong way) |
| Category rail | First chip touches the start edge with the gutter; scrolling reveals more toward the end; fling momentum feels the same | First chip jammed against the wrong edge; rail starts scrolled to its far end |
| Best sellers rail | Same as the category rail; price and name align to the start | Names right-aligned in English or left-aligned in Arabic |
| Cards | Image on top; discount tag at the start-top corner | Tag on the same physical side in both languages |

## 3. Category

| Item | Correct | Bug |
|---|---|---|
| Grid order | Tiles read in reading order: English left then right; Arabic right then left. Item 1 is at the start of row 1, item 2 at its end | Arabic grid still fills left to right, so the "first" product is on the left |
| Scroll position after switch | Starts at the top | Starts mid-grid |
| Chips row | Start-aligned, scrolls toward the end | Wrong edge |
| Filter button | At the end edge of the header | Wrong side |
| Sheet open | Rises from the bottom; handle centred; drag follows the finger one-to-one and snaps open or closed (vertical, so no mirroring) | Sheet sticks halfway; snap threshold feels different in Arabic |
| Sheet content | Labels start-aligned, check marks at the end edge, range slider fills from the start edge (the low value is at the start) | Slider low handle on the left in Arabic with the fill running the wrong way |
| Sheet buttons | "Apply" at the end, "Reset" at the start, or whatever the design says, mirrored | Same physical positions in both languages |
| Image fade | Tiles fade from the placeholder; scrolling back shows no flicker | Flash of placeholder on return |
| Prices | See section 7 | - |

## 4. Product

| Item | Correct | Bug |
|---|---|---|
| Hero flight (open) | Image grows from its own tile, whichever column it was in, to the full-width hero in under 350 ms | Starts from the mirrored position (the left tile's image flies in from the right) |
| Hero flight (back) | The image returns to the same tile | Lands in the wrong tile or fades instead |
| Back chevron | English: points left, at the start edge. Arabic: points right, at the start edge (right) | Same physical arrow in both languages |
| Edge-swipe back | English: from the left edge, drag right. Arabic: from the right edge, drag left. The screen follows the finger and is interruptible | Arabic needs the left edge; swipe direction reversed; the screen slides the wrong way |
| Interrupt back | Release mid-way: it springs back or completes, no glitch; a second touch during the flight takes over | Image snaps or flashes |
| Gallery swipe | Arabic: page 1 on the right, page 2 to its left; the finger moves right to see page 2 (English: finger moves left) | Reversed |
| Gallery dots | Pill moves with the finger, the same way as the page | Pill moves opposite to the content |
| Gallery over-scroll | The rubber band resists at the first page toward the start and the last page toward the end | Resists on the wrong side |
| Name and brand | Start-aligned; a Latin brand inside an Arabic name keeps its words in order (for example "Nature's Bounty") | Words of the brand reversed, or punctuation on the wrong side |
| Add to cart | Button feedback plus the cart badge bump | Badge does not bump when added from Product |
| Quantity stepper | See section 5 | - |
| Favourite heart | Sits at the end edge of the image | Start edge in one language only |

## 5. Cart

| Item | Correct | Bug |
|---|---|---|
| Swipe to delete | The delete action reveals from the end edge: English, swipe the row left; Arabic, swipe the row right. The red bin is at the end edge | Arabic swipe still goes left; bin appears on the wrong side; row moves but the bin is under the finger |
| Wrong-way swipe | Dragging toward the start edge only resists a little (rubber band), never deletes | Deletes either way |
| Threshold haptic | One warning pulse when you pass the delete point, in both languages | No pulse in Arabic |
| Delete and gap | The row leaves; the rest close the gap smoothly | Rows jump |
| Undo bar | Appears at the bottom above the tab bar, message at the start, "Undo" at the end; undo restores the row at its old place | Undo at the start; bar under the tab bar |
| Stepper order | In both languages the stepper follows the row direction: minus at the start, plus at the end (so in Arabic the plus is on the left). Digits themselves do not change | Digits reversed ("12" shown as "21"); plus and minus overlapping |
| Stepper at 1 | The minus becomes a bin and removes the line (undoable) | Disabled with no feedback |
| Row layout | Thumbnail at the start, price at the end | Thumbnail on the left in Arabic |
| Totals | Labels at the start, values at the end; subtotal, VAT 15% and total each on their own line | Values at the start in Arabic |
| Empty cart | Centred state, no clipped text | Text cut at the edges |

## 6. Gestures summary (one pass, both languages)

| Gesture | English | Arabic |
|---|---|---|
| Banner next page | finger moves left | finger moves right |
| Gallery next page | finger moves left | finger moves right |
| Cart delete | row moves left | row moves right |
| Back from Product | edge-swipe from left edge, finger moves right | edge-swipe from right edge, finger moves left |
| Sheet | finger moves up/down | finger moves up/down |

Rule behind the table: the content always follows the finger. The next page sits toward the end edge
of the current one, so you drag toward the start edge to bring it in: left in English, right in Arabic.
If the content ever moves against the finger, or a swipe works from the wrong edge, that is an app bug.

## 7. Numbers and currency

| Item | Correct | Bug |
|---|---|---|
| Digits | Western digits (0-9) in both languages (ADR, as Saudi retail apps do) | Arabic-Indic digits mixed in |
| Price | English: `49.95 SAR`. Arabic: the number sits at the start (right) and "ر.س" to its left; reading right to left gives "49.95 ر.س" | "ر.س" jammed against the digits, or the number split around the symbol |
| Old price | Struck through, next to the price with a gap, order follows the row direction | Strike line cuts through the currency in the wrong place |
| Thousands | `1,234.50` in both languages | `1.234,50` or reversed groups |
| Totals column | Digits are fixed-width: totals do not jitter while the quantity changes | Width changes as digits change |
| Quantity and badge | "12" reads twelve, not twenty-one | Reversed digits |
| Negative or signed values | Sign stays attached to the number's start | Minus on the far side in Arabic |

## 8. Font and text

| Item | Correct | Bug |
|---|---|---|
| Family | Arabic text in IBM Plex Sans Arabic; Latin brand names inside Arabic text may use the same family | System Roboto/Noto in Arabic (the font failed to load) |
| Size and line height | About 1 px larger than English, line height at least 1.6 times the size for body text | Lines touching; dots or marks above and below letters cut at the top or bottom of the box |
| Diacritics | Marks such as shadda and fatha, and tall letters like "ك" and "ل", are not clipped on tiles, chips, tab labels or the toggle | Top of a tall letter flat-cut |
| Alignment | Text starts at the start edge; centred text stays centred | English text pushed to the right in the Arabic app (or the reverse) |
| Font scale 1.3x | No overlap, no clipped text on any screen | Fixed-height rows cutting text |
| Truncation | Ellipsis at the end of the line (the left in Arabic) | Ellipsis at the wrong side |

## 9. Direction-specific icons

| Icon | Mirrors in Arabic | Notes |
|---|---|---|
| Back chevron, "next" arrows, list chevrons | Yes | Must point away from the start edge for "forward" |
| Search, cart, bag, bin, plus, minus, check, heart, filter, refresh | No | Symmetric or not directional |
| Logo, brand marks | No | - |
