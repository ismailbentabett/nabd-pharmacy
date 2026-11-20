---
name: cart-money-math
description: Exact TVA/total math in integer centimes (Algerian dinar), cart reducer semantics and required tests. Load when touching cart, prices, totals or formatting.
---
Read `docs/CART_SPEC.md` and `docs/fixtures/cart-vectors.json`. Market is Algeria (ADR-061): currency DZD, shown "DA" (EN) / "د.ج" (AR); 1 DA = 100 centimes.

Core: prices include TVA at 19 %; `gross=Σ priceCentimes·qty`; `tva=Math.floor((38*gross+119)/238)` (= round_half_up(gross·19/119), brute-force checked for gross 0..2,000,000); `net=gross−tva`; UI: Subtotal(excl. TVA)=net, TVA(19%)=tva, Total=gross; invariant net+tva=gross. In code the TVA field is still named `vat` (`splitVat`). Integers only; convert at boundary with `toCentimes(price)=Math.round(price*100)`; format with `formatDzd`. DB columns keep their `*_h` names but hold centimes. Cart store holds `{id,qty}`; undo restores original index. Tests listed in CART_SPEC must exist and pass.

Worked examples (computed with node from the formula above):
| Cart | gross (centimes) | tva | net | Display (EN) |
|---|---|---|---|---|
| empty | 0 | 0 | 0 | 0.00 DA |
| 1 × 1,800 DA | 180000 | 28739 | 151261 | Total 1,800.00 DA · TVA 287.39 DA · Subtotal 1,512.61 DA |
| 3 × 1,800 DA | 540000 | 86218 | 453782 | Total 5,400.00 DA · TVA 862.18 DA |
| 2 × 950 DA | 190000 | 30336 | 159664 | Total 1,900.00 DA · TVA 303.36 DA |
| 4,000 DA (free-delivery threshold) | 400000 | 63866 | 336134 | TVA 638.66 DA |
| 1 centime / 21 centimes | 1 / 21 | 0 / 3 | 1 / 18 | rounding edges (0.16 → 0, 3.35 → 3) |
| 99 × 24,800 DA (top fragrance price) | 245520000 | 39200672 | 206319328 | large qty, still a safe integer |

Rounding happens once, on the cart total, not per line. An exact .5 tie cannot occur: it would need 38·gross ≡ 119 (mod 238), an even number equal to an odd one.
