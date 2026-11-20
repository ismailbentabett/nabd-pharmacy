import {
  clamp,
  nearestSnap,
  pageIndexFromOffset,
  pageOffset,
  progressBetween,
  projectEnd,
  PROJECTION_SECONDS,
  rubberBand,
  RUBBER_BAND_FACTOR,
  toLogicalX,
} from '@/motion/gestureMath';

describe('gesture maths', () => {
  it('clamp keeps a value inside the range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('toLogicalX makes "towards the reading end" positive in both directions', () => {
    // A finger moving right is forward in English and backward in Arabic.
    expect(toLogicalX(40, 1)).toBe(40);
    expect(toLogicalX(40, -1)).toBe(-40);
    expect(toLogicalX(-40, -1)).toBe(40);
  });

  describe('rubberBand', () => {
    it('follows the finger exactly inside the range', () => {
      expect(rubberBand(120, 0, 300)).toBe(120);
    });

    it('resists past either edge at the documented factor', () => {
      expect(rubberBand(400, 0, 300)).toBeCloseTo(300 + 100 * RUBBER_BAND_FACTOR);
      expect(rubberBand(-100, 0, 300)).toBeCloseTo(-100 * RUBBER_BAND_FACTOR);
    });

    it('is continuous at the edges (no jump when the limit is crossed)', () => {
      expect(rubberBand(300.0001, 0, 300)).toBeCloseTo(300, 3);
      expect(rubberBand(-0.0001, 0, 300)).toBeCloseTo(0, 3);
    });

    it('accepts a custom factor', () => {
      expect(rubberBand(10, 0, 0, 0.5)).toBe(5);
    });
  });

  it('projectEnd adds the distance a fling would still travel', () => {
    expect(projectEnd(100, 0)).toBe(100);
    expect(projectEnd(100, 1000)).toBe(100 + 1000 * PROJECTION_SECONDS);
    expect(projectEnd(100, -1000)).toBe(100 - 1000 * PROJECTION_SECONDS);
  });

  describe('nearestSnap', () => {
    const points = [0, 300, 600];

    it('picks the closest point', () => {
      expect(nearestSnap(100, points)).toBe(0);
      expect(nearestSnap(200, points)).toBe(300);
      expect(nearestSnap(10_000, points)).toBe(600);
    });

    it('a fast flick from near "closed" still opens the sheet, through projection', () => {
      // Released at 40 px with 1800 px/s upwards-in-sheet-space: projected to 400, nearest 300.
      expect(nearestSnap(projectEnd(40, 1800), points)).toBe(300);
    });

    it('on an exact tie keeps the earlier point', () => {
      expect(nearestSnap(150, points)).toBe(0);
    });

    it('with one point always returns it', () => {
      expect(nearestSnap(-999, [42])).toBe(42);
    });
  });

  describe('progressBetween', () => {
    it('maps a range onto 0..1 and clamps', () => {
      expect(progressBetween(50, 0, 100)).toBe(0.5);
      expect(progressBetween(-10, 0, 100)).toBe(0);
      expect(progressBetween(150, 0, 100)).toBe(1);
    });

    it('works on a reversed range (collapsing header: 0 at top, 1 once scrolled)', () => {
      expect(progressBetween(75, 100, 0)).toBe(0.25);
    });

    it('does not divide by zero on an empty range', () => {
      expect(progressBetween(5, 5, 5)).toBe(1);
      expect(progressBetween(4, 5, 5)).toBe(0);
    });
  });
  describe('pageOffset / pageIndexFromOffset (paged carousels and galleries)', () => {
    it('moves left to reach the next page in English and right in Arabic', () => {
      expect(pageOffset(2, 300, 1)).toBe(-600);
      expect(pageOffset(2, 300, -1)).toBe(600);
      expect(pageOffset(0, 300, 1)).toBeCloseTo(0);
    });

    it('turns an offset back into a (fractional) page index in both directions', () => {
      expect(pageIndexFromOffset(-600, 300, 1)).toBe(2);
      expect(pageIndexFromOffset(600, 300, -1)).toBe(2);
      expect(pageIndexFromOffset(-450, 300, 1)).toBe(1.5);
    });

    it('round-trips for every page and both directions', () => {
      for (const dir of [1, -1] as const) {
        for (let i = 0; i < 5; i++) expect(pageIndexFromOffset(pageOffset(i, 320, dir), 320, dir)).toBeCloseTo(i);
      }
    });

    it('returns page 0 before the width is known', () => {
      expect(pageIndexFromOffset(-600, 0, 1)).toBe(0);
    });
  });
});
