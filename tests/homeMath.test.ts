import { autoplayTarget, nextPage, pageAt, releasePage, shouldAutoplay } from '@/features/home/carouselMath';
import {
  collapseProgress,
  COLLAPSE_DISTANCE,
  COMPACT_SCALE,
  expandedHeaderHeight,
  HEADER,
  headerSnapTarget,
  isCollapsed,
} from '@/features/home/headerMath';
import { pageOffset } from '@/motion/gestureMath';

describe('header maths (H-01)', () => {
  it('collapses by the greeting row and the gap under it', () => {
    expect(COLLAPSE_DISTANCE).toBe(HEADER.row + HEADER.gap);
    expect(COLLAPSE_DISTANCE).toBe(40);
  });

  it('pads the content by the full header height, status bar included', () => {
    expect(expandedHeaderHeight(0)).toBe(8 + 32 + 8 + 48 + 12);
    expect(expandedHeaderHeight(24)).toBe(expandedHeaderHeight(0) + 24);
  });

  it('progress runs 0 → 1 over the collapse distance and is clamped at both ends', () => {
    expect(collapseProgress(-40)).toBe(0); // iOS overscroll at the top
    expect(collapseProgress(0)).toBe(0);
    expect(collapseProgress(COLLAPSE_DISTANCE / 2)).toBeCloseTo(0.5);
    expect(collapseProgress(COLLAPSE_DISTANCE)).toBe(1);
    expect(collapseProgress(2000)).toBe(1);
  });

  it('the search field surface ends 44 dp tall', () => {
    expect(HEADER.field * COMPACT_SCALE).toBeCloseTo(44);
  });

  describe('snap on release', () => {
    it('does nothing when the header is already settled', () => {
      expect(headerSnapTarget(0)).toBeNull();
      expect(headerSnapTarget(-12)).toBeNull();
      expect(headerSnapTarget(COLLAPSE_DISTANCE)).toBeNull();
      // Far down the page: a release must never pull the content back to the header.
      expect(headerSnapTarget(900)).toBeNull();
    });

    it('settles a half-collapsed header on the nearer state', () => {
      expect(headerSnapTarget(10)).toBe(0);
      expect(headerSnapTarget(COLLAPSE_DISTANCE / 2 - 1)).toBe(0);
      expect(headerSnapTarget(COLLAPSE_DISTANCE / 2)).toBe(COLLAPSE_DISTANCE);
      expect(headerSnapTarget(COLLAPSE_DISTANCE - 1)).toBe(COLLAPSE_DISTANCE);
    });

    it('counts as collapsed from the same midpoint the snap uses', () => {
      expect(isCollapsed(COLLAPSE_DISTANCE / 2 - 1)).toBe(false);
      expect(isCollapsed(COLLAPSE_DISTANCE / 2)).toBe(true);
    });
  });
});

describe('carousel maths (H-02)', () => {
  const W = 400;

  it('advances one page and rewinds from the last to the first', () => {
    expect(nextPage(0, 4)).toBe(1);
    expect(nextPage(2, 4)).toBe(3);
    expect(nextPage(3, 4)).toBe(0);
    expect(nextPage(0, 1)).toBe(0);
    expect(nextPage(0, 0)).toBe(0);
  });

  it('autoplays only when seen, untouched, with motion allowed, no screen reader and more than one page', () => {
    const base = { reduceMotion: false, screenReader: false, focused: true, appActive: true, touched: false, count: 4 };
    expect(shouldAutoplay(base)).toBe(true);
    expect(shouldAutoplay({ ...base, reduceMotion: true })).toBe(false); // G-09, ADR-025
    expect(shouldAutoplay({ ...base, screenReader: true })).toBe(false);
    expect(shouldAutoplay({ ...base, focused: false })).toBe(false);
    expect(shouldAutoplay({ ...base, appActive: false })).toBe(false); // no overdue timer on resume
    expect(shouldAutoplay({ ...base, touched: true })).toBe(false); // H-02: pauses while touched
    expect(shouldAutoplay({ ...base, count: 1 })).toBe(false);
  });

  describe.each([1, -1] as const)('autoplay target (dir %i)', (dir) => {
    it('goes to the page after the one on screen, and from the last back to the first', () => {
      expect(autoplayTarget(pageOffset(0, W, dir), W, dir, 4)).toBe(1);
      expect(autoplayTarget(pageOffset(2, W, dir), W, dir, 4)).toBe(3);
      expect(autoplayTarget(pageOffset(3, W, dir), W, dir, 4)).toBe(0);
    });

    it('reads a row caught between two pages as the nearer one', () => {
      expect(autoplayTarget(pageOffset(1.4, W, dir), W, dir, 4)).toBe(2);
      expect(autoplayTarget(pageOffset(1.6, W, dir), W, dir, 4)).toBe(3);
    });

    it('treats a rubber-banded row past either end as the end page', () => {
      expect(autoplayTarget(pageOffset(-0.3, W, dir), W, dir, 4)).toBe(1);
      expect(autoplayTarget(pageOffset(3.3, W, dir), W, dir, 4)).toBe(0);
    });

    it('stays on the only page', () => {
      expect(autoplayTarget(pageOffset(0, W, dir), W, dir, 1)).toBe(0);
    });
  });

  it.each([1, -1] as const)('reads the page back from the offset (dir %i)', (dir) => {
    expect(pageAt(pageOffset(2, W, dir), W, dir)).toBe(2);
    // 40 % of the way from page 1 to page 2 still shows page 1.
    expect(pageAt(pageOffset(1.4, W, dir), W, dir)).toBe(1);
  });

  describe.each([1, -1] as const)('release (dir %i)', (dir) => {
    it('a slow release past halfway goes on, before halfway comes back', () => {
      expect(releasePage(0, pageOffset(0.6, W, dir), 0, W, 4, dir)).toBe(1);
      expect(releasePage(0, pageOffset(0.3, W, dir), 0, W, 4, dir)).toBe(0);
    });

    it('a flick towards the reading end goes on even after a short drag', () => {
      // Towards the reading end, the row moves left in English and right in Arabic: velocity -dir.
      const velocity = -dir * 1500;
      expect(releasePage(0, pageOffset(0.1, W, dir), velocity, W, 4, dir)).toBe(1);
    });

    it('a hard fling never skips a page, and never leaves the real pages', () => {
      expect(releasePage(1, pageOffset(1.2, W, dir), -dir * 20_000, W, 4, dir)).toBe(2);
      expect(releasePage(3, pageOffset(3.1, W, dir), -dir * 20_000, W, 4, dir)).toBe(3);
      expect(releasePage(0, pageOffset(-0.2, W, dir), dir * 20_000, W, 4, dir)).toBe(0);
    });
  });
});
