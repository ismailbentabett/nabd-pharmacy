/**
 * − value + for a quantity (K-03, and the product page's quantity before adding).
 *
 * - Both buttons are full 48 dp targets; the visible pill is drawn inside them.
 * - The number gives a small spring "bump" when it changes, on the UI thread, skipped under reduced
 *   motion. A tick haptic confirms each step without looking.
 * - At the minimum the minus button either disables, or, when the caller passes `onRemove`, turns into
 *   a bin that removes the line (the cart's behaviour, so 1 → 0 means "remove" and can be undone).
 * - TalkBack sees one "adjustable" control: swipe up/down to change it, and it reads the value.
 */
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { formatCount } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { spatialFast, timingMicro } from '@/motion/springs';
import { MAX_QTY } from '@/state/cartMath';

/** How far the number grows on a change before springing back. Small: it confirms, not celebrates. */
export const VALUE_BUMP_SCALE = 1.18;
export const QTY_MIN = 1;

export type QuantityStepperProps = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** When set, the minus button becomes a bin at `min` and calls this instead. */
  onRemove?: () => void;
  /** TalkBack label for the bin, e.g. "Remove Vitamin C from cart". */
  removeLabel?: string;
  min?: number;
  max?: number;
  testID?: string;
};

export function QuantityStepper({
  value,
  onIncrement,
  onDecrement,
  onRemove,
  removeLabel,
  min = QTY_MIN,
  max = MAX_QTY,
  testID,
}: QuantityStepperProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const reduceMotion = useMotionPreference();
  const scale = useSharedValue(1);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (reduceMotion) return;
    scale.set(withSequence(withTiming(VALUE_BUMP_SCALE, timingMicro), withSpring(1, spatialFast)));
  }, [value, reduceMotion, scale]);

  const valueStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const atMin = value <= min;
  const atMax = value >= max;
  const removes = atMin && onRemove !== undefined;

  const increment = () => {
    if (atMax) return;
    haptics.tap();
    onIncrement();
  };
  const decrement = () => {
    if (removes) {
      haptics.warn();
      onRemove();
      return;
    }
    if (atMin) return;
    haptics.tap();
    onDecrement();
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') increment();
    if (event.nativeEvent.actionName === 'decrement' && !atMin) decrement();
  };

  const DecrementIcon = removes ? Trash2 : Minus;

  return (
    <View
      testID={testID}
      style={styles.root}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('a11y.quantity')}
      accessibilityValue={{ min, max, now: value, text: formatCount(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
    >
      <PressableScale
        onPress={decrement}
        disabled={atMin && !removes}
        accessibilityLabel={removes ? (removeLabel ?? t('cart.delete')) : t('a11y.decrease')}
        testID={testID ? `${testID}-decrement` : undefined}
        style={styles.button}
      >
        <DecrementIcon size={size.iconSmall} color={removes ? c.danger : c.textPrimary} strokeWidth={size.iconStroke} />
      </PressableScale>
      <Animated.View style={[styles.value, valueStyle]}>
        <Text variant="label" weight="semibold" numeric align="center" maxFontSizeMultiplier={1.3}>
          {formatCount(value)}
        </Text>
      </Animated.View>
      <PressableScale
        onPress={increment}
        disabled={atMax}
        accessibilityLabel={t('a11y.increase')}
        testID={testID ? `${testID}-increment` : undefined}
        style={styles.button}
      >
        <Plus size={size.iconSmall} color={c.textPrimary} strokeWidth={size.iconStroke} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: c.bgSunken,
    borderRadius: radius.pill,
  },
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  value: { minWidth: space.xl + space.xxs, alignItems: 'center' },
}));
