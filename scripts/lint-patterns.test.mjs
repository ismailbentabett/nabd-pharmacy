// Self-test for the pattern linter: each rule is pinned by one source that must trip it and one that must not.
// Run: node --test scripts/lint-patterns.test.mjs   (part of scripts/check.sh)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lintSource, mask } from './lint-patterns.mjs';

const ids = (rel, src) => lintSource(rel, src).map((f) => f.id);
const flags = (src, id, rel = 'src/features/x/Thing.tsx') => assert.ok(ids(rel, src).includes(id), `expected [${id}] in:\n${src}`);
const clean = (src, id, rel = 'src/features/x/Thing.tsx') => assert.ok(!ids(rel, src).includes(id), `did not expect [${id}] in:\n${src}`);

describe('mask', () => {
  it('keeps length and line breaks, blanks comments in both views and strings only in codeOnly', () => {
    const src = "const a = 'x(y'; // I18nManager\n/* setX( */ b();";
    const { noComments, codeOnly } = mask(src);
    assert.equal(noComments.length, src.length);
    assert.equal(codeOnly.length, src.length);
    assert.equal(noComments.split('\n').length, 2);
    assert.ok(noComments.includes("'x(y'"));
    assert.ok(!noComments.includes('I18nManager'));
    assert.ok(!codeOnly.includes('x(y'));
    assert.ok(codeOnly.includes('b();'));
  });

  it('stops a quote at the end of the line, so an apostrophe in JSX text cannot swallow the file', () => {
    const src = "<Text>Don't</Text>\nconst x = setY(1);";
    assert.ok(mask(src).codeOnly.includes('setY(1)'));
  });
});

describe('line rules', () => {
  it('no-runOnJS', () => {
    flags('scheduleOnRN; runOnJS(f)();', 'no-runOnJS');
    clean('scheduleOnRN(f, 1);', 'no-runOnJS');
  });

  it('no-gh2-builder', () => {
    flags('const pan = Gesture.Pan();', 'no-gh2-builder');
    clean('const pan = usePanGesture({});', 'no-gh2-builder');
  });

  it('no-direct-i18nmanager: code outside src/i18n, but not a comment that mentions it', () => {
    flags('const rtl = I18nManager.isRTL;', 'no-direct-i18nmanager');
    clean('// never read I18nManager here\nconst d = useDirection();', 'no-direct-i18nmanager');
    clean('const rtl = I18nManager.isRTL;', 'no-direct-i18nmanager', 'src/i18n/direction.tsx');
  });

  it('no-raw-hex: everywhere except the palette', () => {
    flags("const c = '#0F2554';", 'no-raw-hex');
    clean("export const navy = '#0F2554';", 'no-raw-hex', 'src/design/palette.ts');
  });

  it('no-left-right', () => {
    flags('const s = { marginLeft: 8 };', 'no-left-right');
    clean('const s = { marginStart: 8 };', 'no-left-right');
  });

  it('no-layout-anim-props: JSX prop outside the cart, but not a const named layout', () => {
    flags('<Animated.View entering={FadeIn} />', 'no-layout-anim-props');
    clean('<Animated.View entering={FadeIn} />', 'no-layout-anim-props', 'src/features/cart/CartRow.tsx');
    clean('export const layout = { gutter: 16 };', 'no-layout-anim-props');
  });

  it('no-inline-spring: spring config only in the springs file', () => {
    flags('withSpring(1, { damping: 20, stiffness: 200 });', 'no-inline-spring');
    clean('const s = { damping: 20 };', 'no-inline-spring', 'src/motion/springs.ts');
  });

  it('no-touchable / no-raw-pressable', () => {
    flags('<TouchableOpacity onPress={f} />', 'no-touchable');
    flags('<Pressable onPress={f} />', 'no-raw-pressable');
    clean('<PressableScale onPress={f} accessibilityLabel="Go" />', 'no-raw-pressable');
    clean('<Pressable onPress={f} />', 'no-raw-pressable', 'src/design/PressableScale.tsx');
  });

  it('no-todo sees comments; lint-ignore silences a line', () => {
    flags('// TODO: later', 'no-todo');
    clean("const c = '#fff'; // lint-ignore: SVG fill needs a literal", 'no-raw-hex');
  });

  it('skips tests and spikes', () => {
    assert.deepEqual(ids('tests/cart.test.ts', 'runOnJS(f)();'), []);
    assert.deepEqual(ids('spikes/hero/A.tsx', 'runOnJS(f)();'), []);
  });
});

describe('structure rules', () => {
  it('no-setstate-in-worklet: a setter inside a gesture callback', () => {
    flags('const g = usePanGesture({ onUpdate: (e) => { setX(e.translationX); } });', 'no-setstate-in-worklet');
  });

  it('no-setstate-in-worklet: a setter in a function marked worklet', () => {
    flags("function onEnd() {\n  'worklet';\n  setOpen(true);\n}", 'no-setstate-in-worklet');
  });

  it('no-setstate-in-worklet: a setter per scroll frame on the JS thread', () => {
    flags('<ScrollView onScroll={(e) => setY(e.nativeEvent.contentOffset.y)} />', 'no-setstate-in-worklet');
  });

  it('no-setstate-in-worklet: allowed when handed to scheduleOnRN, and in plain handlers', () => {
    clean('const g = usePanGesture({ onEnd: () => { scheduleOnRN(setOpen, true); } });', 'no-setstate-in-worklet');
    clean('const onPress = () => setOpen(true);', 'no-setstate-in-worklet');
    clean('useAnimatedStyle(() => { setTimeout(f, 1); return {}; });', 'no-setstate-in-worklet');
    clean('const g = usePanGesture({ onEnd: () => { offset.set(0); } });', 'no-setstate-in-worklet');
  });

  it('shared-value-get-set: .value on a shared value, declared or received', () => {
    flags('const x = useSharedValue(0);\nx.value = 1;', 'shared-value-get-set');
    flags('function f({ progress }: { progress: SharedValue<number> }) { return progress.value; }', 'shared-value-get-set');
    clean('const x = useSharedValue(0);\nx.set(1);', 'shared-value-get-set');
    clean('const first = results.keys().next().value;', 'shared-value-get-set');
  });

  it('no-value-read-render: get() on the JS thread, but fine inside UI-thread code', () => {
    flags('const x = useSharedValue(0);\nconst label = x.get();', 'no-value-read-render');
    clean('const x = useSharedValue(0);\nconst s = useAnimatedStyle(() => ({ opacity: x.get() }));', 'no-value-read-render');
    clean("const x = useSharedValue(0);\nfunction f() {\n  'worklet';\n  return x.get();\n}", 'no-value-read-render');
  });

  it('no-layout-in-animated-style: layout props animated per frame', () => {
    flags('const s = useAnimatedStyle(() => ({ height: h.get() }));', 'no-layout-in-animated-style');
    clean('const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }], opacity: o.get() }));', 'no-layout-in-animated-style');
  });

  it('reports the line the finding is on', () => {
    const [finding] = lintSource('src/x.tsx', 'const a = 1;\n\nconst g = usePanGesture({ onUpdate: () => setX(1) });');
    assert.equal(finding.id, 'no-setstate-in-worklet');
    assert.equal(finding.line, 3);
  });
});
