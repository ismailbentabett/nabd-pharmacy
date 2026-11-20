/**
 * Money is integer halalas (1 SAR = 100 halalas) everywhere in logic.
 * Floats only exist at the edges: the catalog's display price and the formatted string.
 */
export type Halalas = number;

export const VAT_RATE_PERCENT = 15;

/** SAR amount (e.g. 49.95) → halalas (4995). Rounds away float noise such as 0.1 + 0.2. */
export function toHalalas(sar: number): Halalas {
  return Math.round(sar * 100);
}

export interface VatSplit {
  /** What the customer pays. Prices already include VAT. */
  gross: Halalas;
  /** The 15 % VAT share inside `gross`. */
  vat: Halalas;
  /** `gross − vat`: the amount before tax. */
  net: Halalas;
}

/**
 * VAT share of a VAT-inclusive amount: gross × 15/115 = gross × 3/23, rounded half-up.
 * Written with integers only: floor((6·gross + 23) / 46) === round(3·gross / 23).
 * `net` is derived by subtraction, so `net + vat === gross` always holds exactly.
 */
export function splitVat(gross: Halalas): VatSplit {
  const vat = Math.floor((6 * gross + 23) / 46);
  return { gross, vat, net: gross - vat };
}
