/**
 * Money is integer centimes (1 DA = 100 centimes) everywhere in logic.
 * Floats only exist at the edges: the catalog's display price and the formatted string.
 */
export type Centimes = number;

export const VAT_RATE_PERCENT = 19;

/** DA amount (e.g. 1250.5) → centimes (125050). Rounds away float noise such as 0.1 + 0.2. */
export function toCentimes(da: number): Centimes {
  return Math.round(da * 100);
}

export interface VatSplit {
  /** What the customer pays. Prices already include TVA. */
  gross: Centimes;
  /** The 19 % TVA share inside `gross`. */
  vat: Centimes;
  /** `gross − vat`: the amount before tax. */
  net: Centimes;
}

/**
 * TVA share of a TVA-inclusive amount: gross × 19/119, rounded half-up.
 * Written with integers only: floor((38·gross + 119) / 238) === round_half_up(19·gross / 119)
 * (38/238 = 19/119, and +119/238 is the +½). Brute-force checked for gross 0..2,000,000.
 * `net` is derived by subtraction, so `net + vat === gross` always holds exactly.
 */
export function splitVat(gross: Centimes): VatSplit {
  const vat = Math.floor((38 * gross + 119) / 238);
  return { gross, vat, net: gross - vat };
}
