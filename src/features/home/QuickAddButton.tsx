/**
 * How it works: the lime quick-add "+" on a best-seller card.
 *
 * 1. A press adds exactly one to the cart, buzzes, and tells TalkBack "Added". The cart badge in the
 *    tab bar bumps on its own: it is the only thing subscribed to the cart count.
 * 2. `added` goes 0 → 1 → 0 on the UI thread: a fast critically damped spring in, a hold of
 *    ADDED_HOLD_MS, a calmer spring back. At 1 the plus has turned a quarter, shrunk and faded, and the
 *    check has grown in. One animation sequence replaces a timer plus React state, so neither this
 *    button nor its card re-renders.
 * 3. Pressing again restarts the sequence from wherever it is: `set` replaces the running animation.
 * 4. The rail recycles cards: a card that scrolls out comes back showing another product, with this
 *    same button and its shared value. A new product id stops the sequence and puts the plus back
 *    before the card is painted, so a recycled card never shows another product's tick.
 *
 * Reduced motion: the two icons only cross-fade (no turn, no scale), with the same hold. The hold is
 * `ReduceMotion.Never`: Reanimated's withDelay skips its delay under reduce motion by default, and a
 * pause is not movement.
 * RTL: both icons are symmetric; the card places the button at the reading end.
 */
import { Check, Plus } from 'lucide-react-native';
import { useLayoutEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/design/PressableScale';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { clamp } from '@/motion/gestureMath';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { ADDED_HOLD_MS, effectsDefault, effectsFast, timingReducedFade } from '@/motion/springs';
import { cartActions } from '@/state/cart.store';
import { testIds } from '@/testIds';

/** The visible lime disc; the touch box around it stays 48 x 48. */
export const QUICK_ADD_DISC = 36;
const ICON = 20;
/** A slightly heavier stroke than the app's icons: the glyph sits on lime and must read at 20 dp. */
const ICON_STROKE = size.iconStroke + 0.5;
/** At full "added", the plus has turned a quarter (it reads as becoming the check) ... */
const PLUS_TURN_DEG = 90;
/** ... and shrunk to 60 % as it fades. */
const PLUS_END_SCALE = 0.6;
/** The check grows in from half size. */
const CHECK_START_SCALE = 0.5;

export type QuickAddButtonProps = {
  productId: string;
  /** Product name in the current language, for the label "Add <name> to cart". */
  name: string;
};

export function QuickAddButton({ productId, name }: QuickAddButtonProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const reduceMotion = useMotionPreference();
  const added = useSharedValue(0);

  // A recycled card keeps this button and its shared value: a new product starts from the plus.
  // Layout effect, so the reset lands before the recycled card is painted and never flashes the tick.
  useLayoutEffect(() => {
    cancelAnimation(added);
    added.set(0);
  }, [productId, added]);

  const onPress = () => {
    cartActions.add(productId);
    haptics.confirm();
    AccessibilityInfo.announceForAccessibility(t('product.added'));
    added.set(
      reduceMotion
        ? withSequence(
            withTiming(1, timingReducedFade),
            withDelay(ADDED_HOLD_MS, withTiming(0, timingReducedFade), ReduceMotion.Never),
          )
        : withSequence(withSpring(1, effectsFast), withDelay(ADDED_HOLD_MS, withSpring(0, effectsDefault), ReduceMotion.Never)),
    );
  };

  const plusStyle = useAnimatedStyle(() => {
    const a = added.get();
    const opacity = clamp(1 - a, 0, 1);
    if (reduceMotion) return { opacity };
    return { opacity, transform: [{ rotate: `${a * PLUS_TURN_DEG}deg` }, { scale: 1 - (1 - PLUS_END_SCALE) * a }] };
  });
  const checkStyle = useAnimatedStyle(() => {
    const a = added.get();
    const opacity = clamp(a, 0, 1);
    if (reduceMotion) return { opacity };
    return { opacity, transform: [{ scale: CHECK_START_SCALE + (1 - CHECK_START_SCALE) * a }] };
  });

  const id = testIds.homeQuickAdd(productId);
  return (
    <PressableScale
      testID={id}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.addToCart', { name })}
      style={styles.box}
    >
      <View style={styles.disc}>
        <Animated.View testID={`${id}-plus`} style={[styles.icon, plusStyle]}>
          <Plus size={ICON} color={c.onAccent} strokeWidth={ICON_STROKE} />
        </Animated.View>
        <Animated.View testID={`${id}-check`} style={[styles.icon, checkStyle]}>
          <Check size={ICON} color={c.onAccent} strokeWidth={ICON_STROKE} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  box: { alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: QUICK_ADD_DISC,
    height: QUICK_ADD_DISC,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  icon: { position: 'absolute' },
}));
