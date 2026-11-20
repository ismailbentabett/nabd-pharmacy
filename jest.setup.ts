/**
 * Native modules do not exist under Jest. Each library ships its own mock; this file loads them
 * once for every test.
 */
import 'react-native-gesture-handler/jestSetup';
import '@shopify/flash-list/jestSetup';

// Reanimated's mock turns `makeMutable` into the identity function, so a module-level shared value
// (the Skeleton's single pulse) would be a bare number with no .get()/.set(). Point it at the
// mock's `useSharedValue`, which builds a working stand-in and calls no hooks. Spreading keeps
// `__esModule: true`, which is an enumerable key in the mock.
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return { ...mock, makeMutable: mock.useSharedValue };
});

// Under Jest, worklets runs as its web build (see jest.resolver.js), which has no UI runtime to
// hand out. Gesture Handler's native file (the compiled lib/module build is what Jest loads) asks
// for one at import time; Gesture Handler's own web file does not.
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings', () =>
  jest.requireActual('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings.web'),
);

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: {
    Clock_Tick: 'clock-tick',
    Virtual_Key: 'virtual-key',
    Long_Press: 'long-press',
    Confirm: 'confirm',
  },
}));

// MMKV switches to its own in-memory store under Jest, but its index also imports Nitro, which
// asks for the native module as soon as it loads. Serve MMKV's mock file alone, without Nitro.
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.requireActual('react-native-mmkv/lib/createMMKV/createMockMMKV').createMockMMKV,
}));
