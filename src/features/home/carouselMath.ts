/**
 * Maths of the banner carousel (H-02). Pure functions, shared by the autoplay timer and the swipe,
 * and tested as plain functions. The ones that run on the UI thread are worklets.
 *
 * Positions are the translateX of the row of pages. `pageOffset` / `pageIndexFromOffset` (gestureMath)
 * turn a page index into that offset and back, with the reading direction folded in, so nothing here
 * needs to know whether the app is in English or Arabic (G-08).
 */
import { clamp, pageIndexFromOffset, projectEnd } from '@/motion/gestureMath';

/** Time a banner stays on screen before autoplay moves on. */
export const AUTOPLAY_MS = 4000;

/** The page after `page`; after the last one, back to the first (a rewind, no cloned pages). */
export function nextPage(page: number, count: number): number {
  'worklet';
  if (count <= 1) return 0;
  return (page + 1) % count;
}

export type AutoplayInput = Readonly<{
  reduceMotion: boolean;
  screenReader: boolean;
  /** Home is the visible tab. */
  focused: boolean;
  /** The app is in the foreground. */
  appActive: boolean;
  /** A finger is on the banner. */
  touched: boolean;
  count: number;
}>;

/**
 * Autoplay runs only when nobody is hurt by it and somebody can see it: off under reduce motion
 * (ADR-025: content that moves by itself is the thing the setting exists to stop), off while a
 * screen reader is on (the text would change under the user's focus), off while a finger is on the
 * banner (H-02: it pauses while touched), off when Home is not the visible tab or the app is in the
 * background, and off with one page.
 */
export function shouldAutoplay({ reduceMotion, screenReader, focused, appActive, touched, count }: AutoplayInput): boolean {
  return !reduceMotion && !screenReader && focused && appActive && !touched && count > 1;
}

/** The whole page currently shown at `offset` (the nearest one while between two). */
export function pageAt(offset: number, width: number, dir: 1 | -1): number {
  'worklet';
  return Math.round(pageIndexFromOffset(offset, width, dir));
}

/**
 * Where autoplay goes from the row's real position: the page after the one on screen. Read from the
 * offset, not from React's page number, so a page the finger just chose is never skipped.
 */
export function autoplayTarget(offset: number, width: number, dir: 1 | -1, count: number): number {
  'worklet';
  return nextPage(clamp(pageAt(offset, width, dir), 0, Math.max(count - 1, 0)), count);
}

/**
 * The page a swipe settles on. The release is projected forward by its velocity (a flick goes on to
 * the next page even if the finger only moved a little), then limited to one page away from where
 * the drag started (a hard fling never skips a banner) and to the real pages.
 */
export function releasePage(
  startPage: number,
  offset: number,
  velocityX: number,
  width: number,
  count: number,
  dir: 1 | -1,
): number {
  'worklet';
  const projected = pageAt(projectEnd(offset, velocityX), width, dir);
  const oneAway = clamp(projected, startPage - 1, startPage + 1);
  return clamp(oneAway, 0, Math.max(count - 1, 0));
}
