/**
 * The bottom sheet's physics as plain numbers (C-03): where the drag puts the sheet, which way a
 * release goes, how fast the spring starts, how dark the backdrop is, and that the strip hanging
 * under the sheet is long enough for the hardest throw the spring can produce.
 */
import { RUBBER_BAND_FACTOR } from '@/motion/gestureMath';
import { spatialDefault } from '@/motion/springs';
import { DRAG_SLOP, MAX_FLING_VELOCITY, MAX_OVERDRAG, SCRIM_OPACITY, SCROLL_TOP_TOLERANCE, SKIRT_HEIGHT, backdropOpacity, bodyCanDrag, bottomInsetOverlap, dragPosition, fingerOrigin, isHidden, releaseOpens, releaseVelocity } from '@/ui/bottomSheetMath';

const HEIGHT = 500;

/** Android's touch slop for scrolling (ViewConfiguration), in dp. */
const ANDROID_SCROLL_SLOP = 8;

describe('bodyCanDrag (when a drag on the body moves the sheet)', () => {
  it('is true with the content at its top, including a fraction of a pixel off and an overscroll', () => {
    expect(bodyCanDrag(0)).toBe(true);
    expect(bodyCanDrag(SCROLL_TOP_TOLERANCE)).toBe(true);
    expect(bodyCanDrag(0.4)).toBe(true);
    expect(bodyCanDrag(-12)).toBe(true);
  });

  it('is false once the content is scrolled: the finger scrolls it back instead', () => {
    expect(bodyCanDrag(SCROLL_TOP_TOLERANCE + 0.5)).toBe(false);
    expect(bodyCanDrag(40)).toBe(false);
  });

  it('the drag slop is above zero (a tap stays a tap) and below the scroll slop (the drag decides first)', () => {
    expect(DRAG_SLOP).toBeGreaterThan(0);
    expect(DRAG_SLOP).toBeLessThan(ANDROID_SCROLL_SLOP);
  });
});

describe('dragPosition', () => {
  it('follows the finger 1:1 between open and closed', () => {
    expect(dragPosition(0, 120, HEIGHT)).toBe(120);
    expect(dragPosition(200, -50, HEIGHT)).toBe(150);
  });

  it('stops at closed: there is nothing to show below it', () => {
    expect(dragPosition(400, 300, HEIGHT)).toBe(HEIGHT);
  });

  it('resists above open and never goes past the overdrag limit', () => {
    expect(dragPosition(0, -60, HEIGHT)).toBeCloseTo(-60 * RUBBER_BAND_FACTOR);
    expect(dragPosition(0, -1000, HEIGHT)).toBe(-MAX_OVERDRAG);
  });
});

describe('fingerOrigin (catching the sheet where it is)', () => {
  it('is the position itself between open and closed', () => {
    expect(fingerOrigin(0)).toBe(0);
    expect(fingerOrigin(320)).toBe(320);
  });

  it.each([-5, -30, -MAX_OVERDRAG])('a sheet caught at %d px above open does not jump on the first frame', (caught) => {
    expect(dragPosition(fingerOrigin(caught), 0, HEIGHT)).toBeCloseTo(caught);
  });

  it('a sheet caught mid-bounce higher than the drag limit stays put, then follows the finger down', () => {
    const start = fingerOrigin(-120);
    expect(dragPosition(start, 0, HEIGHT)).toBeCloseTo(-120);
    expect(dragPosition(start, -200, HEIGHT)).toBeCloseTo(-120); // no further up
    expect(dragPosition(start, 70, HEIGHT)).toBeCloseTo(-120 + 70 * RUBBER_BAND_FACTOR);
  });
});

describe('releaseOpens (position and velocity decide together)', () => {
  it('a release without speed goes to the nearer end', () => {
    expect(releaseOpens(240, 0, HEIGHT)).toBe(true);
    expect(releaseOpens(260, 0, HEIGHT)).toBe(false);
  });

  it('a short fast flick down from near open closes it', () => {
    expect(releaseOpens(50, 1500, HEIGHT)).toBe(false);
  });

  it('a drag past the middle that is let go moving up springs back open', () => {
    expect(releaseOpens(300, -800, HEIGHT)).toBe(true);
  });

  it('a flick up from near closed opens it', () => {
    expect(releaseOpens(450, -2000, HEIGHT)).toBe(true);
  });
});

