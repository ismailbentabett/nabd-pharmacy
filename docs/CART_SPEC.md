# CART SPEC (S-04 tests, K-04 display)

## Money rules
- All logic in **integer halalas** (1 SAR = 100 halalas). `Product.price` in the data layer is a SAR number with 2 decimals (`numeric(10,2)` in Postgres); convert once at the boundary: `toHalalas(price) = Math.round(price * 100)`.
- Prices **include VAT** (D-07). Therefore: `gross = Σ priceHalalas × qty` (this is the **Total**).
- VAT share inside gross at 15 %: `vat = round_half_up(gross × 15 / 115)`. Integer-safe form (verified identical to `Math.round(gross*15/115)` for gross 0…200 000, 0 mismatches):
  `vat = Math.floor((6 * gross + 23) / 46)`  (15/115 = 3/23 → `floor((3*gross*2 + 23)/46)`).
- `net = gross − vat` (the **Subtotal, excl. VAT**).
- UI lines, in order: **Subtotal (excl. VAT)** = net · **VAT (15 %)** = vat · **Total** = gross. Invariant: `net + vat === gross` always.
- Display: `formatSar(halalas, locale)` → `49.95 SAR` / `٤٩٫٩٥ ر.س` **only if** the digit policy says Arabic-Indic; default policy: Western digits + "SAR" in EN, Western digits + "ر.س" in AR. Always 2 decimals, thousands separator `,`. Centralised in `src/i18n/format.ts`.

## Cart state shape
```ts
type CartLine = { id: string; qty: number }          // qty 1..MAX_QTY (99); prices read from catalog lookup, never duplicated
type CartState = { ids: string[]; byId: Record<string, CartLine>; lastRemoved?: { line: CartLine; index: number } }
```
Actions (pure reducer in `cartMath.ts`, store wraps it): `add(id, qty=1)` merges if present · `setQty(id, qty)` clamps 1..99 (qty < 1 → remove) · `remove(id)` stores `lastRemoved` with index · `undo()` reinserts at the **original index** and clears · `clear()`.
Selectors: `selectCount` (Σ qty → badge), `selectTotals(lookupPrice)` → `{gross, vat, net}`, `selectLine(id)`.
Because the cart stores only `{id, qty}`, price lookup uses a `Map` populated from fetched products; a line whose product isn't in memory is still resolvable via the deterministic generator (`getProductById(id)` works for all 1,000 ids without paging).

## Required unit tests (all must exist; vectors in `docs/fixtures/cart-vectors.json`)
1. Totals vectors (8 cases incl. empty, rounding edge 0.23 and 0.10+0.20, large 199.99×99).
2. `net + vat === gross` property test over 10 000 random carts (seeded).
3. Add same product twice → qty 2, one line; add different → two lines, insertion order.
4. `setQty` clamps at 99; `setQty(…,0)` removes; negative/NaN ignored.
5. Remove → `lastRemoved` set; undo restores at original index and qty; second undo is a no-op; adding something after remove clears undo.
6. `selectCount` is Σ qty (badge); count unchanged by unrelated updates (referential stability of selector output).
7. Float safety: 0.1+0.2 style prices never produce 30000000004; all intermediate values are safe integers.
8. formatSar EN/AR snapshots; `formatSar(0)`.
9. Max cart: 1,000 distinct lines × 99 → no overflow, totals exact.

## UX rules tied to the math
Totals update in the **same frame** as the tap (store → selector → animated digits driven by a shared value set from the new total; no debounce, no await). Stepper minus at qty 1 → turns into trash (or removes with undo) — decide once, document in ADR. Undo window 5 s; a second delete while undo is visible replaces the undo target (previous deletion becomes permanent).
