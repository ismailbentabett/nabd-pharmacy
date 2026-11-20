/**
 * Keeps the Android native build under Windows' 260-character path limit (docs/DECISIONS.md, ADR-040).
 *
 * The app's CMake build compiles the codegen sources of every native library. CMake names each object
 * file after its source path, absolute path included, so the object folders go very deep. The NDK's
 * ninja 1.10.2 cannot create folders past 260 characters on Windows, and the Android toolchain lets
 * object paths grow to 1000 characters. With CMAKE_OBJECT_PATH_MAX at 240, CMake replaces the start of
 * a longer object path with a 32-character hash, so the path stays short. macOS and Linux are unaffected.
 *
 * Applied by `npx expo prebuild`. Running prebuild again does not add the line twice.
 */
import { type ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

export const OBJECT_PATH_MAX = 240;
const ARGUMENT = `"-DCMAKE_OBJECT_PATH_MAX=${OBJECT_PATH_MAX}"`;
const LINE = `        externalNativeBuild { cmake { arguments ${ARGUMENT} } }`;

/** Adds the CMake argument inside `defaultConfig { ... }` of android/app/build.gradle. */
export function addObjectPathMax(gradle: string): string {
  if (gradle.includes('CMAKE_OBJECT_PATH_MAX')) return gradle;
  const anchor = /(\n\s*defaultConfig\s*\{\n)/;
  if (!anchor.test(gradle)) {
    throw new Error('withShortObjectPaths: no defaultConfig block in android/app/build.gradle');
  }
  return gradle.replace(anchor, `$1${LINE}\n`);
}

export const withShortObjectPaths: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withShortObjectPaths: expected a Groovy android/app/build.gradle');
    }
    mod.modResults.contents = addObjectPathMax(mod.modResults.contents);
    return mod;
  });
