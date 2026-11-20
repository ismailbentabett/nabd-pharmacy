/**
 * Every tappable surface in the app. Built on Gesture Handler's v3 `Touchable`, whose pressed state
 * (scale + opacity) is animated by the native button view itself: the feedback shows inside the
 * 100 ms budget (F-03) even while the JS thread is busy rendering a page, because no JS runs for it.
 * React only hears about the press when it is confirmed (`onPress`).
 *
 * Reduced motion keeps the opacity dip (it is a state change, not movement) and drops the scale.
 * Every instance is at least 48 x 48 dp (CLAUDE.md accessibility floor); a visually smaller control
 * passes `hitSlop` instead of shrinking its box below that.
 *
 * `ref` reaches the native button view, so a screen can move TalkBack focus back to it
 * (`moveA11yFocus(ref.current)`), e.g. when a sheet it opened closes.
 */
import type { ComponentRef, ReactNode, Ref } from 'react';
import type { Insets, StyleProp, ViewStyle } from 'react-native';
import { Touchable } from 'react-native-gesture-handler';

import { size } from '@/design/tokens';
import { useMotionPreference } from '@/motion/motionPreference';
import { duration } from '@/motion/springs';

/** DESIGN §4: press shrinks to 97 % and dims slightly. */
export const PRESSED_SCALE = 0.97;
export const PRESSED_OPACITY = 0.88;
/** A disabled control stays readable but clearly inactive (DESIGN §4). */
export const DISABLED_OPACITY = 0.4;

const MIN_TOUCH: ViewStyle = { minWidth: size.touch, minHeight: size.touch };
const PRESS_TIMING = { in: duration.pressIn, out: duration.pressOut };

/** The native button view behind a PressableScale. */
export type PressableScaleHandle = ComponentRef<typeof Touchable>;

export type PressableScaleProps = {
  onPress: () => void;
  onLongPress?: () => void;
  /** Read by TalkBack. Required: every control has a label (CLAUDE.md accessibility floor). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'checkbox' | 'switch' | 'imagebutton';
  accessibilityState?: { selected?: boolean; checked?: boolean; expanded?: boolean };
  disabled?: boolean;
  /** Grow the touch area past the box (dp on every side, or per side). */
  hitSlop?: number | Insets;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Some controls (small icons on busy art) read better without the scale. */
  shrinkOnPress?: boolean;
  children: ReactNode;
  ref?: Ref<PressableScaleHandle>;
};

export function PressableScale({
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  disabled = false,
  hitSlop,
  testID,
  style,
  shrinkOnPress = true,
  children,
  ref,
}: PressableScaleProps) {
  const reduceMotion = useMotionPreference();
  return (
    <Touchable
      ref={ref}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      testID={testID}
      style={[MIN_TOUCH, style]}
      activeScale={shrinkOnPress && !reduceMotion ? PRESSED_SCALE : 1}
      activeOpacity={PRESSED_OPACITY}
      defaultOpacity={disabled ? DISABLED_OPACITY : 1}
      animationDuration={PRESS_TIMING}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled }}
      // The same facts as the modern props. RNGH's web button forces `accessibilityRole="button"` and
      // react-native-web ignores `accessibilityState`, so without these a heart reads as a plain button
      // with no on/off state in a browser. `role` and `aria-*` win over the legacy props on every platform.
      role={accessibilityRole === 'imagebutton' ? 'button' : accessibilityRole}
      aria-checked={accessibilityState?.checked}
      aria-selected={accessibilityState?.selected}
      aria-expanded={accessibilityState?.expanded}
      aria-disabled={disabled}
    >
      {children}
    </Touchable>
  );
}
