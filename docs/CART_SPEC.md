# CART SPEC (S-04 tests, K-04 display)

## Money rules
- Market: Algeria (ADR-061). Currency Algerian dinar (ISO DZD), shown as `DA` in English and `د.ج` in Arabic.
- All logic in **integer centimes** (1 DA = 100 centimes). `Product.price` in the data layer is a DA number; convert once at the boundary: `toCentimes(price) = Math.round(price * 100)`. Postgres columns keep their `*_h` names (`price_h`, `gross_h`, `vat_h`, `net_h`, …) but hold integer centimes.
- Prices **include TVA** (D-07). Therefore: `gross = Σ priceCentimes × qty` (this is the **Total**).
- TVA share inside gross at 19 %: `tva = round_half_up(gross × 19 / 119)`. Integer-safe form (brute-force checked identical to round-half-up of `19·gross / 119` for gross 0…2 000 000, 0 mismatches):
  `tva = Math.floor((38 * gross + 119) / 238)`  (round_half_up(x / y) = floor((2x + y) / 2y) with x = 19·gross, y = 119).
- In code the field is still called `vat` (`splitVat`, `VatSplit.vat`, `orders.vat_h`); it holds the TVA share.
- `net = gross − tva` (the **Subtotal, excl. TVA**).
- UI lines, in order: **Subtotal (excl. TVA)** = net · **TVA (19 %)** = tva · **Total** = gross. Invariant: `net + tva === gross` always.
- Display: `formatDzd(centimes, locale)` → `1,800.00 DA` in EN, `1,800.00 د.ج` in AR. Western digits in both languages, always 2 decimals, thousands separator `,`. Centralised in `src/i18n/format.ts`.
- Free delivery threshold: 4,000 DA (`400_000` centimes) on the TVA-inclusive total, display only.

## Cart state shape
```ts
type CartLine = { id: string; qty: number }          // qty 1..MAX_QTY (99); prices read from catalog lookup, never duplicated
type CartState = { ids: string[]; byId: Record<string, CartLine>; lastRemoved?: { line: CartLine; index: number } }
```
Actions (pure reducer in `cartMath.ts`, store wraps it): `add(id, qty=1)` merges if present · `setQty(id, qty)` clamps 1..99 (qty < 1 → remove) · `remove(id)` stores `lastRemoved` with index · `undo()` reinserts at the **original index** and clears · `clear()`.
Selectors: `selectCount` (Σ qty → badge), `selectTotals(lookupPrice)` → `{gross, vat, net}`, `selectLine(id)`.
Because the cart stores only `{id, qty}`, price lookup uses a `Map` populated from fetched products; a line whose product isn't in memory is still resolvable via the deterministic generator (`getProductById(id)` works for all 1,000 ids without paging).

## Required unit tests (all must exist; vectors in `docs/fixtures/cart-vectors.json`)
1. Totals vectors (incl. empty, rounding edges, float-noise prices such as 0.10+0.20, large qty ×99).
2. `net + vat === gross` property test over 10 000 random carts (seeded).
3. Add same product twice → qty 2, one line; add different → two lines, insertion order.
4. `setQty` clamps at 99; `setQty(…,0)` removes; negative/NaN ignored.
5. Remove → `lastRemoved` set; undo restores at original index and qty; second undo is a no-op; adding something after remove clears undo.
6. `selectCount` is Σ qty (badge); count unchanged by unrelated updates (referential stability of selector output).
7. Float safety: 0.1+0.2 style prices never produce 30000000004; all intermediate values are safe integers.
8. formatDzd EN/AR snapshots; `formatDzd(0)`.
9. Max cart: 1,000 distinct lines × 99 → no overflow, totals exact.

## UX rules tied to the math
Totals update in the **same frame** as the tap (store → selector → animated digits driven by a shared value set from the new total; no debounce, no await). Stepper minus at qty 1 → turns into trash (or removes with undo) — decide once, document in ADR. Undo window 5 s; a second delete while undo is visible replaces the undo target (previous deletion becomes permanent).
