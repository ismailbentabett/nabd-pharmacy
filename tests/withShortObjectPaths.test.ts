import { addObjectPathMax, OBJECT_PATH_MAX } from '../plugins/withShortObjectPaths';

const GRADLE = [
  'android {',
  "    namespace 'com.nabd.pharmacy'",
  '    defaultConfig {',
  "        applicationId 'com.nabd.pharmacy'",
  '        versionCode 1',
  '    }',
  '}',
  '',
].join('\n');

describe('withShortObjectPaths', () => {
  it('adds the CMake argument as the first line of defaultConfig', () => {
    const out = addObjectPathMax(GRADLE).split('\n');
    const at = out.indexOf('    defaultConfig {');
    expect(out[at + 1]).toBe(
      `        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=${OBJECT_PATH_MAX}" } }`,
    );
    expect(out[at + 2]).toBe("        applicationId 'com.nabd.pharmacy'");
  });

  it('does not add the line twice when prebuild runs again', () => {
    const once = addObjectPathMax(GRADLE);
    expect(addObjectPathMax(once)).toBe(once);
    expect(once.match(/CMAKE_OBJECT_PATH_MAX/g)).toHaveLength(1);
  });

  it('fails loudly when the template has no defaultConfig block', () => {
    expect(() => addObjectPathMax('android {\n}\n')).toThrow(/no defaultConfig/);
  });
});
