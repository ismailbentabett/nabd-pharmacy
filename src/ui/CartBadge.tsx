/**
 * The number on the cart icon (tab bar, product header). It bumps when the count goes up (P-03):
 * a quick scale to 1.35 and a spring back, transform only, played on the UI thread (F-02).
 *
 * The bump is triggered by the count prop changing, not by the add-to-cart button, so any path
 * that adds to the cart (product page, a future quick-add) gets the same feedback for free.
 * A count going down (a cart line removed) changes the number without a bump: celebrating a
 * removal would be the wrong signal.
 *
 * Reduced motion: no scale, a short opacity dip instead, so the change is still noticed (G-09).
 * Hidden from TalkBack: the control that owns it (the cart tab) says "3 items in cart" itself.
 */
import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { formatCount } from '@/i18n/format';
import { useMotionPreference } from '@/motion/motionPreference';
import { spatialFast, timingMicro, timingReducedFade } from '@/motion/springs';
import { testIds } from '@/testIds';

/** How far the badge grows on a bump before it springs back. */
export const BADGE_BUMP_SCALE = 1.35;
/** Above this the badge reads "99+" so it never grows wider than the icon. */
export const BADGE_MAX = 99;
/** The opacity the reduced-motion variant dips to instead of scaling. */
export const BADGE_DIP_OPACITY = 0.4;

/** Inner size of the lime disc; the surface-coloured ring adds BORDER on each side. */
const MIN_SIZE = 18;
const BORDER = 2;
/** Smaller than the caption ramp on purpose: two digits must fit the disc at 1.2x font scale. */
const BADGE_FONT = 11;

export function badgeLabel(count: number): string {
  return count > BADGE_MAX ? `${BADGE_MAX}+` : formatCount(count);
}

export type CartBadgeProps = {
  count: number;
  testID?: string;
};

export function CartBadge({ count, testID = testIds.cartBadge }: CartBadgeProps) {
  const styles = useStyles();
  const reduceMotion = useMotionPreference();
  const scale = useSharedValue(count > 0 ? 1 : 0);
  const opacity = useSharedValue(1);
  const previous = useRef(count);

  useEffect(() => {
    const before = previous.current;
    previous.current = count;
    if (count <= 0) {
      scale.set(0);
      return;
    }
    if (count <= before) return;
    if (reduceMotion) {
      // timingReducedFade is marked ReduceMotion.Never, so this dip still plays when the
      // system setting is on: it is the reduced-motion feedback, not a motion to suppress.
      scale.set(1);
      opacity.set(withSequence(withTiming(BADGE_DIP_OPACITY, timingReducedFade), withTiming(1, timingReducedFade)));
      return;
    }
    // From empty the badge pops in from nothing; otherwise it swells and settles.
    scale.set(
      before <= 0
        ? withSpring(1, spatialFast)
        : withSequence(withTiming(BADGE_BUMP_SCALE, timingMicro), withSpring(1, spatialFast)),
    );
  }, [count, reduceMotion, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  if (count <= 0) return null;

  return (
    <Animated.View
      testID={testID}
      style={[styles.badge, animatedStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Text variant="caption" weight="semibold" tone="onAccent" numeric maxFontSizeMultiplier={1.2} style={styles.text}>
        {badgeLabel(count)}
      </Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    position: 'absolute',
    top: -6,
    end: -10,
    // min sizes, not fixed ones, so a scaled font grows the badge instead of clipping the digits
    minWidth: MIN_SIZE + BORDER * 2,
    minHeight: MIN_SIZE + BORDER * 2,
    paddingHorizontal: space.xxs,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: c.bgSurface,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: BADGE_FONT, lineHeight: MIN_SIZE, includeFontPadding: false },
}));
