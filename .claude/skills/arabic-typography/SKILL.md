---
name: arabic-typography
description: Arabic typesetting rules and digit/currency policy for the bilingual UI. Load for text styling or copy.
---
IBM Plex Sans Arabic for AR, IBM Plex Sans for Latin; weights 400/500/600. Arabic body line-height ≥ 1.6 (≈24 at 15), optical size +1px, no letter-spacing, no italics, avoid all-caps logic. Mixed Latin brand inside Arabic: isolate with Unicode isolates. Numerals: prices/qty Western digits (consistent with Saudi retail UX) via `format.ts`; `nameAr` keeps supplied Arabic-Indic digits; currency "ر.س" in AR, "SAR" in EN (new riyal glyph lacks font support). Tabular numerals for money. Check clipping of ascenders/descenders at 1.3× font scale. Native-speaker proofread required (flag).
