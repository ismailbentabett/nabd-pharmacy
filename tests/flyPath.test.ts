/**
 * The add-to-cart flight's maths (P-03, G-08): the curve the thumb follows from the button to the
 * header's cart icon, and how it shrinks and fades on the way. Plain functions here; on the device
 * the same code runs on the UI thread every frame (useAddToCartMotion).
 */
import {
  arcControl,
  arcPoint,
  centreOn,
  END_SCALE,
  FADE_FROM,
  flightOpacity,
  flightScale,
  thumbOrigin,
  type Box,
  type Point,
} from '@/features/product/flyPath';

const THUMB = 56;
/** The bar at the bottom of a 400 x 900 screen, the button inside it, the cart icon in the header. */
const BAR: Box = { pageX: 0, pageY: 820, width: 400, height: 80 };
const BUTTON_EN: Box = { pageX: 160, pageY: 832, width: 224, height: 52 };
const CART_EN: Box = { pageX: 348, pageY: 32, width: 40, height: 40 };

/** The same layout mirrored for Arabic: everything sits on the other side of the screen. */
function mirror(box: Box): Box {
  return { ...box, pageX: BAR.width - box.pageX - box.width };
}

function centreOf(box: Box): Point {
  return { x: box.pageX + box.width / 2, y: box.pageY + box.height / 2 };
}

/** Where the thumb's centre lands on screen for a translation from its layout origin. */
function thumbCentre(origin: Point, translation: Point): Point {
  return { x: origin.x + translation.x + THUMB / 2, y: origin.y + translation.y + THUMB / 2 };
}

describe('the curve', () => {
  const from = { x: 200, y: 830 };
  const to = { x: 340, y: 24 };
  const control = arcControl(from, to);

  it('starts on the button and ends on the cart icon', () => {
    expect(arcPoint(0, from, control, to)).toEqual(from);
    expect(arcPoint(1, from, control, to)).toEqual(to);
  });

  it('bends through a control point above the start and level with the end', () => {
    expect(control).toEqual({ x: from.x, y: to.y });
    const mid = arcPoint(0.5, from, control, to);
    expect(mid.x).toBeCloseTo(0.25 * from.x + 0.5 * control.x + 0.25 * to.x);
    expect(mid.y).toBeCloseTo(0.25 * from.y + 0.5 * control.y + 0.25 * to.y);
  });

  it('lifts off almost straight up, then curves sideways into the icon', () => {
    const early = arcPoint(0.1, from, control, to);
    const sideways = Math.abs(early.x - from.x);
    const up = Math.abs(early.y - from.y);
    expect(sideways).toBeLessThan(up / 10);
    // Sideways travel grows with the square of time: the turn happens late.
    expect(early.x - from.x).toBeCloseTo(0.01 * (to.x - from.x));
  });
});

describe('positions on screen, both directions (G-08)', () => {
  it('the thumb is laid out at the start of the bar: its left edge in English, its right edge in Arabic', () => {
    expect(thumbOrigin(BAR, THUMB, false)).toEqual({ x: 0, y: 820 });
    expect(thumbOrigin(BAR, THUMB, true)).toEqual({ x: BAR.width - THUMB, y: 820 });
  });

  it.each([
    ['English', false, BUTTON_EN, CART_EN],
    ['Arabic', true, mirror(BUTTON_EN), mirror(CART_EN)],
  ] as const)('%s: the flight starts centred on the button and ends centred on the cart icon', (_, isRTL, button, cart) => {
    const origin = thumbOrigin(BAR, THUMB, isRTL);
    expect(thumbCentre(origin, centreOn(button, origin, THUMB))).toEqual(centreOf(button));
    expect(thumbCentre(origin, centreOn(cart, origin, THUMB))).toEqual(centreOf(cart));
  });

  it('the Arabic flight is the English one reflected across the middle of the screen', () => {
    const en = thumbOrigin(BAR, THUMB, false);
    const ar = thumbOrigin(BAR, THUMB, true);
    const enEnd = thumbCentre(en, centreOn(CART_EN, en, THUMB));
    const arEnd = thumbCentre(ar, centreOn(mirror(CART_EN), ar, THUMB));
    expect(arEnd).toEqual({ x: BAR.width - enEnd.x, y: enEnd.y });
  });
});

describe('shrink and fade', () => {
  it('stays solid for most of the way, then fades out over the last part', () => {
    expect(flightOpacity(0)).toBe(1);
    expect(flightOpacity(FADE_FROM)).toBe(1);
    expect(flightOpacity((FADE_FROM + 1) / 2)).toBeCloseTo(0.5);
    expect(flightOpacity(1)).toBe(0);
  });

  it('never goes below zero if a spring overshoots the end', () => {
    expect(flightOpacity(1.05)).toBe(0);
  });

  it('shrinks steadily from full size to about the size of the icon', () => {
    expect(flightScale(0)).toBe(1);
    expect(flightScale(1)).toBeCloseTo(END_SCALE);
    expect(flightScale(0.5)).toBeCloseTo((1 + END_SCALE) / 2);
    expect(flightScale(0.6)).toBeLessThan(flightScale(0.3));
  });
});
