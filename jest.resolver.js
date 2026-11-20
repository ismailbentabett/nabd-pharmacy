/**
 * Jest accepts one resolver, and two are needed:
 *  - React Native's (set by the jest-expo preset): lets Jest mock `react-native/*` subpaths.
 *  - Reanimated's (which wraps the worklets one): resolves the plain `.ts` files of both libraries
 *    instead of the `.native.ts` ones, which expect the native module and set `IS_JEST = false`.
 * Reanimated's resolver runs first; whenever it falls through to the default resolver, the
 * default is React Native's, which then falls through to Jest's own.
 */
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (innerRequest, innerOptions) =>
      reactNativeResolver(innerRequest, { ...innerOptions, defaultResolver: options.defaultResolver }),
  });
