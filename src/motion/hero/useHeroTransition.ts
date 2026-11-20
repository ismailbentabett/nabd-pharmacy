/**
 * The product page side of the shared-element hero (P-01, F-04, G-09). How it works:
 *
 * - One shared value, `progress`, 0 → 1. The gallery itself is moved and scaled (transform only)
 *   from the tile's rect to its own place, while the backdrop, the body and the header fade and
 *   rise with the same value (heroStyles.ts). All on the UI thread: React renders the page once.
 * - Open: the gallery's first page draws the tile's own cached image. Once that image is on screen
 *   (or after READY_DEADLINE_MS) the hero appears exactly over the tile and springs open with
 *   `springs.hero`, tuned to rest in about 300 ms. Only the spring is inside the brief's 350 ms:
 *   the page mount and the image wait (up to 150 ms) come on top. Device timing: NOT MEASURED YET.
 *   The tile hides only after the hero has left it, so there is never a hole and never a blank frame.
 * - Close: every Back (header button, hardware key, body swipe, pull-down) ends in `settle(false)`:
 *   the tile is measured again, progress springs to 0, the gallery pager slides back to image 1
 *   (`resetGallery`) and, in the frame it lands, the tile shows again and the route is popped
 *   (the one JS call, via scheduleOnRN).
 * - Interruptible: a finger on the image (or a body swipe, once it drags) stops the spring (`grab`),
 *   a drag moves it either way, and the release keeps the finger's velocity (`release`). Lifting a
 *   finger that never dragged lets the transition carry on (`letGo`).
 * - The header and the add-to-cart bar take touches only while the page is open and at rest:
 *   `onInteractiveChange(true)` when an open lands, `(false)` when a close starts or a finger
 *   starts dragging the page. Two discrete events per open/close, never one per frame.
 * - No hand-off entry (deep link, recycled tile) or reduced motion: the page crossfades.
 */
