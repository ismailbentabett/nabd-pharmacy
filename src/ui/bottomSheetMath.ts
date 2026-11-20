/**
 * The numbers behind the bottom sheet (C-03), kept out of the component so they can be unit tested.
 *
 * One coordinate decides everything: `y`, the sheet's translateY. 0 means fully open (the sheet sits
 * on the bottom edge at its own height); `height` means fully closed (pushed down by exactly its own
 * height, so its top edge is at the bottom of the screen). Every function here is a worklet: the drag
 * and the backdrop run them on the UI thread, every frame, without a trip to JavaScript.
 *
 * Two spaces meet here. "Finger space" is where the finger would put the sheet with no resistance;
 * "sheet space" is where the sheet is drawn. They are the same between open and closed and differ
 * only above open, where the rubber band shows the finger's travel at 35 %. `fingerOrigin` and
 * `releaseVelocity` convert between them, so catching and releasing the sheet up there never jumps.
 *
 * Vertical motion is the same in both reading directions, so nothing here takes `dir`.
 */
import { clamp, nearestSnap, progressBetween, projectEnd, rubberBand, RUBBER_BAND_FACTOR } from '@/motion/gestureMath';

/** How far, at most, the finger can pull the sheet above its open position. The rubber band makes
 * the finger travel about three times this far, which is as far as a pull upwards needs to be felt. */
export const MAX_OVERDRAG = 48;

/** The fastest throw the spring takes, in px/s: Android's own fling ceiling (ViewConfiguration's
 * MAXIMUM_FLING_VELOCITY, 8000 dp/s). Gesture Handler does not cap its velocity; this does. */
export const MAX_FLING_VELOCITY = 8000;

/**
 * Height of the strip of sheet colour that hangs below the sheet, so the bottom of the screen never
 * shows a gap while the sheet is above open. The pull is capped at MAX_OVERDRAG, but the opening
 * spring can carry a hard throw further than that: the worst case (an 8000 px/s flick released at
 * open) peaks about 174 px up. A unit test runs the spring and checks it stays under this.
 */
export const SKIRT_HEIGHT = 240;

/** Backdrop opacity when the sheet is fully open (skill: bottom-sheet-physics). */
export const SCRIM_OPACITY = 0.45;

/** The sheet never grows past this share of the space it covers; longer content scrolls. */
export const MAX_HEIGHT = '85%';

/**
 * Finger travel (px) before a drag takes the sheet. Big enough that a tap on Close or on a chip
 * stays a tap; smaller than Android's 8 dp scroll slop, so on the body the sheet's drag decides
 * before the scroll would have.
 */
export const DRAG_SLOP = 6;

/**
 * How far (px) the body may be scrolled and still count as "at the top". Scroll offsets come back
 * as fractions of a pixel on some densities, so exactly 0 is too strict.
 */
export const SCROLL_TOP_TOLERANCE = 1;

/**
 * Whether a downward drag that starts on the body should move the sheet rather than the content:
 * only when the content is already at its top, where scrolling down further shows nothing new. Any
 * other time the body pan is switched off and the content scrolls as usual.
 */
export function bodyCanDrag(scrollOffset: number): boolean {
  'worklet';
  return scrollOffset <= SCROLL_TOP_TOLERANCE;
}

/**
 * Where a drag that starts with the sheet at `position` counts from, in finger space. Above open the
 * sheet shows only 35 % of the finger's travel, so the finger "is" further up than the sheet; starting
 * there makes the first frame of the drag draw the sheet exactly where it was caught (no jump).
 */
export function fingerOrigin(position: number): number {
  'worklet';
  return position < 0 ? position / RUBBER_BAND_FACTOR : position;
}

/**
 * Where the sheet sits while the finger drags it: exactly under the finger between open and closed,
 * resisting (rubber band) when pulled above open, and never further than MAX_OVERDRAG. It cannot go
 * below closed: there is nothing to show down there. `start` is `fingerOrigin` of the caught position.
 * A sheet caught higher than MAX_OVERDRAG (a hard throw still settling) may stay up there; the drag
 * only refuses to pull it any higher.
 */
export function dragPosition(start: number, translation: number, height: number): number {
  'worklet';
  const ceiling = Math.min(-MAX_OVERDRAG, rubberBand(start, 0, height));
  return clamp(rubberBand(start + translation, 0, height), ceiling, height);
}

/**
 * Whether a release should end open. The sheet does not snap to wherever it was let go; it snaps to
 * where a throw at that speed would have carried it (`projectEnd`), so a short fast flick down closes
 * it and a slow drag past the middle still springs back if the finger was moving up. This reads the
 * finger's own speed: it is the person's intent, even where the rubber band slows the sheet down.
 */
export function releaseOpens(position: number, velocity: number, height: number): boolean {
  'worklet';
  return nearestSnap(projectEnd(position, velocity), [0, height]) === 0;
}

/**
 * The speed the spring starts at when the finger lets go: the sheet's own speed at that moment, so
 * the motion carries on without a kick. Above open the sheet moved at 35 % of the finger, so that is
 * what it keeps; anywhere, at most MAX_FLING_VELOCITY.
 */
export function releaseVelocity(position: number, velocity: number): number {
  'worklet';
  const sheetSpeed = position < 0 ? velocity * RUBBER_BAND_FACTOR : velocity;
  return clamp(sheetSpeed, -MAX_FLING_VELOCITY, MAX_FLING_VELOCITY);
}

/**
 * Backdrop opacity for a sheet position: full scrim when open, none when closed, in proportion in
 * between, so the backdrop dims and clears with the finger. `fade` is the reduced-motion fade (1 when
 * not fading). Before the sheet has been measured (`height` 0) there is no backdrop at all.
 */
export function backdropOpacity(position: number, height: number, fade: number): number {
  'worklet';
  if (height <= 0) return 0;
  return SCRIM_OPACITY * (1 - progressBetween(position, 0, height)) * fade;
}

/** True when the sheet is completely out of sight (at or below its closed position). */
export function isHidden(position: number, height: number): boolean {
  'worklet';
  return height <= 0 || position >= height;
}

/**
 * How much bottom padding the sheet needs for the system navigation bar: the part of the bottom
 * safe-area inset that the sheet's own area actually reaches. Covering the whole screen, that is the
 * full inset; sitting above a tab bar that already pads for it, that is nothing. Plain JS, runs on
 * layout only.
 */
export function bottomInsetOverlap(inset: number, windowBottom: number, areaBottom: number): number {
  return clamp(inset - (windowBottom - areaBottom), 0, inset);
}
