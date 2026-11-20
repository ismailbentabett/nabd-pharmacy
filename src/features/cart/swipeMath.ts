/**
 * Pure maths for swipe-to-delete on a cart row (K-02). Every function is a worklet, so it runs
 * inside the gesture on the UI thread and as a plain function in tests.
 *
 * Two quantities, both in dp and both direction-free:
 * - pull: how far the finger has dragged the row towards the START edge (left in English, right in
 *   Arabic). 0 = closed. `toPull` is the only place the reading direction enters.
 * - drawn: how far the row is actually drawn. It equals the pull while the delete button is being
 *   uncovered, then lags behind the finger (rubber band) so the row resists before it lets go.
 *
 * Callees are declared before callers (ADR-020).
 */
import { nearestSnap, projectEnd, RUBBER_BAND_FACTOR, toLogicalX } from '@/motion/gestureMath';

/** Width of the red delete button uncovered at the END edge. Starting value, tuned on the device. */
export const ACTION_WIDTH = 88;
/** Release past this share of the row width deletes (skill swipe-actions: 40 %). */
export const COMMIT_FRACTION = 0.4;
/** On a narrow row the commit point still sits well past the button, so opening it never deletes. */
export const COMMIT_MIN = ACTION_WIDTH * 1.5;
/** Past the button the row moves at half the finger's speed: the user feels it before it commits. */
export const PAST_ACTION_RESISTANCE = 0.5;
/** A flick towards the start this fast (dp/s) deletes even before the commit point. */
export const FLING_VELOCITY = 1500;
/** Horizontal travel before the swipe claims the touch. Vertical travel first hands it to the list. */
export const ACTIVE_OFFSET = 12;
export const FAIL_OFFSET = 8;
/** The red layer fades in over the first few dp, so it never shows through the rounded corners at rest. */
export const ACTION_REVEAL_FADE = 12;
/** The bin grows a little once a release would delete: the visual twin of the threshold haptic. */
export const ARMED_ICON_SCALE = 1.15;

export type ReleaseDecision = 'delete' | 'open' | 'closed';

/** Screen X (translation or velocity) to pull. Dragging towards the start edge is positive in both directions. */
export function toPull(screenX: number, dir: 1 | -1): number {
  'worklet';
  return -toLogicalX(screenX, dir);
}

/** The translateX that draws a row pulled by `drawn`: towards the start edge, mirrored in Arabic. */
export function screenXFromPull(drawn: number, dir: 1 | -1): number {
  'worklet';
  return -drawn * dir;
}

/** Finger pull to drawn offset: resist backwards (past closed) and past the button. */
export function drawnFromPull(pull: number, actionWidthArg?: number): number {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const actionWidth = actionWidthArg ?? ACTION_WIDTH;
  if (pull < 0) return pull * RUBBER_BAND_FACTOR;
  if (pull <= actionWidth) return pull;
  return actionWidth + (pull - actionWidth) * PAST_ACTION_RESISTANCE;
}

/** Inverse of `drawnFromPull`: grabbing a row mid-animation continues from where it is drawn. */
export function pullFromDrawn(drawn: number, actionWidthArg?: number): number {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const actionWidth = actionWidthArg ?? ACTION_WIDTH;
  if (drawn < 0) return drawn / RUBBER_BAND_FACTOR;
  if (drawn <= actionWidth) return drawn;
  return actionWidth + (drawn - actionWidth) / PAST_ACTION_RESISTANCE;
}

/** The finger's velocity converted to the drawn row's velocity, so the release spring starts at the row's real speed. */
export function drawnVelocity(pull: number, pullVelocity: number, actionWidthArg?: number): number {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const actionWidth = actionWidthArg ?? ACTION_WIDTH;
  if (pull < 0) return pullVelocity * RUBBER_BAND_FACTOR;
  if (pull <= actionWidth) return pullVelocity;
  return pullVelocity * PAST_ACTION_RESISTANCE;
}

/** The pull at which a release deletes. Before the row is measured (width 0) the minimum applies. */
export function commitDistance(rowWidth: number): number {
  'worklet';
  return Math.max(rowWidth * COMMIT_FRACTION, COMMIT_MIN);
}

/**
 * What a release does. Delete needs the projected end past the commit point AND either the finger
 * already past it or a real flick, so a slow drag that stops short never deletes, and flicking back
 * from past the point cancels. Otherwise the row rests open or closed, whichever the throw lands nearer.
 */
export function releaseDecision(
  pull: number,
  pullVelocity: number,
  commitAt: number,
  actionWidthArg?: number,
): ReleaseDecision {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const actionWidth = actionWidthArg ?? ACTION_WIDTH;
  const projected = projectEnd(pull, pullVelocity);
  if (projected >= commitAt && (pull >= commitAt || pullVelocity >= FLING_VELOCITY)) return 'delete';
  return nearestSnap(projected, [0, actionWidth]) === 0 ? 'closed' : 'open';
}
