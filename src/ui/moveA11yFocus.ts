/**
 * Moves the screen reader's focus to `target` (TalkBack / VoiceOver).
 *
 * react-native-web does not implement `AccessibilityInfo.sendAccessibilityEvent`; calling it there
 * throws and broke the filter sheet in the web preview. The web build is a desktop preview only, so
 * it simply skips the focus move.
 */
import { AccessibilityInfo, Platform } from 'react-native';

type FocusTarget = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];

export function moveA11yFocus(target: FocusTarget): void {
  if (Platform.OS === 'web') return;
  AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
}
