/**
 * The motion tokens promise numbers (DESIGN §6, ADR-006, ADR-037): the hero ends inside the 350 ms
 * transition budget, effects springs never overshoot. These tests integrate each spring
 * numerically (step from 0 to 1) and check the promise, so a retuned constant that breaks it fails
 * here instead of on the phone.
 */
import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

import * as springs from '@/motion/springs';

type Step = { settleMs: number; overshoot: number };

/** Semi-implicit Euler at 0.1 ms; "settled" = the last moment the error was above `tolerance`. */
function simulate(config: WithSpringConfig, tolerance: number): Step {
  const { mass = 1, stiffness = 100, damping = 10 } = config;
  const dt = 0.0001;
  let x = 0;
  let v = 0;
  let lastOutside = 0;
  let peak = 0;
  for (let t = 0; t < 2; t += dt) {
    const accel = (-stiffness * (x - 1) - damping * v) / mass;
    v += accel * dt;
    x += v * dt;
    peak = Math.max(peak, x);
    if (Math.abs(x - 1) > tolerance) lastOutside = t;
  }
  return { settleMs: lastOutside * 1000, overshoot: Math.max(0, peak - 1) };
}

const FRAME_S = 1 / 60;

/**
 * When Reanimated ends the spring: it checks once per frame and snaps to the target as soon as
 * (spring energy + motion energy) / starting energy <= energyThreshold (springUtils.ts,
 * isAnimationTerminatingCalculation). Returns the end time and how far from the target it snapped.
 */
function endOfSpring(config: WithSpringConfig, frameS = FRAME_S): { endMs: number; snapGap: number } {
  const { mass = 1, stiffness = 100, damping = 10, energyThreshold = 6e-9 } = config;
  const energy = (x: number, v: number) => 0.5 * stiffness * (x - 1) ** 2 + 0.5 * mass * v ** 2;
  const initial = energy(0, 0);
  const stepsPerFrame = 200;
  const dt = frameS / stepsPerFrame;
  let x = 0;
  let v = 0;
  for (let frame = 1; frame < 600; frame++) {
    for (let i = 0; i < stepsPerFrame; i++) {
      v += ((-stiffness * (x - 1) - damping * v) / mass) * dt;
      x += v * dt;
    }
    if (energy(x, v) / initial <= energyThreshold) return { endMs: frame * frameS * 1000, snapGap: Math.abs(1 - x) };
  }
  throw new Error('spring never ended');
}

const NAMED = {
  spatialFast: [800, 0.6],
  spatialDefault: [380, 0.8],
  spatialSlow: [200, 0.8],
  effectsFast: [3800, 1],
  effectsDefault: [1600, 1],
  effectsSlow: [800, 1],
  hero: [700, 0.9],
} as const;

describe('spring tokens', () => {
  it.each(Object.entries(NAMED))('%s uses damping = 2ζ√(k·m)', (name, [stiffness, ratio]) => {
    const config = springs[name as keyof typeof NAMED];
    expect(config.mass).toBe(1);
    expect(config.stiffness).toBe(stiffness);
    expect(config.damping).toBeCloseTo(2 * ratio * Math.sqrt(stiffness), 10);
  });

  it('hero settles within 0.1 % in under 320 ms with almost no overshoot', () => {
    const { settleMs, overshoot } = simulate(springs.hero, 0.001);
    expect(settleMs).toBeLessThan(320);
    expect(overshoot).toBeLessThan(0.002);
  });

  it('hero is within 1 % of its target well inside the 350 ms transition budget (F-04)', () => {
    expect(simulate(springs.hero, 0.01).settleMs).toBeLessThan(200);
  });

  it.each(['effectsFast', 'effectsDefault', 'effectsSlow'] as const)('%s never overshoots', (name) => {
    expect(simulate(springs[name], 0.001).overshoot).toBe(0);
  });

  it('spatialFast has a visible bounce; spatialDefault only a hint of one', () => {
    expect(simulate(springs.spatialFast, 0.001).overshoot).toBeGreaterThan(0.05);
    expect(simulate(springs.spatialDefault, 0.001).overshoot).toBeLessThan(0.02);
  });

  it.each(Object.keys(NAMED))('%s snaps to rest at the shared energy threshold', (name) => {
    expect(springs[name as keyof typeof NAMED].energyThreshold).toBe(springs.SPRING_ENERGY_THRESHOLD);
    expect(springs.SPRING_ENERGY_THRESHOLD).toBe(2e-6);
  });

  it('hero ends inside the 350 ms transition budget (F-04) at 60 Hz and at 120 Hz', () => {
    expect(endOfSpring(springs.hero).endMs).toBeLessThanOrEqual(300 + 1e-6);
    expect(endOfSpring(springs.hero, 1 / 120).endMs).toBeLessThan(350);
  });

  it('the snap at the end is invisible: under 0.15 % of the move (under 1 px on a 600 px hero)', () => {
    for (const name of Object.keys(NAMED)) {
      expect(endOfSpring(springs[name as keyof typeof NAMED]).snapGap).toBeLessThan(0.0015);
    }
  });

  it("ends a third sooner than Reanimated's default threshold would", () => {
    const tuned = endOfSpring(springs.hero).endMs;
    const stock = endOfSpring({ ...springs.hero, energyThreshold: 6e-9 }).endMs;
    expect(tuned).toBeLessThan(stock * 0.75);
  });

  it('timings match the token table', () => {
    expect(springs.duration).toEqual({
      micro: 120,
      standard: 220,
      exit: 150,
      reducedFade: 120,
      pressIn: 50,
      pressOut: 100,
      skeletonPulse: 900,
      addedHold: 1200,
      launchReveal: 460,
      launchBreath: 1100,
    });
    expect(springs.ADDED_HOLD_MS).toBe(springs.duration.addedHold);
    expect(springs.timingSkeletonPulse.duration).toBe(900);
    expect(springs.timingStandard.duration).toBe(220);
    expect(springs.timingExit.duration).toBe(150);
    expect(springs.timingLaunchReveal.duration).toBe(460);
    expect(springs.timingLaunchBreath.duration).toBe(1100);
    expect(springs.STAGGER_MS * springs.STAGGER_MAX_ITEMS).toBeLessThanOrEqual(180);
  });

  it('plays the reduced-motion crossfade even when the system removes animations', () => {
    // Every other token follows the system switch and finishes instantly; this one is what
    // replaces them, so it must not be skipped as well (G-09).
    expect(springs.timingReducedFade.reduceMotion).toBe(ReduceMotion.Never);
    expect(springs.timingStandard.reduceMotion).toBeUndefined();
  });
});
