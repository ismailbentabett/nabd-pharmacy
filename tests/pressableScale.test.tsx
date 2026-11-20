/**
 * PressableScale wraps Gesture Handler's native `Touchable`: the pressed look (scale + opacity)
 * is drawn natively, so Jest cannot watch it animate. What Jest can check is the contract screens
 * rely on: the press reaches the handler, the control is announced correctly, and the native
 * button receives the press styling, touch area and timing the design asks for.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { DISABLED_OPACITY, PRESSED_OPACITY, PRESSED_SCALE, PressableScale } from '@/design/PressableScale';
import { size } from '@/design/tokens';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { duration } from '@/motion/springs';

/** The native button reports a finished press as `onButtonPress`; this is that event. */
async function pressNative(testID: string) {
  await fireEvent(screen.getByTestId(testID), 'buttonPress', { nativeEvent: {} });
}

async function renderButton(props: Partial<React.ComponentProps<typeof PressableScale>> = {}) {
  return render(
    <PressableScale testID="btn" accessibilityLabel="Add to cart" onPress={() => undefined} {...props}>
      <Text>Add</Text>
    </PressableScale>,
  );
}

// The reduce-motion store is shared by the whole app; each test starts it fresh.
beforeEach(() => {
  resetMotionPreferenceForTest();
});

describe('PressableScale', () => {
  it('calls onPress when the native button reports a press', async () => {
    const onPress = jest.fn();
    const { unmount } = await renderButton({ onPress });

    await pressNative('btn');
    expect(onPress).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('is announced as a button with its label and hint', async () => {
    const { unmount } = await renderButton({ accessibilityHint: 'Adds one to your cart' });

    const button = screen.getByRole('button', { name: 'Add to cart' });
    expect(button.props.accessibilityHint).toBe('Adds one to your cart');
    expect(button.props.accessibilityState).toEqual({ disabled: false });
    await unmount();
  });

  it('merges the caller state with disabled, so a disabled tab still says it is selected', async () => {
    const { unmount } = await renderButton({
      accessibilityRole: 'tab',
      accessibilityState: { selected: true },
      disabled: true,
    });

    expect(screen.getByTestId('btn').props.accessibilityState).toEqual({ selected: true, disabled: true });
    await unmount();
  });

  it('turns the native button off and dims it when disabled', async () => {
    const { unmount } = await renderButton({ disabled: true });

    const button = screen.getByTestId('btn');
    expect(button.props.enabled).toBe(false);
    expect(button.props.defaultOpacity).toBe(DISABLED_OPACITY);
    await unmount();
  });

  it('rests at full opacity when enabled, and dips to the pressed values from the design', async () => {
    const { unmount } = await renderButton();

    const button = screen.getByTestId('btn');
    expect(button.props.defaultOpacity).toBe(1);
    expect(button.props.activeOpacity).toBe(PRESSED_OPACITY);
    expect(button.props.activeScale).toBe(PRESSED_SCALE);
    await unmount();
  });

  it('is never smaller than the 48 dp touch floor, and the caller style still applies', async () => {
    const { unmount } = await renderButton({ style: { minHeight: 56, paddingStart: 12 } });

    const style = StyleSheet.flatten(screen.getByTestId('btn').props.style);
    expect(style.minWidth).toBe(size.touch);
    expect(style.minHeight).toBe(56);
    expect(style.paddingStart).toBe(12);
    await unmount();
  });

  it('accepts a single number for hitSlop and grows every side by it', async () => {
    const { unmount } = await renderButton({ hitSlop: 8 });

    expect(screen.getByTestId('btn').props.gestureHitSlop).toEqual({ top: 8, left: 8, bottom: 8, right: 8 });
    await unmount();
  });

  it('plays the press in and out on the motion duration tokens', async () => {
    const { unmount } = await renderButton();

    const button = screen.getByTestId('btn');
    expect(button.props.tapAnimationInDuration).toBe(duration.pressIn);
    expect(button.props.tapAnimationOutDuration).toBe(duration.pressOut);
    await unmount();
  });

  it('keeps the opacity dip but not the scale when the caller opts out of shrinking', async () => {
    const { unmount } = await renderButton({ shrinkOnPress: false });

    const button = screen.getByTestId('btn');
    expect(button.props.activeScale).toBe(1);
    expect(button.props.activeOpacity).toBe(PRESSED_OPACITY);
    await unmount();
  });

  it('drops the scale but keeps the opacity dip when reduce motion is turned on', async () => {
    const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
    addEventListener.mockClear();
    const { unmount } = await renderButton();
    expect(screen.getByTestId('btn').props.activeScale).toBe(PRESSED_SCALE);

    const emit = addEventListener.mock.calls.at(-1)?.[1] as (enabled: boolean) => void;
    await act(async () => emit(true));

    const button = screen.getByTestId('btn');
    expect(button.props.activeScale).toBe(1);
    expect(button.props.activeOpacity).toBe(PRESSED_OPACITY);
    await unmount();
  });
});
