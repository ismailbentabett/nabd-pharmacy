/**
 * A block that stands in for content while it loads, drawn at the size of the real content so the
 * layout does not jump when data arrives (DESIGN §4: "skeletons matching final layout").
 *
 * The shimmer is a lighter layer on top whose opacity breathes 0 → 1 → 0. That runs on the UI thread
 * (`withRepeat` on a shared value) and animates opacity only, so a busy JS thread cannot stall it.
 *
 * One pulse for the whole app, not one per block. A loading grid shows about forty blocks; with a
 * shared value each, they would start a few frames apart as they mount and breathe out of step,
 * and the UI thread would run forty identical animations. Instead every block reads the same
 * module-level shared value (`makeMutable`), so they pulse together and only one animation runs.
 * A mount count starts the pulse with the first block and stops it with the last, so nothing
 * animates while no skeleton is on screen.
 *
 * Image-sized blocks can carry the app's mark as a faint, still watermark (`markSize`, ADR-052), so
 * a loading screen reads as this shop rather than a generic grey grid. The mark sits above the
 * shimmer and does not move: the light passes behind it.
 *
 * Reduced motion shows the base block without the shimmer: still clearly "loading", no movement.
 * Screen readers skip it; the screen around it carries the busy state.
 */
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, makeMutable, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

import { BrandMark } from '@/design/BrandMark';
import { makeStyles, useColors } from '@/design/theme';
import { radius as radii } from '@/design/tokens';
import { useMotionPreference } from '@/motion/motionPreference';
import { timingSkeletonPulse } from '@/motion/springs';

/** How strongly the watermark mark shows through. */
const WATERMARK_OPACITY = 0.16;
/** The mark is this share of the block's shorter side. */
export const SKELETON_MARK_RATIO = 0.34;

/** The one pulse every skeleton reads (0 = base colour, 1 = highlight). */
const pulse = makeMutable(0);
/** How many animated skeletons are mounted. Only touched from React effects, on the JS thread. */
let animatedCount = 0;

function startPulse() {
  animatedCount += 1;
  if (animatedCount === 1) pulse.set(withRepeat(withTiming(1, timingSkeletonPulse), -1, true));
}

function stopPulse() {
  animatedCount -= 1;
  if (animatedCount === 0) {
    cancelAnimation(pulse);
    pulse.set(0);
  }
}

export type SkeletonProps = {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Draws the brand mark this big, centred, as a watermark. For blocks that stand in for an image. */
  markSize?: number;
};

export function Skeleton({ width = '100%', height, radius = radii.image, style, testID, markSize }: SkeletonProps) {
  const styles = useStyles();
  const c = useColors();
  const reduceMotion = useMotionPreference();

  useEffect(() => {
    if (reduceMotion) return;
    startPulse();
    return stopPulse;
  }, [reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View
      testID={testID}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {reduceMotion ? null : <Animated.View style={[StyleSheet.absoluteFill, styles.highlight, shimmerStyle]} />}
      {markSize === undefined ? null : (
        <View testID={testID && `${testID}-mark`} style={[StyleSheet.absoluteFill, styles.watermark]}>
          <BrandMark size={markSize} mono={c.textMuted} cutout={c.skeletonBase} />
        </View>
      )}
    </View>
  );
}

/** Test-only: the number of skeletons currently driving the shared pulse. */
export function animatedSkeletonCountForTest() {
  return animatedCount;
}

const useStyles = makeStyles((c) => ({
  base: { backgroundColor: c.skeletonBase, overflow: 'hidden' },
  highlight: { backgroundColor: c.skeletonHighlight },
  // Faint enough to read as a placeholder, not as a picture (about 1.1:1 against the block).
  watermark: { alignItems: 'center', justifyContent: 'center', opacity: WATERMARK_OPACITY },
}));
