import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import {
  ANDROID_CONFIRM_API,
  androidHapticFor,
  haptics,
  MIN_GAP_MS,
  resetHapticsForTest,
} from '@/motion/haptics';

const selection = jest.mocked(Haptics.selectionAsync);
const impact = jest.mocked(Haptics.impactAsync);
const notification = jest.mocked(Haptics.notificationAsync);

let now = 1_000;

beforeEach(() => {
  jest.clearAllMocks();
  resetHapticsForTest();
  now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('haptics vocabulary (iOS, the jest-expo default platform)', () => {
  it('maps each meaning to one motor pattern', () => {
    haptics.tap();
    now += MIN_GAP_MS;
    haptics.confirm();
    now += MIN_GAP_MS;
    haptics.warn();
    now += MIN_GAP_MS;
    haptics.success();

    expect(selection).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(notification).toHaveBeenNthCalledWith(1, Haptics.NotificationFeedbackType.Warning);
    expect(notification).toHaveBeenNthCalledWith(2, Haptics.NotificationFeedbackType.Success);
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it('drops a pulse that would blur into the previous one', () => {
    haptics.tap();
    now += MIN_GAP_MS - 1;
    haptics.tap();
    expect(selection).toHaveBeenCalledTimes(1);

    now += 1;
    haptics.tap();
    expect(selection).toHaveBeenCalledTimes(2);
  });

  it('rate limit is shared across meanings (one motor)', () => {
    haptics.confirm();
    now += 10;
    haptics.tap();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(selection).not.toHaveBeenCalled();
  });

  it('a pulse the device rejects does not throw or surface an unhandled rejection', async () => {
    impact.mockRejectedValueOnce(new Error('no vibrator'));
    expect(() => haptics.confirm()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the test run.
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe('androidHapticFor (the Android mapping, pure)', () => {
  it.each([
    ['tap', Haptics.AndroidHaptics.Clock_Tick],
    ['confirm', Haptics.AndroidHaptics.Virtual_Key],
    ['warn', Haptics.AndroidHaptics.Long_Press],
    ['success', Haptics.AndroidHaptics.Confirm],
  ] as const)('%s plays the system feedback constant on Android 11+', (meaning, expected) => {
    expect(androidHapticFor(meaning, ANDROID_CONFIRM_API)).toBe(expected);
  });

  it('success falls back to VIRTUAL_KEY below API 30, where CONFIRM does not exist', () => {
    expect(androidHapticFor('success', ANDROID_CONFIRM_API - 1)).toBe(Haptics.AndroidHaptics.Virtual_Key);
  });
});

describe('haptics vocabulary (Android wiring)', () => {
  /** The module reads Platform when a pulse fires, so the test can switch it per case. */
  function onAndroid(apiLevel: number) {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(apiLevel);
  }

  it('goes through performAndroidHapticsAsync with the API level of the device', () => {
    onAndroid(ANDROID_CONFIRM_API);
    haptics.tap();
    now += MIN_GAP_MS;
    haptics.success();

    expect(jest.mocked(Haptics.performAndroidHapticsAsync).mock.calls.map(([type]) => type)).toEqual([
      Haptics.AndroidHaptics.Clock_Tick,
      Haptics.AndroidHaptics.Confirm,
    ]);
    expect(selection).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it('plays VIRTUAL_KEY for success on Android 10 (API 29)', () => {
    onAndroid(ANDROID_CONFIRM_API - 1);
    haptics.success();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(Haptics.AndroidHaptics.Virtual_Key);
  });

  it('keeps the shared rate limit on Android', () => {
    onAndroid(ANDROID_CONFIRM_API);
    haptics.confirm();
    now += 10;
    haptics.tap();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
  });
});
