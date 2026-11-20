/**
 * Shared values in tests that behave more like they do on a device. Reanimated's Jest mock differs
 * in two ways that matter to the bottom sheet:
 * - It hands out a fresh shared value on every render. On a device one lives as long as the
 *   component, and the sheet relies on that (it remembers its height).
 * - Its stand-in has no `addListener` / `removeListener`. Gesture Handler watches a config prop given
 *   as a shared value (the sheet body drag's `enabled`) with those on the UI runtime, so without them
 *   every render logs a TypeError that a device would never see.
 */
import { useState } from 'react';
import * as Reanimated from 'react-native-reanimated';

const noop = () => {};

/** Adds the listener methods Gesture Handler calls; everything else goes to the mock's stand-in. */
function listenable<Value>(shared: Reanimated.SharedValue<Value>): Reanimated.SharedValue<Value> {
  return new Proxy(shared, {
    get: (target, prop) => (prop === 'addListener' || prop === 'removeListener' ? noop : Reflect.get(target, prop)),
  });
}

/** A shared value that survives re-renders and accepts listeners. */
export function useKeptSharedValue<Value>(initial: Value | (() => Value)): Reanimated.SharedValue<Value> {
  const [value] = useState(() => listenable(Reanimated.makeMutable(initial instanceof Function ? initial() : initial)));
  return value;
}

/** Makes every `useSharedValue` in the current test a kept one. Undo with `jest.restoreAllMocks()`. */
export function keepSharedValues() {
  return jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(useKeptSharedValue);
}
