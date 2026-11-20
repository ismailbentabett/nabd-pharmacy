---
name: anti-slop-ui
description: Checklist to keep the UI from looking AI-generated or template-like; tokens, spacing, typography, gold budget, states. Load when designing or reviewing any screen/component.
---
Read `docs/DESIGN.md` §1–§8 and apply literally. Quick gates:
1. Semantic tokens only (no raw hex); contrast via `node scripts/contrast.mjs`. Gold = fill with navy text, never text on light.
2. 4-pt rhythm; gutters 16; grid gap 12; radii 16/12/14/24/999 consistently.
3. Hierarchy: price + primary action are the loudest after the image; squint test.
4. One icon set (lucide, stroke 1.75); no emoji; mirror directional icons.
5. No elevation on grid tiles; no glass/blur; one subtle gradient max (Home header/banner).
6. Real bilingual content with fictional brands; no placeholder names.
7. Every control: default/pressed/disabled/focus + 48dp target + a11y label.
8. Skeletons match final layout; designed empty & error states; no layout shift on load.
9. Money in tabular numerals; no jitter while animating.
10. Screenshots reviewed in both LTR and RTL before calling a screen done.
