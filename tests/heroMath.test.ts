/**
 * The shared-element hero's maths (P-01, F-04, G-08). These are the worklets the transition and
 * the back gestures run on the UI thread; here they are plain functions, so where the image is,
 * when a release closes the page and the Arabic mirror can all be pinned without a device.
 * The screen around them (Back, reduced motion, the hand-off from the tile, the gestures) is in
 * productNavigation.test.tsx and productChrome.test.tsx; the finger controls in heroControls.test.tsx.
 */
import {
  blendOffset,
  carryOffset,
  CLOSE_AT,
  CORNERS_SQUARE_AT,
  coverTransform,
  galleryRect,
  heroCornerRadius,
  heroFrame,
  lerp,
  progressVelocity,
  pullProgress,
  backProgress,
  shouldClose,
  toRect,
  type HeroTransform,
  type Point,
  type Rect,
} from '@/motion/hero/heroMath';
import { PROJECTION_SECONDS, toLogicalX } from '@/motion/gestureMath';

const W = 400;
/** A grid tile's image box, lower down and to the side, as `measure()` reports it. */
const TILE: Rect = { x: 220, y: 480, width: 160, height: 160 };
const GALLERY = galleryRect(W, 0);

/** Where a view laid out at `dst` actually shows on screen once `t` is applied (scale is about its centre). */
function onScreen(t: HeroTransform, dst: Rect): Rect {
  const width = dst.width * t.scale;
  const height = dst.height * t.scale;
  const cx = dst.x + dst.width / 2 + t.translateX;
  const cy = dst.y + dst.height / 2 + t.translateY;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** The hero image's centre on screen at `progress` with a `carry` offset, the way heroStyles composes it. */
function heroCentre(progress: number, carry: Point, src: Rect, dst: Rect): Point {
  const t = coverTransform(heroFrame(progress, src, dst), dst);
  return { x: dst.x + dst.width / 2 + t.translateX + carry.x, y: dst.y + dst.height / 2 + t.translateY + carry.y };
}

function expectRect(actual: Rect, expected: Rect) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.width).toBeCloseTo(expected.width, 6);
  expect(actual.height).toBeCloseTo(expected.height, 6);
}

/** What a back-swipe release decides, from raw screen values, the way useHeroBackGestures chains the helpers. */
function releaseSwipe(dx: number, velocityX: number, dir: 1 | -1, from = 1) {
  const progress = backProgress(dx, W, dir, from);
  const velocity = progressVelocity(toLogicalX(velocityX, dir), W);
  return { progress, closes: shouldClose(progress, velocity) };
}

describe('where the hero is', () => {
  it('sits on the tile at 0, fills the gallery at 1 and blends in a straight line between', () => {
    expectRect(heroFrame(0, TILE, GALLERY), TILE);
    expectRect(heroFrame(1, TILE, GALLERY), GALLERY);
    expectRect(heroFrame(0.5, TILE, GALLERY), {
      x: lerp(TILE.x, 0, 0.5),
      y: lerp(TILE.y, 0, 0.5),
      width: lerp(TILE.width, W, 0.5),
      height: lerp(TILE.height, W, 0.5),
    });
  });

  it.each([0, 0.25, 0.5, 0.8, 1])('the gallery, transformed, covers exactly the frame at progress %p', (p) => {
    const frame = heroFrame(p, TILE, GALLERY);
    expectRect(onScreen(coverTransform(frame, GALLERY), GALLERY), frame);
  });

  it('is the identity once it has arrived, and never divides by a zero-width gallery', () => {
    expect(coverTransform(GALLERY, GALLERY)).toEqual({ translateX: 0, translateY: 0, scale: 1 });
    expect(coverTransform(TILE, { x: 0, y: 0, width: 0, height: 0 }).scale).toBe(1);
  });

  it('follows the page scroll: the gallery moves up by what the page scrolled', () => {
    expectRect(galleryRect(W, 0), { x: 0, y: 0, width: W, height: W });
    expectRect(galleryRect(W, 120), { x: 0, y: -120, width: W, height: W });
  });

  it('treats a view that is gone or not laid out as "no tile", so the page fades instead', () => {
    expect(toRect(null)).toBeNull();
    expect(toRect({ pageX: 10, pageY: 20, width: 0, height: 160 })).toBeNull();
    expect(toRect({ pageX: 10, pageY: 20, width: 160, height: 0 })).toBeNull();
    expect(toRect({ pageX: 10, pageY: 20, width: 160, height: 150 })).toEqual({ x: 10, y: 20, width: 160, height: 150 });
  });

  it("starts with the tile's rounded corners on screen and squares them off early", () => {
    const scale = TILE.width / W;
    // Laid out at gallery size and scaled down: r / scale shows as exactly r on the tile.
    expect(heroCornerRadius(0, scale, 12) * scale).toBeCloseTo(12);
    expect(heroCornerRadius(CORNERS_SQUARE_AT / 2, scale, 12) * scale).toBeCloseTo(6);
    expect(heroCornerRadius(CORNERS_SQUARE_AT, scale, 12)).toBe(0);
    expect(heroCornerRadius(1, 1, 12)).toBe(0);
    expect(heroCornerRadius(0, 0, 12)).toBe(0); // never divides by a zero scale
  });
});

