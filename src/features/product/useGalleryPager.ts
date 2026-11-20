/**
 * The gallery pager's state, in one place (P-02, P-01).
 *
 * Three things say which image is showing, and they must always agree:
 *   offset   the row's translateX, a shared value (UI thread, animated);
 *   current  the page index on the UI thread, which the swipe's release reads;
 *   page     the same index as React state, for TalkBack's "Image 2 of 3".
 * Every way of changing the page goes through here and moves all three together: a swipe
 * (`settleOn`), a screen reader action (`goTo`) and the hero flying home (`resetToFirst`).
 *
 * Why the hero needs `resetToFirst`: the tile shows image 1, so a close slides the pager back to
 * it while the image flies. Moving only the offset left `current` and `page` on the old image;
 * a close interrupted by a finger then reopened a page that showed image 1, announced image 3
 * and swiped from the wrong page.
 *
 * Arabic: the row mirrors natively (page 1 at the right) and `pageOffset` multiplies by `dir`.
 */
import { useState } from 'react';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useDirection } from '@/i18n/direction';
import { clamp, pageOffset } from '@/motion/gestureMath';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { hero, spatialDefault, timingReducedFade } from '@/motion/springs';

export function useGalleryPager(count: number, width: number) {
  const { dir } = useDirection();
  const reduceMotion = useMotionPreference();
  const [page, setPage] = useState(0);
  const offset = useSharedValue(0);
  const current = useSharedValue(0);

  /** Worklet: spring to `target` with the finger's velocity; a new page ticks once. */
  function settleOn(target: number, velocity: number): void {
    'worklet';
    const to = pageOffset(target, width, dir);
    offset.set(reduceMotion ? withTiming(to, timingReducedFade) : withSpring(to, { ...spatialDefault, velocity }));
    if (target !== current.get()) {
      current.set(target);
      scheduleOnRN(setPage, target);
      scheduleOnRN(haptics.tap);
    }
  }

  /**
   * Worklet: back to image 1 while the hero flies home, on the hero's own spring so the two land
   * together. No haptic: the user did not turn a page.
   */
  function resetToFirst(): void {
    'worklet';
    if (offset.get() !== 0) offset.set(reduceMotion ? withTiming(0, timingReducedFade) : withSpring(0, hero));
    if (current.get() !== 0) {
      current.set(0);
      scheduleOnRN(setPage, 0);
    }
  }

  /** JS: the screen reader's page turn (increment / decrement). */
  const goTo = (target: number) => {
    const next = clamp(target, 0, count - 1);
    if (next === page) return;
    const to = pageOffset(next, width, dir);
    offset.set(reduceMotion ? withTiming(to, timingReducedFade) : withSpring(to, spatialDefault));
    current.set(next);
    setPage(next);
  };

  return { count, width, page, offset, current, settleOn, resetToFirst, goTo };
}

export type GalleryPager = ReturnType<typeof useGalleryPager>;
