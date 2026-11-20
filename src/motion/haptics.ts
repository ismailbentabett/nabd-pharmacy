/**
 * The app's whole haptic vocabulary: four meanings, one call each (docs/DESIGN.md §6, skill
 * haptics-vocabulary). Screens say what happened (`haptics.confirm()`), never which motor
 * pattern to play, so the feel stays consistent.
 *
 *   meaning  used for                                   Android constant        iOS
 *   tap      tab change, stepper, chip, carousel snap   CLOCK_TICK              selection
 *   confirm  add to cart, sheet snapped open or closed  VIRTUAL_KEY             light impact
 *   warn     swipe passed the delete threshold         LONG_PRESS              warning
 *   success  item added (optional second beat)         CONFIRM (API 30+)       success
 *
 * Android uses `performAndroidHapticsAsync`, which calls `View.performHapticFeedback`: the same
 * tuned effects the system keyboard and clock use, no VIBRATE permission, and it follows the
 * user's "touch feedback" setting. expo-haptics' iOS-style calls on Android drive the vibrator
 * directly instead, which feels buzzy on mid-range motors.
 *
 * Haptics are independent of reduced motion (they are not movement). From a worklet, call
 * these through `scheduleOnRN(haptics.confirm)`.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticMeaning = 'tap' | 'confirm' | 'warn' | 'success';

/** Two pulses closer than this blur into a buzz (e.g. a stepper held down), so drop the second. */
export const MIN_GAP_MS = 60;

/** Android added CONFIRM in API 30; an older OS rejects the constant, so it gets VIRTUAL_KEY. */
export const ANDROID_CONFIRM_API = 30;

/** The Android system effect for a meaning on a given API level. Pure, so it is tested directly. */
export function androidHapticFor(meaning: HapticMeaning, apiLevel: number): Haptics.AndroidHaptics {
  switch (meaning) {
    case 'tap':
      return Haptics.AndroidHaptics.Clock_Tick;
    case 'confirm':
      return Haptics.AndroidHaptics.Virtual_Key;
    case 'warn':
      return Haptics.AndroidHaptics.Long_Press;
    case 'success':
      return apiLevel >= ANDROID_CONFIRM_API ? Haptics.AndroidHaptics.Confirm : Haptics.AndroidHaptics.Virtual_Key;
  }
}

function playIos(meaning: HapticMeaning): Promise<void> {
  switch (meaning) {
    case 'tap':
      return Haptics.selectionAsync();
    case 'confirm':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'warn':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function play(meaning: HapticMeaning): Promise<void> {
  if (Platform.OS !== 'android') return playIos(meaning);
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  return Haptics.performAndroidHapticsAsync(androidHapticFor(meaning, apiLevel));
}

let lastFiredAt = Number.NEGATIVE_INFINITY;

function fire(meaning: HapticMeaning): void {
  const now = Date.now();
  if (now - lastFiredAt < MIN_GAP_MS) return;
  lastFiredAt = now;
  // The visual feedback has already happened; a pulse the device cannot play is not worth an
  // unhandled promise rejection, and there is nothing the user could do about it.
  play(meaning).catch(() => undefined);
}

export const haptics = {
  tap: () => fire('tap'),
  confirm: () => fire('confirm'),
  warn: () => fire('warn'),
  success: () => fire('success'),
} as const;

/** Tests only: forget the last pulse so rate limiting does not leak between tests. */
export function resetHapticsForTest(): void {
  lastFiredAt = Number.NEGATIVE_INFINITY;
}