describe('back swipe (G-08)', () => {
  it('closes as the finger travels towards the end edge: right in English, left in Arabic', () => {
    expect(backProgress(W / 4, W, 1)).toBeCloseTo(0.75);
    expect(backProgress(-W / 4, W, -1)).toBeCloseTo(0.75);
    // The wrong way does nothing at rest: an open page cannot open further.
    expect(backProgress(-W / 4, W, 1)).toBe(1);
    expect(backProgress(W / 4, W, -1)).toBe(1);
  });

  it.each([-500, -120, 0, 37, 260, 900])('Arabic mirrors English exactly (dx %p)', (dx) => {
    expect(backProgress(-dx, W, -1)).toBe(backProgress(dx, W, 1));
    expect(backProgress(-dx, W, -1, 0.4)).toBe(backProgress(dx, W, 1, 0.4));
  });

  it('continues from where it caught a moving page, either way, inside 0..1', () => {
    expect(backProgress(W * 0.2, W, 1, 0.6)).toBeCloseTo(0.4);
    expect(backProgress(-W * 0.2, W, 1, 0.6)).toBeCloseTo(0.8);
    expect(backProgress(-W * 2, W, 1, 0.6)).toBe(1);
    expect(backProgress(W * 2, W, 1, 0.6)).toBe(0);
  });

  it('stays where it was caught before the window has a width', () => {
    expect(backProgress(100, 0, 1, 0.7)).toBe(0.7);
  });

  it('a slow release closes past half way and springs back open before it', () => {
    expect(CLOSE_AT).toBe(0.5);
    expect(releaseSwipe(W * 0.6, 0, 1).closes).toBe(true);
    expect(releaseSwipe(W * 0.4, 0, 1).closes).toBe(false);
    // Exactly at the threshold the page stays: only "below half" closes.
    expect(releaseSwipe(W * 0.5, 0, 1).closes).toBe(false);
  });

  it('a flick decides by where it would end, in both directions, in both languages', () => {
    // A short, fast flick towards the end edge closes even though the finger barely moved.
    const flick = (W * 0.5) / PROJECTION_SECONDS + 100;
    expect(releaseSwipe(W * 0.1, flick, 1).closes).toBe(true);
    expect(releaseSwipe(-W * 0.1, -flick, -1).closes).toBe(true);
    // A long drag thrown back towards the start edge reopens.
    expect(releaseSwipe(W * 0.7, -flick, 1).closes).toBe(false);
    expect(releaseSwipe(-W * 0.7, flick, -1).closes).toBe(false);
  });
});

describe('pull down on the image', () => {
  it('closes as the finger moves down, never opens past 1, and keeps its value with no distance', () => {
    expect(pullProgress(W / 4, W)).toBeCloseTo(0.75);
    expect(pullProgress(-W, W)).toBe(1);
    expect(pullProgress(W * 3, W)).toBe(0);
    expect(pullProgress(W / 4, W, 0.5)).toBeCloseTo(0.25);
    expect(pullProgress(50, 0, 0.9)).toBe(0.9);
  });

  it('turns finger speed towards closing into progress falling, per second', () => {
    expect(progressVelocity(800, W)).toBe(-2);
    expect(progressVelocity(-400, W)).toBe(1);
    expect(progressVelocity(800, 0)).toBe(0);
  });

  it('closes on a fast downward flick from fully open', () => {
    expect(shouldClose(1, progressVelocity(3000, W))).toBe(true);
    expect(shouldClose(1, progressVelocity(300, W))).toBe(false);
  });
});

describe('the image stays under the finger while it shrinks (carryOffset)', () => {
  const caughtAt = (progress: number, carry: Point = { x: 0, y: 0 }) => ({ progress, carry });

  it('blends from the tile centre at 0 to no offset at 1', () => {
    expect(blendOffset(1, TILE, GALLERY)).toEqual({ x: 0, y: 0 });
    expect(blendOffset(0, TILE, GALLERY)).toEqual({ x: TILE.x + 80 - W / 2, y: TILE.y + 80 - W / 2 });
    expect(blendOffset(0.3, null, GALLERY)).toEqual({ x: 0, y: 0 });
  });

  it.each([
    [1, 0.7, { x: 60, y: 15 }],
    [1, 0.2, { x: 300, y: -40 }],
    [0.6, 0.9, { x: -80, y: 30 }],
  ])('caught at %p and dragged to %p: centre = where it was + the finger', (from, to, finger) => {
    const caughtCarry = { x: 12, y: -7 };
    const before = heroCentre(from, caughtCarry, TILE, GALLERY);
    const carry = carryOffset(finger, to, caughtAt(from, caughtCarry), TILE, GALLERY);
    const after = heroCentre(to, carry, TILE, GALLERY);
    expect(after.x).toBeCloseTo(before.x + finger.x, 6);
    expect(after.y).toBeCloseTo(before.y + finger.y, 6);
  });

  it('with no tile (fade), the carry is just the finger on top of the caught carry', () => {
    expect(carryOffset({ x: 30, y: 40 }, 0.5, caughtAt(1, { x: 5, y: 5 }), null, GALLERY)).toEqual({ x: 35, y: 45 });
  });

  it('does not move the image when neither the finger nor the progress moved', () => {
    const carry = carryOffset({ x: 0, y: 0 }, 0.4, caughtAt(0.4, { x: 9, y: 3 }), TILE, GALLERY);
    expect(carry.x).toBeCloseTo(9, 9);
    expect(carry.y).toBeCloseTo(3, 9);
  });
});
