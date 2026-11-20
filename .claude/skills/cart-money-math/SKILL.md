---
name: cart-money-math
description: Exact VAT/total math in integer halalas, cart reducer semantics and required tests. Load when touching cart, prices, totals or formatting.
---
Read `docs/CART_SPEC.md` and `docs/fixtures/cart-vectors.json`. Core: prices include VAT; `gross=Σ priceHalalas·qty`; `vat=Math.floor((6*gross+23)/46)`; `net=gross−vat`; UI: Subtotal(excl. VAT)=net, VAT(15%)=vat, Total=gross; invariant net+vat=gross. Integers only; convert at boundary with `Math.round(price*100)`. Cart store holds `{id,qty}`; undo restores original index. Tests listed in CART_SPEC must exist and pass.
