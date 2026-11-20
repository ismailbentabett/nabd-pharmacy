/**
 * Pure maths of the add-to-cart flight (P-03): a small copy of the product image rises from the
 * button and curves into the header's cart icon. Worklets, so the UI thread runs them every frame;
 * plain functions in tests (tests/flyPath.test.ts).
 *
 * The path is a quadratic Bezier with its control point straight above the start, level with the
 * end: the thumb lifts off vertically, then curves sideways into the icon, like something tossed.
 * Points are physical screen points from `measure()`, so in Arabic the icon simply sits on the other
 * side and the same curve mirrors itself without any `dir`.
 */
export type Point = Readonly<{ x: number; y: number }>;
export type Box = Readonly<{ pageX: number; pageY: number; width: number; height: number }>;

/** The thumb ends at this fraction of its size, about the size of the icon it lands in. */
export const END_SCALE = 0.35;
/** It stays fully visible until this far along the path, then fades into the icon. */
export const FADE_FROM = 0.8;

/** Where on the path the thumb is at `t` (0 = button, 1 = cart icon). */
export function arcPoint(t: number, from: Point, control: Point, to: Point): Point {
  'worklet';
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/** Control point: above the start, level with the end. Lift first, then curve in. */
export function arcControl(from: Point, to: Point): Point {
  'worklet';
  return { x: from.x, y: to.y };
}

/**
 * The thumb's layout origin on screen. It is positioned with `start: 0` inside `container`, which
 * is the container's left edge in English and its right edge (minus the thumb) in Arabic.
 */
export function thumbOrigin(container: Box, thumb: number, isRTL: boolean): Point {
  'worklet';
  return { x: container.pageX + (isRTL ? container.width - thumb : 0), y: container.pageY };
}

/** The translation that centres a `thumb`-sized square on `box`, from the thumb's layout origin. */
export function centreOn(box: Box, origin: Point, thumb: number): Point {
  'worklet';
  return {
    x: box.pageX + box.width / 2 - thumb / 2 - origin.x,
    y: box.pageY + box.height / 2 - thumb / 2 - origin.y,
  };
}

/** Thumb opacity along the path: solid, then a quick fade over the last fifth. */
export function flightOpacity(t: number): number {
  'worklet';
  if (t <= FADE_FROM) return 1;
  return Math.max(0, (1 - t) / (1 - FADE_FROM));
}

/** Thumb scale along the path: shrinks steadily from full size to END_SCALE. */
export function flightScale(t: number): number {
  'worklet';
  return 1 + (END_SCALE - 1) * t;
}
