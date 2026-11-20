/**
 * The live "reduce motion" system setting (G-09), in two halves that share one source of truth.
 *
 * 1. `useMotionPreference()` is for places whose behaviour changes, not just its speed: the banner
 *    stops auto-playing, the skeleton stops shimmering, the hero transition becomes a crossfade,
 *    pressables stop scaling.
 * 2. `<MotionPreferenceSync />`, mounted once at the root, keeps Reanimated's own switch in step.
 *    Every spring and timing token uses `ReduceMotion.System`, which Reanimated reads once at start
 *    (`global._REANIMATED_IS_REDUCED_MOTION`). Without this, turning the setting on while the app is
 *    open would change the hook's answer but leave every spring running at full length until a
 *    restart.
 *
 * Where the value comes from:
 * - At start: Reanimated's `useReducedMotion()`, a constant read synchronously, so the first frame is
 *   already right (no flash of motion).
 * - Once, when the first component subscribes: `AccessibilityInfo.isReduceMotionEnabled()`, in case
 *   the setting changed between process start and the first screen. It never overwrites a value an
 *   event already delivered, because the event is newer.
 * - After that: one shared `reduceMotionChanged` listener for the whole app.
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReducedMotionConfig, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

/** `null` until the system reports a value; until then the start-up value is right. */
let live: boolean | null = null;
const listeners = new Set<() => void>();
let unsubscribeSystem: (() => void) | null = null;

function setLive(next: boolean) {
  if (next === live) return;
  live = next;
  listeners.forEach((notify) => notify());
}

function startListening() {
  const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setLive);
  unsubscribeSystem = () => subscription.remove();
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      if (live === null) setLive(enabled);
    })
    // The start-up value stays in force; nothing on screen depends on this read succeeding.
    .catch(() => undefined);
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  if (unsubscribeSystem === null) startListening();
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && unsubscribeSystem !== null) {
      unsubscribeSystem();
      unsubscribeSystem = null;
    }
  };
}

function getSnapshot(): boolean | null {
  return live;
}

/** True when the user asked the system to reduce motion. Re-renders when they change it. */
export function useMotionPreference(): boolean {
  const atStartup = useReducedMotion();
  const reported = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return reported ?? atStartup;
}

/**
 * Mount once at the root. Renders nothing while the setting matches what Reanimated read at start,
 * which is almost always: `ReducedMotionConfig` logs a warning in development every time it mounts,
 * and there is nothing to override. When the user flips the setting, it mounts `ReducedMotionConfig`
 * with the new value; when they flip it back, it unmounts, and Reanimated's cleanup restores the
 * start-up value.
 */
export function MotionPreferenceSync() {
  const atStartup = useReducedMotion();
  const reported = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (reported === null || reported === atStartup) return null;
  return <ReducedMotionConfig mode={reported ? ReduceMotion.Always : ReduceMotion.Never} />;
}

/** Tests only: forget what the system reported, as if the app had just started. */
export function resetMotionPreferenceForTest(): void {
  if (listeners.size > 0) throw new Error('unmount every subscriber before resetting');
  live = null;
}
