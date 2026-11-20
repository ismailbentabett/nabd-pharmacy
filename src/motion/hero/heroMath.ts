/**
 * Pure maths of the shared-element hero (P-01, F-04). Worklets, so the transition and the back
 * gestures call them on the UI thread; plain functions in tests (tests/heroMath.test.ts).
 *
 * One number drives everything: `progress`, 0 = the image sits on its grid tile, 1 = it fills the
 * gallery at the top of the product page. Opening springs it to 1; Back (button, hardware key,
 * body swipe, pull-down) brings it to 0. A finger can stop it anywhere and move it either way.
 *
 * All rects are in screen points measured on the UI thread (`measure().pageX/pageY`). Physical
 * coordinates already contain the language direction (an Arabic tile simply sits on the other
 * side), so the interpolation needs no `dir`. Only finger translations do (`backProgress`).
 *
 * Callees are declared before their callers (worklets capture what they use; ADR-020).
 */
import { clamp, projectEnd, toLogicalX } from '@/motion/gestureMath';

export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type HeroTransform = Readonly<{ translateX: number; translateY: number; scale: number }>;
export type Point = Readonly<{ x: number; y: number }>;

/** Released with a projected progress below this, the page closes; above, it springs back open. */
export const CLOSE_AT = 0.5;
/** The tile hides once the hero has visibly left it, so there is never a hole and never two images. */
export const HIDE_SOURCE_AT = 0.02;
/** By this progress the hero's rounded tile corners have squared off to the full-bleed gallery's. */
export const CORNERS_SQUARE_AT = 0.35;

export function lerp(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

/** Where the hero is at `progress`: the tile at 0, the gallery at 1, a straight blend between. */
export function heroFrame(progress: number, src: Rect, dst: Rect): Rect {
  'worklet';
  return {
    x: lerp(src.x, dst.x, progress),
    y: lerp(src.y, dst.y, progress),
    width: lerp(src.width, dst.width, progress),
    height: lerp(src.height, dst.height, progress),
  };
}

/**
 * The transform that makes a view laid out at `dst` cover `frame` exactly. React Native scales
 * around the view's centre, so we move centre to centre and scale by the width ratio. One scale
 * for both axes: product images are square on the tile and in the gallery, so nothing stretches.
 */
export function coverTransform(frame: Rect, dst: Rect): HeroTransform {
  'worklet';
  return {
    translateX: frame.x + frame.width / 2 - (dst.x + dst.width / 2),
    translateY: frame.y + frame.height / 2 - (dst.y + dst.height / 2),
    scale: dst.width > 0 ? frame.width / dst.width : 1,
  };
}

/**
 * The hero frame's corner radius at `progress`, in the frame's own (unscaled) points. The frame is
 * laid out at gallery size and scaled down onto the tile, so a radius r looks like r x scale on
 * screen: dividing by `scale` makes it look exactly like the tile's `tileRadius` at 0. It reaches 0
 * at CORNERS_SQUARE_AT, early in an open and late in a close (as the image settles into the tile).
 */
export function heroCornerRadius(progress: number, scale: number, tileRadius: number): number {
  'worklet';
  if (scale <= 0) return 0;
  return (tileRadius * (1 - clamp(progress / CORNERS_SQUARE_AT, 0, 1))) / scale;
}

/** The gallery's rect on screen: full width, square, at the top, moved up by the page scroll. */
export function galleryRect(width: number, scrollY: number): Rect {
  'worklet';
  return { x: 0, y: -scrollY, width, height: width };
}

/** A `measure()` result as a Rect, or null when the view is gone or not laid out (fade instead). */
export function toRect(
  measured: Readonly<{ pageX: number; pageY: number; width: number; height: number }> | null,
): Rect | null {
  'worklet';
  if (measured === null || measured.width <= 0 || measured.height <= 0) return null;
  return { x: measured.pageX, y: measured.pageY, width: measured.width, height: measured.height };
}

/**
 * Back swipe: how open the page is after the finger moved `dx` (raw screen X) from where it caught
 * the page (`from`, 1 when the page was at rest). Swiping towards the reading end closes it: right
 * in English, left in Arabic (`dir`, G-08). A full screen width of travel closes it completely;
 * swiping back the other way reopens a page caught mid-close, never past 1.
 */
export function backProgress(dx: number, width: number, dir: 1 | -1, from: number = 1): number {
  'worklet';
  if (width <= 0) return from;
  return clamp(from - toLogicalX(dx, dir) / width, 0, 1);
}

/** Pull-down on the image: the same idea vertically. Down closes, in both languages. */
export function pullProgress(dy: number, distance: number, from: number = 1): number {
  'worklet';
  if (distance <= 0) return from;
  return clamp(from - dy / distance, 0, 1);
}

/** A finger speed in points/s (positive = towards closing) as progress per second. */
export function progressVelocity(fingerVelocity: number, distance: number): number {
  'worklet';
  return distance > 0 ? -fingerVelocity / distance : 0;
}

/** Decide on release: project the progress forward with its velocity, close if it ends below half. */
export function shouldClose(progress: number, velocity: number): boolean {
  'worklet';
  return projectEnd(progress, velocity) < CLOSE_AT;
}

/** How far the blend alone has moved the image centre from the gallery centre at `progress`. */
export function blendOffset(progress: number, src: Rect | null, dst: Rect): Point {
  'worklet';
  if (src === null) return { x: 0, y: 0 };
  const pulled = 1 - clamp(progress, 0, 1);
  return {
    x: (src.x + src.width / 2 - (dst.x + dst.width / 2)) * pulled,
    y: (src.y + src.height / 2 - (dst.y + dst.height / 2)) * pulled,
  };
}

/**
 * Keeps the image under the finger while a drag also shrinks it towards its tile. The blend alone
 * would move the image towards the tile, maybe away from the finger; this extra "carry" offset
 * cancels that, so the image centre = where it was when caught + the finger's translation.
 * On release the carry springs to 0 while `progress` springs to its end, so they land together.
 */
export function carryOffset(
  translation: Point,
  progress: number,
  caught: Readonly<{ progress: number; carry: Point }>,
  src: Rect | null,
  dst: Rect,
): Point {
  'worklet';
  const then = blendOffset(caught.progress, src, dst);
  const now = blendOffset(progress, src, dst);
  return {
    x: caught.carry.x + then.x + translation.x - now.x,
    y: caught.carry.y + then.y + translation.y - now.y,
  };
}
