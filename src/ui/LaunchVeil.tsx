/**
 * The launch veil (ADR-052): the native splash, carried on in React so the app can leave it with
 * motion instead of a cut.
 *
 * The native splash (pine, the mark at 160 px, app.config.ts) cannot animate. This view draws the
 * same picture on top of the app. Home calls `revealApp()` on its first layout, the native splash
 * hides at that moment, and the user cannot see the swap because both look identical. Then the
 * veil lifts: the mark dips (a small anticipation), opens out and fades while the pine fades off
 * Home, about 460 ms in all. On the web preview, which has no native splash, the veil is what
 * shows while the fonts load, and the mark breathes slowly so the wait reads as "working".
 *
 * Rules it keeps:
 * - Nothing waits on it (F-03, F-07): it never takes touches (`pointerEvents="none"`), so Home is
 *   usable from its first frame, under the fading veil, and nothing is delayed to show it off.
 * - It runs on the UI thread: one shared value per animation, transform and opacity only (F-02).
 *   React hears about it once, at the end, to unmount it.
 * - Reduce motion: no dip, no scale, no breath. The veil fades out in 120 ms.
 * - Screen readers skip it; it is decoration over a screen that is already there.
 *
 * `appReady` lives at module level, like the skeleton pulse: Home and the veil are far apart in the
 * tree, and a flag that only ever goes 0 → 1 does not need a provider.
 */
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  makeMutable,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BrandMark } from '@/design/BrandMark';
import { makeStyles } from '@/design/theme';
import { useMotionPreference } from '@/motion/motionPreference';
import { timingLaunchBreath, timingLaunchReveal, timingReducedFade } from '@/motion/springs';

/** Same size as `splash.imageWidth` in app.config.ts, so the handover from the native splash is invisible. */
export const LAUNCH_MARK_SIZE = 160;
/** How far the mark breathes while the web preview waits for its fonts. */
const BREATH_SCALE = 1.04;
/** Only the web preview waits behind the veil; on a phone the native splash covers the wait. */
const BREATHES = Platform.OS === 'web';

/** 0 until the first screen has laid out, then 1. Set once per JS runtime. */
const appReady = makeMutable(0);
let screenLaidOut = false;

/** Lifts the veil. Safe to call more than once and before the veil mounts. */
export function revealApp(): void {
  appReady.set(1);
}

/**
 * `onLayout` for the root of every tab screen. The first one to lay out (Home on a cold start; any
 * tab after a reload on the web preview) hides the native splash and lifts the veil; later calls do
 * nothing. Hiding on layout, not on mount, means the first thing seen is a drawn screen (F-07).
 */
export function onFirstScreenLayout(): void {
  if (screenLaidOut) return;
  screenLaidOut = true;
  // Nothing to recover if it fails: the native splash then hides on its own timeout.
  SplashScreen.hideAsync().catch(() => undefined);
  revealApp();
}

/** Test-only: put the veil back down. */
export function resetLaunchForTest(): void {
  appReady.set(0);
  screenLaidOut = false;
}

export function LaunchVeil() {
  const styles = useStyles();
  const reduceMotion = useMotionPreference();
  const [gone, setGone] = useState(false);
  /** 0 = covering the app, 1 = lifted. */
  const progress = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    if (!BREATHES || reduceMotion) return;
    breath.set(withRepeat(withTiming(BREATH_SCALE, timingLaunchBreath), -1, true));
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);

  useAnimatedReaction(
    () => appReady.get(),
    (ready, previous) => {
      if (ready !== 1 || previous === 1) return;
      cancelAnimation(breath);
      breath.set(1);
      progress.set(
        withTiming(1, reduceMotion ? timingReducedFade : timingLaunchReveal, (finished) => {
          if (finished) scheduleOnRN(setGone, true);
        }),
      );
    },
  );

  const veilStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.2, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const markStyle = useAnimatedStyle(() => {
    const p = progress.get();
    // Dip to 92 % over the first fifth, then open out to 150 % while it fades.
    const scale = reduceMotion ? 1 : interpolate(p, [0, 0.2, 1], [1, 0.92, 1.5], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0.2, 0.8], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: scale * breath.get() }],
    };
  });

  if (gone) return null;

  return (
    <Animated.View
      testID="launch-veil"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.veil, veilStyle]}
    >
      <Animated.View style={markStyle}>
        <BrandMark size={LAUNCH_MARK_SIZE} cutout={styles.veil.backgroundColor} />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  veil: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSplash },
}));
