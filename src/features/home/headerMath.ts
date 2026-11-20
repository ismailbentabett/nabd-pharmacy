/**
 * Geometry and maths of the collapsing Home header (H-01). Pure worklets: the scroll handler runs
 * them on the UI thread, the unit tests run them as plain functions.
 *
 * The header has fixed row heights, so the content's top padding is known on the very first frame
 * (no onLayout, no jump). Collapsing never changes a height: the whole header slides up by
 * `COLLAPSE_DISTANCE` (translateY), the greeting row fades out under the status bar, and the search
 * field's surface layer shrinks from 48 to 44 dp tall (scaleY; the field's box and text keep their
 * size). What stays on screen is the compact bar: status bar, search field and language toggle.
 */
import { size, space } from '@/design/tokens';
import { progressBetween } from '@/motion/gestureMath';

export const HEADER = {
  padTop: space.xs,
  /**
   * "Deliver to Algiers", one line. 32 dp still holds the Arabic label at the 1.5x font cap. The
   * language toggle is not in this row: it sits next to the search field, so it survives the collapse.
   */
  row: space.xxl,
  gap: space.xs,
  field: size.touch,
  padBottom: space.sm,
} as const;

/** How far the header slides up: the greeting row and the gap under it. */
export const COLLAPSE_DISTANCE = HEADER.row + HEADER.gap;

/**
 * The search field's surface ends 44 dp tall. DESIGN §5 sketches 56 → 44; the field starts at the
 * 48 dp touch height instead, and only its background layer scales (vertically), so the text never
 * squashes and the field never leaves the gutter. 48 → 44 reads as the same morph.
 */
const COMPACT_FIELD = 44;
export const COMPACT_SCALE = COMPACT_FIELD / HEADER.field;

/** The greeting is fully gone at 60 % of the collapse, before it reaches the status bar. */
export const GREETING_FADE_END = 0.6;

/** Full header height for a given top inset (the status bar). The content is padded by this. */
export function expandedHeaderHeight(insetTop: number): number {
  return insetTop + HEADER.padTop + HEADER.row + HEADER.gap + HEADER.field + HEADER.padBottom;
}

/** 0 = expanded, 1 = compact. Overscroll (negative offset) stays at 0. */
export function collapseProgress(scrollY: number, distanceArg?: number): number {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const distance = distanceArg ?? COLLAPSE_DISTANCE;
  return progressBetween(scrollY, 0, distance);
}

/**
 * Where a released scroll should settle so the header is never left half-collapsed: the nearer of
 * fully expanded (0) and fully compact (`distance`). `null` means "already settled, do nothing", so a
 * release far down the page never pulls the content back up.
 */
export function headerSnapTarget(scrollY: number, distanceArg?: number): number | null {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const distance = distanceArg ?? COLLAPSE_DISTANCE;
  if (scrollY <= 0 || scrollY >= distance) return null;
  return scrollY < distance / 2 ? 0 : distance;
}

/** True once the header is more compact than expanded: the hidden row stops taking touches. */
export function isCollapsed(scrollY: number, distanceArg?: number): boolean {
  'worklet';
  // Default resolved in the body: a default parameter is not captured into the worklet closure (release crash).
  const distance = distanceArg ?? COLLAPSE_DISTANCE;
  return scrollY >= distance / 2;
}
