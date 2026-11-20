/**
 * The free-delivery line under the cart totals. The swipe-to-delete maths lives in swipeMath.test.ts.
 */
import { FREE_DELIVERY_THRESHOLD_H, freeDeliveryProgress } from '@/features/cart/freeDelivery';

describe('freeDeliveryProgress', () => {
  it('says how much is left and how full the bar is', () => {
    expect(freeDeliveryProgress(4995)).toEqual({ remaining: 5005, progress: 0.4995, unlocked: false });
    expect(freeDeliveryProgress(0)).toEqual({ remaining: FREE_DELIVERY_THRESHOLD_H, progress: 0, unlocked: false });
  });

  it('unlocks at exactly the threshold and stays full above it', () => {
    expect(freeDeliveryProgress(FREE_DELIVERY_THRESHOLD_H)).toEqual({ remaining: 0, progress: 1, unlocked: true });
    expect(freeDeliveryProgress(26485)).toEqual({ remaining: 0, progress: 1, unlocked: true });
  });
});
