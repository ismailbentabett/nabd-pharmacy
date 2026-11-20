/**
 * The free-delivery line above the cart totals (WOW_MOMENTS #12): how much more to add, and how far
 * along the bar is. The threshold is on the TVA-inclusive total, because that is the number the
 * shopper sees (product page: "Free delivery over 4,000 DA"). Integer centimes, like all money.
 */
import type { Centimes } from '@/core/money';

/** 4,000.00 DA. */
export const FREE_DELIVERY_THRESHOLD_H: Centimes = 400_000;

export type FreeDeliveryProgress = Readonly<{
  /** Centimes still to add; 0 once unlocked. */
  remaining: Centimes;
  /** 0..1, for the bar. */
  progress: number;
  unlocked: boolean;
}>;

export function freeDeliveryProgress(
  gross: Centimes,
  threshold: Centimes = FREE_DELIVERY_THRESHOLD_H,
): FreeDeliveryProgress {
  const unlocked = gross >= threshold;
  return {
    remaining: unlocked ? 0 : threshold - gross,
    progress: unlocked ? 1 : Math.max(0, gross) / threshold,
    unlocked,
  };
}
