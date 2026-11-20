/**
 * The free-delivery line above the cart totals (WOW_MOMENTS #12): how much more to add, and how far
 * along the bar is. The threshold is on the VAT-inclusive total, because that is the number the
 * shopper sees (product page: "Free delivery over 100 SAR"). Integer halalas, like all money.
 */
import type { Halalas } from '@/core/money';

/** 100.00 SAR. */
export const FREE_DELIVERY_THRESHOLD_H: Halalas = 10_000;

export type FreeDeliveryProgress = Readonly<{
  /** Halalas still to add; 0 once unlocked. */
  remaining: Halalas;
  /** 0..1, for the bar. */
  progress: number;
  unlocked: boolean;
}>;

export function freeDeliveryProgress(
  gross: Halalas,
  threshold: Halalas = FREE_DELIVERY_THRESHOLD_H,
): FreeDeliveryProgress {
  const unlocked = gross >= threshold;
  return {
    remaining: unlocked ? 0 : threshold - gross,
    progress: unlocked ? 1 : Math.max(0, gross) / threshold,
    unlocked,
  };
}