import { useState } from 'react';
import {
  cancelAnimation,
  measure,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { hero, timingExit, timingReducedFade, timingStandard } from '@/motion/springs';

import {
  carryOffset,
  galleryRect,
  HIDE_SOURCE_AT,
  progressVelocity,
  shouldClose,
  toRect,
  type Point,
  type Rect,
} from './heroMath';
import { useHeroStyles } from './heroStyles';
import { readHeroSource } from './registry';
import { useHeroLifecycle } from './useHeroLifecycle';

export { READY_DEADLINE_MS } from './useHeroLifecycle';

export type HeroTransitionOptions = Readonly<{
  productId: string;
  /** Window width: the gallery is a full-width square at the top of the page. */
  width: number;
  reduceMotion: boolean;
  /** Worklet: the gallery pager back on image 1, offset and page index together, while the hero flies home. */
  resetGallery: () => void;
  /** JS: whether the header and bar may take touches. Called on change only, never per frame. */
  onInteractiveChange: (interactive: boolean) => void;
  /** JS: leave the route. Called once, in the frame the close lands. */
  onClosed: () => void;
}>;

export type Caught = Readonly<{ progress: number; carry: Point }>;

/** What the back gestures (useHeroBackGestures) drive. All functions are worklets. */
export type HeroGestureControls = Readonly<{
  caught: SharedValue<Caught>;
  swipeEnabled: SharedValue<boolean>;
  pullEnabled: SharedValue<boolean>;
  grab: () => void;
  drag: (progress: number, tx: number, ty: number) => void;
  release: (closingVelocity: number, vx: number, vy: number) => void;
  letGo: () => void;
}>;

export function useHeroTransition(options: HeroTransitionOptions) {
  const { productId, width, reduceMotion, resetGallery, onInteractiveChange, onClosed } = options;
  // Read once: the hand-off of the tile that opened this page, if any, and whether to fly at all.
  const [handOff] = useState(() => ({ entry: readHeroSource(productId), flies: !reduceMotion }));
  const source = handOff.flies ? handOff.entry : null;
  const srcRef = source?.ref ?? null;
  const srcRect = source?.rect ?? null;
  const srcHidden = source?.hidden ?? null;

  const progress = useSharedValue(0);
  const target = useSharedValue(1);
  const carryX = useSharedValue(0);
  const carryY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const visible = useSharedValue(source === null ? 1 : 0);
  const started = useSharedValue(false);
  const landed = useSharedValue(false);
  const interactive = useSharedValue(false);
  const swipeEnabled = useSharedValue(true);
  const pullEnabled = useSharedValue(true);
  const caught = useSharedValue<Caught>({ progress: 1, carry: { x: 0, y: 0 } });
  const holders = useSharedValue(0);
  const released = useSharedValue(false);

  function sourceRect(): Rect | null {
    'worklet';
    return srcRect === null ? null : srcRect.get();
  }

  /** Measure the tile again: the list under the page may have moved since it was pressed. */
  function refreshSource(): void {
    'worklet';
    if (srcRef === null || srcRect === null || srcRect.get() === null) return;
    const live = toRect(measure(srcRef));
    if (live !== null) srcRect.set(live);
  }

  /** Tells React once per change; the guard keeps it from ever becoming a per-frame call. */
  function reportInteractive(on: boolean): void {
    'worklet';
    if (interactive.get() === on) return;
    interactive.set(on);
    scheduleOnRN(onInteractiveChange, on);
  }

  function land(): void {
    'worklet';
    landed.set(true);
    swipeEnabled.set(false);
    pullEnabled.set(false);
    if (srcHidden !== null) srcHidden.set(0);
    scheduleOnRN(onClosed);
  }

  function settle(open: boolean, velocity: number, carryVX: number, carryVY: number): void {
    'worklet';
    if (landed.get()) return;
    started.set(true);
    visible.set(1);
    target.set(open ? 1 : 0);
    if (!open) {
      reportInteractive(false);
      refreshSource();
    }
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished !== true) return;
      if (open) reportInteractive(true);
      else land();
    };
    carryX.set(withSpring(0, { ...hero, velocity: carryVX }));
    carryY.set(withSpring(0, { ...hero, velocity: carryVY }));
    if (sourceRect() !== null) {
      progress.set(withSpring(open ? 1 : 0, { ...hero, velocity }, finish));
      // Flying home: the image lands on the tile as image 1, which is what the tile shows.
      if (!open) resetGallery();
    } else {
      const fade = reduceMotion ? timingReducedFade : open ? timingStandard : timingExit;
      progress.set(withTiming(open ? 1 : 0, fade, finish));
    }
  }

  function start(): void {
    'worklet';
    if (!started.get()) settle(true, 0, 0, 0);
  }

  function close(): void {
    'worklet';
    if (target.get() !== 0) settle(false, 0, 0, 0);
  }

  function grab(): void {
    'worklet';
    if (landed.get()) return;
    holders.set(holders.get() + 1);
    if (holders.get() > 1) return;
    cancelAnimation(progress);
    cancelAnimation(carryX);
    cancelAnimation(carryY);
    started.set(true);
    visible.set(1);
    released.set(false);
    refreshSource();
    caught.set({ progress: progress.get(), carry: { x: carryX.get(), y: carryY.get() } });
  }

  function drag(next: number, tx: number, ty: number): void {
    'worklet';
    if (landed.get()) return;
    // Not on `grab`: a tap on a page at rest grabs too, and must not flicker the chrome.
    reportInteractive(false);
    progress.set(next);
    const dst = galleryRect(width, scrollY.get());
    const carry = carryOffset({ x: tx, y: ty }, next, caught.get(), sourceRect(), dst);
    carryX.set(carry.x);
    carryY.set(carry.y);
  }

  function release(closingVelocity: number, vx: number, vy: number): void {
    'worklet';
    released.set(true);
    const velocity = progressVelocity(closingVelocity, width);
    settle(!shouldClose(progress.get(), velocity), velocity, vx, vy);
  }

  function letGo(): void {
    'worklet';
    // Gesture Handler finalizes a gesture that never began too: only a matching `grab` counts.
    if (holders.get() === 0) return;
    const left = holders.get() - 1;
    holders.set(left);
    if (left === 0 && !released.get()) settle(target.get() === 1, 0, 0, 0);
  }

  // Hide the tile once the hero has visibly left it; `land` shows it again.
  useAnimatedReaction(
    () => visible.get() === 1 && sourceRect() !== null && progress.get() > HIDE_SOURCE_AT,
    (out, wasOut) => {
      if (out && wasOut !== true && srcHidden !== null) srcHidden.set(1);
    },
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
      const atTop = event.contentOffset.y <= 0 && !landed.get();
      if (atTop !== pullEnabled.get()) pullEnabled.set(atTop);
    },
  });

  const styles = useHeroStyles({ progress, carryX, carryY, scrollY, visible, srcRect, width, reduceMotion });

  useHeroLifecycle({ productId, entry: handOff.entry, flies: source !== null, start, close, srcHidden });

  const controls: HeroGestureControls = { caught, swipeEnabled, pullEnabled, grab, drag, release, letGo };

  return {
    /** The tile's image URL; the gallery draws it under the first full-size image. */
    heroUri: source?.uri ?? null,
    ...styles,
    onScroll,
    /** JS: the tile image is on screen in the hero, so it can appear and fly. */
    markImageReady: () => scheduleOnUI(start),
    /** JS: the header back button. */
    requestClose: () => scheduleOnUI(close),
    controls,
  };
}
