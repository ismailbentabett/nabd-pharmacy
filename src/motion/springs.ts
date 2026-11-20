/**
 * Every spring and timing in the app (docs/DESIGN.md §6). Components import a name from here and
 * never write `stiffness`/`damping` inline (lint: no-inline-spring), so the whole app has one
 * motion personality and tuning it on the device is a one-file change (ADR-006).
 *
 * Springs are described by stiffness k and damping ratio zeta, which is how a designer thinks
 * (zeta 1 = no bounce, lower = more bounce). Reanimated wants a damping coefficient, which for
 * mass 1 is c = 2 * zeta * sqrt(k).
 *
 * When does a spring end? Reanimated snaps it to the target once its energy (spring + motion)
 * falls below `energyThreshold` x its starting energy. The default, 6e-9, waits until the last
 * 0.008 % of the move, which the eye cannot see but which keeps the animation "running" (and
 * delays `onFinish` callbacks) about half as long again. 2e-6 snaps with at most 0.14 % of the move left,
 * under a pixel on a full-screen hero, so the numbers in the tests are the numbers on screen.
 *
 * Reanimated's default `reduceMotion: ReduceMotion.System` makes every one of these finish
 * instantly when the system "remove animations" setting is on (G-09); `MotionPreferenceSync`
 * keeps that live. Components that need a different reduced-motion behaviour (a crossfade
 * instead of a move) read `useMotionPreference()`.
 */
import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

const MASS = 1;

/** Snap to rest once less than this fraction of the starting energy is left (see header). */
export const SPRING_ENERGY_THRESHOLD = 2e-6;

function springConfig(stiffness: number, dampingRatio: number): WithSpringConfig {
  return {
    mass: MASS,
    stiffness,
    damping: 2 * dampingRatio * Math.sqrt(stiffness * MASS),
    energyThreshold: SPRING_ENERGY_THRESHOLD,
  };
}

/** Spatial springs move things (position, size). A little bounce makes them feel physical. */
export const spatialFast = springConfig(800, 0.6);
export const spatialDefault = springConfig(380, 0.8);
export const spatialSlow = springConfig(200, 0.8);

/** Effect springs change opacity, colour and small scales. Critically damped: no overshoot. */
export const effectsFast = springConfig(3800, 1);
export const effectsDefault = springConfig(1600, 1);
export const effectsSlow = springConfig(800, 1);

/**
 * The shared-element transition. Stiff and nearly critically damped: it ends (snaps to rest) about
 * 300 ms after it starts at 60 Hz, inside the brief's 350 ms (F-04), and its overshoot is about
 * 0.15 %, too small to see.
 */
export const hero = springConfig(700, 0.9);

/** Durations in ms for the few things that are timed rather than sprung. */
export const duration = {
  micro: 120,
  standard: 220,
  exit: 150,
  /** Reduced-motion crossfade replaces movement (DESIGN §6 rule 6). */
  reducedFade: 120,
  /** Pressed state in and out, played natively by Gesture Handler's button (PressableScale). */
  pressIn: 50,
  pressOut: 100,
  /** One half of a skeleton's breath (dark → light). Slow enough to read as "waiting", not as an alert. */
  skeletonPulse: 900,
  /** The launch veil lifting off Home: the mark dips, then opens out and fades (ADR-052). */
  launchReveal: 460,
  /** One half of the launch mark's breath while the web preview loads its fonts. */
  launchBreath: 1100,
  /** How long an add-to-cart button shows its "added" tick before it returns to its label. */
  addedHold: 1200,
} as const;

/**
 * The "added" hold, shared by every add-to-cart button. Play it with
 * `withDelay(ADDED_HOLD_MS, anim, ReduceMotion.Never)`: Reanimated's withDelay skips its delay
 * under reduce motion by default, and a hold is a pause, not movement, so it must survive.
 */
export const ADDED_HOLD_MS = duration.addedHold;

/** Delay between list items that enter together. Max 6 items, never on recycled rows. */
export const STAGGER_MS = 30;
export const STAGGER_MAX_ITEMS = 6;

/** Emphasised decelerate: fast start, long gentle landing. */
export const easeStandard = Easing.bezier(0.2, 0, 0, 1);

export const timingStandard: WithTimingConfig = { duration: duration.standard, easing: easeStandard };
export const timingMicro: WithTimingConfig = { duration: duration.micro, easing: easeStandard };
export const timingExit: WithTimingConfig = { duration: duration.exit, easing: easeStandard };
/** The loading skeleton's breath. Symmetric easing because it plays forwards and backwards. */
export const timingSkeletonPulse: WithTimingConfig = {
  duration: duration.skeletonPulse,
  easing: Easing.inOut(Easing.quad),
};
/** The launch veil's reveal. Decelerating, so Home settles in rather than snapping. */
export const timingLaunchReveal: WithTimingConfig = { duration: duration.launchReveal, easing: easeStandard };
/** The launch mark's idle breath (web only, while fonts load). Symmetric: it plays both ways. */
export const timingLaunchBreath: WithTimingConfig = {
  duration: duration.launchBreath,
  easing: Easing.inOut(Easing.quad),
};
/**
 * The crossfade that replaces movement when reduce motion is on. A fade is not motion, so this one
 * opts out of Reanimated's system switch (ReduceMotion.Never): with the default it would be skipped
 * too and the change would cut instead of fading.
 */
export const timingReducedFade: WithTimingConfig = {
  duration: duration.reducedFade,
  easing: Easing.linear,
  reduceMotion: ReduceMotion.Never,
};
