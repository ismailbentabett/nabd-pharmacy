/**
 * Swipe-to-delete maths for a cart row (K-02, G-08). These are the worklets the pan gesture runs on
 * the UI thread; here they are plain functions, so every threshold and the Arabic mirror can be pinned
 * without a device. The gesture itself (grab, release, slide out) is exercised in cartScreen.test.tsx.
 */
import {
  ACTION_WIDTH,
  COMMIT_FRACTION,
  COMMIT_MIN,
  commitDistance,
  drawnFromPull,
  drawnVelocity,
  FLING_VELOCITY,
  PAST_ACTION_RESISTANCE,
  pullFromDrawn,
  releaseDecision,
  screenXFromPull,
  toPull,
} from '@/features/cart/swipeMath';
import { PROJECTION_SECONDS, RUBBER_BAND_FACTOR } from '@/motion/gestureMath';

const ROW = 360;

/** What the gesture does on release, from raw screen values, the way useSwipeToDelete chains the helpers. */
function release(translationX: number, velocityX: number, dir: 1 | -1, rowWidth = ROW) {
  const pull = toPull(translationX, dir);
  return {
    decision: releaseDecision(pull, toPull(velocityX, dir), commitDistance(rowWidth)),
    screenX: screenXFromPull(drawnFromPull(pull), dir),
  };
}

describe('direction (G-08)', () => {
  it('counts a drag towards the start edge as pull: left in English, right in Arabic', () => {
    expect(toPull(-40, 1)).toBe(40);
    expect(toPull(40, -1)).toBe(40);
  });

  it('counts a drag towards the end edge as negative pull in both directions', () => {
    expect(toPull(40, 1)).toBe(-40);
    expect(toPull(-40, -1)).toBe(-40);
  });

  it('draws a pulled row towards the start edge: negative translateX in English, positive in Arabic', () => {
    expect(screenXFromPull(30, 1)).toBe(-30);
    expect(screenXFromPull(30, -1)).toBe(30);
  });

  it('mirrors a whole gesture: the Arabic swipe is the English one reflected, with the same outcome', () => {
    for (const [x, v] of [
      [-200, -800],
      [-60, 0],
      [-30, -1800],
      [-170, 900],
      [25, 0],
    ] as const) {
      const en = release(x, v, 1);
      const ar = release(-x, -v, -1);
      expect(ar.decision).toBe(en.decision);
      expect(ar.screenX).toBeCloseTo(-en.screenX);
    }
  });

  it('does not delete in Arabic when the finger moves the English way', () => {
    expect(release(-300, -2000, 1).decision).toBe('delete');
    expect(release(-300, -2000, -1).decision).toBe('closed');
  });
});

describe('drawnFromPull', () => {
  it('follows the finger 1:1 while the delete button is uncovered', () => {
    expect(drawnFromPull(0)).toBe(0);
    expect(drawnFromPull(50)).toBe(50);
    expect(drawnFromPull(ACTION_WIDTH)).toBe(ACTION_WIDTH);
  });

  it('resists past the button and backwards past closed', () => {
    expect(drawnFromPull(ACTION_WIDTH + 100)).toBe(ACTION_WIDTH + 100 * PAST_ACTION_RESISTANCE);
    expect(drawnFromPull(-20)).toBeCloseTo(-20 * RUBBER_BAND_FACTOR);
  });

  it('is continuous at both joins, so the row never jumps under the finger', () => {
    expect(drawnFromPull(ACTION_WIDTH + 0.001)).toBeCloseTo(ACTION_WIDTH, 2);
    expect(drawnFromPull(-0.001)).toBeCloseTo(0, 2);
  });

  it('is undone exactly by pullFromDrawn, so grabbing a moving row continues from where it is drawn', () => {
    for (const pull of [-30, 0, 10, ACTION_WIDTH, ACTION_WIDTH + 1, 300]) {
      expect(pullFromDrawn(drawnFromPull(pull))).toBeCloseTo(pull);
    }
  });

  it('scales the release velocity by the same resistance as the position', () => {
    expect(drawnVelocity(40, 1000)).toBe(1000);
    expect(drawnVelocity(ACTION_WIDTH + 50, 1000)).toBe(1000 * PAST_ACTION_RESISTANCE);
    expect(drawnVelocity(-10, 1000)).toBeCloseTo(1000 * RUBBER_BAND_FACTOR);
  });
});

describe('commitDistance', () => {
  it('is 40 % of the row, never closer than one and a half buttons', () => {
    expect(commitDistance(400)).toBe(400 * COMMIT_FRACTION);
    expect(commitDistance(200)).toBe(COMMIT_MIN);
    expect(COMMIT_MIN).toBe(ACTION_WIDTH * 1.5);
  });

  it('uses the minimum before the row is measured (width 0)', () => {
    expect(commitDistance(0)).toBe(COMMIT_MIN);
  });

  it('sits past the fully opened button, so opening it never deletes', () => {
    expect(COMMIT_MIN).toBeGreaterThan(ACTION_WIDTH);
    expect(releaseDecision(ACTION_WIDTH, 0, commitDistance(0))).toBe('open');
  });
});

describe('releaseDecision', () => {
  const commitAt = commitDistance(ROW);

  it('deletes when released at or past the commit point', () => {
    expect(releaseDecision(commitAt, 0, commitAt)).toBe('delete');
    expect(releaseDecision(commitAt + 1, 0, commitAt)).toBe('delete');
  });

  it('deletes on a flick at FLING_VELOCITY, even short of the point', () => {
    expect(releaseDecision(40, FLING_VELOCITY, commitAt)).toBe('delete');
  });

  it('does not count a throw just under FLING_VELOCITY as a flick: the row rests open', () => {
    // It would coast past the point, but neither the finger nor the speed earned a delete.
    expect(40 + (FLING_VELOCITY - 1) * PROJECTION_SECONDS).toBeGreaterThan(commitAt);
    expect(releaseDecision(40, FLING_VELOCITY - 1, commitAt)).toBe('open');
  });

  it('on a wide row, still needs the flick to carry past the point', () => {
    const wide = commitDistance(1000);
    expect(releaseDecision(0, FLING_VELOCITY, wide)).toBe('open');
  });

  it('cancels when the user flicks back from past the point', () => {
    expect(releaseDecision(commitAt + 10, -2000, commitAt)).toBe('closed');
  });

  it('never deletes from a slow drag that stops short, however far it would coast', () => {
    expect(releaseDecision(commitAt - 5, 400, commitAt)).toBe('open');
  });

  it('rests open or closed, whichever the throw lands nearer', () => {
    expect(releaseDecision(60, 0, commitAt)).toBe('open');
    expect(releaseDecision(30, 0, commitAt)).toBe('closed');
    expect(releaseDecision(60, -600, commitAt)).toBe('closed');
    expect(releaseDecision(10, 600, commitAt)).toBe('open');
  });
});