describe('releaseVelocity (the speed the spring starts at)', () => {
  it('is the finger speed between open and closed', () => {
    expect(releaseVelocity(200, 1800)).toBe(1800);
    expect(releaseVelocity(0, -2500)).toBe(-2500);
  });

  it('above open is the sheet speed, which the rubber band cut to 35 %', () => {
    expect(releaseVelocity(-20, 2000)).toBeCloseTo(2000 * RUBBER_BAND_FACTOR);
  });

  it('never exceeds a real fling', () => {
    expect(releaseVelocity(100, 20000)).toBe(MAX_FLING_VELOCITY);
    expect(releaseVelocity(100, -20000)).toBe(-MAX_FLING_VELOCITY);
  });
});

describe('backdropOpacity', () => {
  it('is full when open, clear when closed and proportional in between', () => {
    expect(backdropOpacity(0, HEIGHT, 1)).toBe(SCRIM_OPACITY);
    expect(backdropOpacity(HEIGHT, HEIGHT, 1)).toBe(0);
    expect(backdropOpacity(HEIGHT / 2, HEIGHT, 1)).toBeCloseTo(SCRIM_OPACITY / 2);
  });

  it('does not get darker when the sheet is pulled above open', () => {
    expect(backdropOpacity(-MAX_OVERDRAG, HEIGHT, 1)).toBe(SCRIM_OPACITY);
  });

  it('fades with the reduced-motion fade', () => {
    expect(backdropOpacity(0, HEIGHT, 0.5)).toBeCloseTo(SCRIM_OPACITY / 2);
    expect(backdropOpacity(0, HEIGHT, 0)).toBe(0);
  });

  it('shows nothing before the sheet is measured', () => {
    expect(backdropOpacity(0, 0, 1)).toBe(0);
  });
});

describe('isHidden', () => {
  it('is true at or below closed and before measuring, false anywhere it can be seen', () => {
    expect(isHidden(HEIGHT, HEIGHT)).toBe(true);
    expect(isHidden(0, 0)).toBe(true);
    expect(isHidden(HEIGHT - 1, HEIGHT)).toBe(false);
    expect(isHidden(-10, HEIGHT)).toBe(false);
  });
});

describe('bottomInsetOverlap', () => {
  it('pads for the whole navigation bar when the area reaches the bottom of the window', () => {
    expect(bottomInsetOverlap(24, 900, 900)).toBe(24);
  });

  it('pads for nothing when a taller tab bar sits below the area', () => {
    expect(bottomInsetOverlap(24, 900, 820)).toBe(0);
  });

  it('pads for the part of the bar the area still covers', () => {
    expect(bottomInsetOverlap(24, 900, 890)).toBe(14);
  });
});

/**
 * The damped spring Reanimated steps every frame (closed form, as in its springUtils), started at
 * `position` with `velocity` and heading to 0 (open). Returns how far above open it ever gets.
 */
function peakAboveOpen(position: number, velocity: number): number {
  const { stiffness = Number.NaN, damping = Number.NaN, mass = 1 } = spatialDefault;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
  // Reanimated drops a starting velocity that points away from the target.
  const v0 = position < 0 && velocity < 0 ? 0 : velocity;
  let peak = 0;
  for (let t = 0; t <= 0.5; t += 0.001) {
    const envelope = Math.exp(-zeta * omega0 * t);
    const offset = envelope * (position * Math.cos(omega1 * t) + ((v0 + zeta * omega0 * position) / omega1) * Math.sin(omega1 * t));
    peak = Math.max(peak, -offset);
  }
  return peak;
}

describe('SKIRT_HEIGHT', () => {
  it('covers the highest bounce of any release that opens the sheet', () => {
    let worst = 0;
    for (const height of [300, 500, 800]) {
      for (let position = -MAX_OVERDRAG; position <= height; position += 8) {
        for (let fingerSpeed = -12000; fingerSpeed <= 0; fingerSpeed += 500) {
          if (!releaseOpens(position, fingerSpeed, height)) continue;
          worst = Math.max(worst, peakAboveOpen(position, releaseVelocity(position, fingerSpeed)));
        }
      }
    }
    // The bounce really does pass the drag limit (why the skirt is longer than MAX_OVERDRAG)...
    expect(worst).toBeGreaterThan(MAX_OVERDRAG);
    // ...and the skirt is longer still.
    expect(worst).toBeLessThan(SKIRT_HEIGHT);
  });

  it('an opening without a throw bounces only a little', () => {
    expect(peakAboveOpen(800, 0)).toBeLessThan(MAX_OVERDRAG / 2);
  });
});
