/**
 * Pure maths shared by every gesture (bottom sheet, swipe-to-delete, carousel, hero back-swipe).
 * All functions are worklets so they run on the UI thread inside gesture callbacks, and plain
 * functions in tests. Callees are declared before their callers: a worklet captures the functions
 * it uses when it is created, so the order matters (ADR-020).
 *
 * Direction: gestures read raw screen X. `toLogicalX(x, dir)` turns it into "towards the reading
 * end" so one piece of logic serves English (dir 1) and Arabic (dir -1).
 */

/**
 * How far ahead a fling is projected when choosing a snap point: the release velocity times this.
 * A starting value, tuned by feel on the device (HUMAN_TODO): longer makes a flick jump further.
 */
export const PROJECTION_SECONDS = 0.2;

/** Past a limit the content follows the finger at 35 % speed: a plain linear resistance, so the edge is felt. */
export const RUBBER_BAND_FACTOR = 0.35;

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/** Screen X to logical X: positive means "towards the reading end" in both directions. */
export function toLogicalX(x: number, dir: 1 | -1): number {
  'worklet';
  return x * dir;
}

/** Follow the finger inside [min, max]; past an edge, resist with `factor` so the edge is felt. */
export function rubberBand(value: number, min: number, max: number, factorArg?: number): number {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const factor = factorArg ?? RUBBER_BAND_FACTOR;
  if (value < min) return min + (value - min) * factor;
  if (value > max) return max + (value - max) * factor;
  return value;
}

/** Where a release at `position` with `velocity` (px/s) would come to rest. Decides the snap. */
export function projectEnd(position: number, velocity: number): number {
  'worklet';
  return position + velocity * PROJECTION_SECONDS;
}

/** The snap point closest to `target`. `points` must not be empty. */
export function nearestSnap(target: number, points: readonly number[]): number {
  'worklet';
  let best = points[0] ?? target;
  for (let i = 1; i < points.length; i++) {
    const point = points[i] ?? best;
    if (Math.abs(point - target) < Math.abs(best - target)) best = point;
  }
  return best;
}

/** Map `value` from [inMin, inMax] onto [0, 1], clamped. Progress of a drag or transition. */
export function progressBetween(value: number, inMin: number, inMax: number): number {
  'worklet';
  if (inMax === inMin) return value >= inMax ? 1 : 0;
  return clamp((value - inMin) / (inMax - inMin), 0, 1);
}

/**
 * translateX that shows page `index` of a horizontal pager whose pages are laid out in a flex row.
 * The row itself mirrors in RTL (page 0 sits at the right), but transforms do not, so the direction
 * multiplies in: LTR slides left (negative), RTL slides right (positive). Used by the gallery and the
 * banner carousel, so both page the same way in both languages (G-08).
 */
export function pageOffset(index: number, width: number, dir: 1 | -1): number {
  'worklet';
  return -dir * index * width;
}

/** Inverse of `pageOffset`: the fractional page shown at `offset` (0.5 = halfway to page 1). */
export function pageIndexFromOffset(offset: number, width: number, dir: 1 | -1): number {
  'worklet';
  if (width <= 0) return 0;
  return (-offset * dir) / width;
}
