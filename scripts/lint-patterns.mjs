#!/usr/bin/env node
// Project pattern linter: catches the motion/perf mistakes this codebase forbids, which ESLint does not know about.
// Usage: node scripts/lint-patterns.mjs [files...]   (default: every .ts/.tsx/.js under app/ and src/)
// Exit 1 if any ERROR is found; WARN does not fail. Put `lint-ignore: <reason>` on a line to accept it.
//
// Two kinds of rule:
// - LINE rules: one regex per line. They run on the file with comments blanked out (strings kept), so a
//   comment that *mentions* I18nManager or marginLeft does not trip them. `raw` rules also see comments.
// - STRUCTURE rules: they find regions of code first (worklet bodies, the arguments of UI-thread hooks,
//   gesture configs, scroll handlers) by matching brackets on the file with comments AND strings blanked,
//   then look inside or outside those regions. Known limit: a regex literal that contains a quote or an
//   unbalanced bracket can confuse the masking; none exist in app code, and the self-test pins the rules.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------------------------- line rules
// [id, severity, regex, message, fileFilter?, raw?]
const OUTSIDE = (dir) => new RegExp(`^(?!.*${dir}).*$`);
const LINE_RULES = [
  ['no-runOnJS', 'ERROR', /\brunOn(JS|UI)\b/, 'Deprecated. Use scheduleOnRN / scheduleOnUI from react-native-worklets.'],
  ['no-gh2-builder', 'ERROR', /\bGesture\.(Pan|Tap|Pinch|Rotation|Fling|LongPress|Native|Manual|Race|Simultaneous|Exclusive)\s*\(/, 'Gesture Handler 3 uses hooks (usePanGesture…). Verify API with docs-verifier.'],
  ['no-console', 'ERROR', /\bconsole\.(log|debug|info)\b/, 'Remove console logging.'],
  ['no-rn-animated-js', 'ERROR', /useNativeDriver\s*:\s*false/, 'JS-driven Animated is forbidden. Use Reanimated.'],
  ['no-math-random-core', 'ERROR', /\bMath\.random\s*\(/, 'Use the seeded PRNG (src/core/rng.ts).', /src\/core\//],
  ['no-left-right', 'ERROR', /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft\w*|borderRight\w*)\s*:/, 'Use logical props (marginStart/End, paddingStart/End, borderStart/End) for RTL.'],
  ['no-left-right-pos', 'WARN', /(^|[\s{,])(left|right)\s*:\s*[-\w]/, 'Absolute left/right breaks RTL; prefer start/end.'],
  ['no-raw-hex', 'ERROR', /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/, 'Raw hex outside the palette. Use a semantic colour from useTheme().', OUTSIDE('src/design/palette\\.ts$')],
  ['no-elevation', 'ERROR', /\belevation\s*:/, 'No Android elevation on tiles (overdraw). Allowed only in ui/BottomSheet or the tab bar.', /^(?!.*(BottomSheet|TabBar)).*$/],
  ['no-touchable', 'ERROR', /\bTouchable(Opacity|Highlight|WithoutFeedback)\b/, 'Use PressableScale (src/design/PressableScale.tsx).'],
  ['no-raw-pressable', 'WARN', /<(Pressable|Touchable)\b(?![\w.])/, 'Use PressableScale so the control gets the native pressed state and the 48 dp floor.', OUTSIDE('src/design/')],
  ['no-any', 'WARN', /:\s*any\b|\bas\s+any\b|<any>/, 'Avoid any; use unknown + narrowing.'],
  ['no-ts-ignore', 'ERROR', /@ts-(ignore|nocheck)/, 'No ts-ignore. Fix the types (or @ts-expect-error with a reason).'],
  ['no-todo', 'WARN', /\b(TODO|FIXME|XXX|HACK)\b/, 'Resolve before shipping.', null, true],
  ['no-emoji-ui', 'WARN', /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'No emoji as UI icons.'],
  ['no-index-key', 'WARN', /key=\{(i|idx|index)\}/, 'Use stable ids as keys.'],
  ['no-inline-lambda-render', 'WARN', /renderItem=\{\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*</, 'Inline renderItem; extract a memoised component.'],
  ['no-estimatedItemSize', 'WARN', /estimatedItemSize/, 'FlashList v2 does not use estimatedItemSize.'],
  ['no-layout-anim-props', 'ERROR', /(?<!\b(?:const|let|var)\s+)\b(entering|exiting|layout)\s*=\s*\{/, 'Layout animations only in the cart list (not virtualised). Elsewhere add "lint-ignore: <why this view is not in a recycled list>".', OUTSIDE('src/features/cart/')],
  ['no-inline-spring', 'ERROR', /\b(stiffness|damping|dampingRatio)\s*:/, 'Springs are tokens: import one from src/motion/springs.ts.', OUTSIDE('src/motion/springs\\.ts$')],
  ['no-direct-i18nmanager', 'ERROR', /\bI18nManager\b/, 'Use useDirection(); only src/i18n may touch I18nManager.', OUTSIDE('src/i18n/')],
];

// --------------------------------------------------------------------------------------------- masking
const blank = (s) => s.replace(/[^\n]/g, ' ');

/**
 * Same length and line breaks as `src`, so every index and line number still lines up.
 * `noComments`: comments blanked. `codeOnly`: comments and string/template literals blanked.
 */
export function mask(src) {
  const noComments = [];
  const codeOnly = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    let end = -1;
    let isComment = false;
    if (c === '/' && next === '/') {
      end = src.indexOf('\n', i);
      if (end === -1) end = src.length;
      isComment = true;
    } else if (c === '/' && next === '*') {
      end = src.indexOf('*/', i + 2);
      end = end === -1 ? src.length : end + 2;
      isComment = true;
    } else if (c === '"' || c === "'" || c === '`') {
      end = i + 1;
      while (end < src.length && src[end] !== c) {
        if (src[end] === '\\') end++;
        else if (c !== '`' && src[end] === '\n') break; // unterminated (e.g. an apostrophe in JSX text)
        end++;
      }
      end = Math.min(end + 1, src.length);
    }
    if (end === -1) {
      noComments.push(c);
      codeOnly.push(c);
      i++;
      continue;
    }
    const chunk = src.slice(i, end);
    noComments.push(isComment ? blank(chunk) : chunk);
    codeOnly.push(blank(chunk));
    i = end;
  }
  return { noComments: noComments.join(''), codeOnly: codeOnly.join('') };
}

/** Index of the bracket that closes the one at `open` (any of ( [ {), on comment- and string-free code. */
function closeOf(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return code.length - 1;
}

/** [start, end] ranges covering the argument list of every call matched by `callRe` (which ends at "("). */
function callArgs(code, callRe) {
  return [...code.matchAll(callRe)].map((m) => {
    const open = m.index + m[0].length - 1;
    return [open, closeOf(code, open)];
  });
}

/** Bodies of functions whose first statement is the 'worklet' directive. */
function workletBodies(src, code) {
  const out = [];
  for (const m of src.matchAll(/(['"])worklet\1/g)) {
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(code[k])) k--;
    if (code[k] === '{') out.push([k, closeOf(code, k)]);
  }
  return out;
}

const inside = (ranges, at) => ranges.some(([a, b]) => at > a && at < b);

// Hooks and calls whose function arguments run on the UI thread (Reanimated / Gesture Handler 3 workletize them).
const UI_THREAD_CALLS =
  /\b(useAnimatedStyle|useAnimatedProps|useDerivedValue|useAnimatedReaction|useAnimatedScrollHandler|useFrameCallback|use[A-Z]\w*Gesture|scheduleOnUI)\s*\(/g;
// Animation callbacks (`withSpring(to, cfg, (finished) => …)`) also run on the UI thread.
const ANIMATION_CALLS = /\b(withTiming|withSpring|withDecay|withRepeat|withSequence|withDelay)\s*\(/g;
// A JS-thread scroll handler fires every frame: setting state there re-renders per frame.
const JS_SCROLL_PROP = /\bonScroll\s*=\s*\{/g;
const SCHEDULE_ON_RN = /\bscheduleOnRN\s*\(/g;

// A React setter call: setX( … but not obj.setX(, sv.set(, setTimeout( or zustand's set(.
const SETTER_CALL = /(?<![\w$.])set(?!Timeout\b|Interval\b|Immediate\b)[A-Z]\w*\s*\(/g;
// Shared values declared in this file, or received with a SharedValue/DerivedValue type.
const SHARED_VALUE_DECL = /\b(?:const|let)\s+(\w+)\s*=\s*use(?:SharedValue|DerivedValue|ScrollOffset|ScrollViewOffset)\s*[<(]/g;
const SHARED_VALUE_TYPED = /\b(\w+)\s*\??\s*:\s*(?:Readonly<\s*)?(?:SharedValue|DerivedValue)\s*</g;
// Layout props animated per frame force a layout pass on every frame (CLAUDE.md: transform + opacity only).
const LAYOUT_KEY =
  /(?<![\w$.])(width|height|top|bottom|left|right|start|end|inset\w*|margin\w*|padding\w*|minWidth|maxWidth|minHeight|maxHeight|flex\w*|aspectRatio|borderWidth)\s*:(?!:)/g;

function structureFindings(src, code) {
  const findings = [];
  const add = (at, id, sev, msg) => findings.push({ at, id, sev, msg });
  const worklets = workletBodies(src, code);
  const uiCalls = callArgs(code, UI_THREAD_CALLS);
  const uiThread = [...worklets, ...uiCalls];
  const toRN = callArgs(code, SCHEDULE_ON_RN);

  // 1. A React setter called from UI-thread code (crashes: JS functions cannot run there) or per scroll frame.
  const setterRegions = [...uiThread, ...callArgs(code, ANIMATION_CALLS), ...callArgs(code, JS_SCROLL_PROP)];
  for (const m of code.matchAll(SETTER_CALL)) {
    if (inside(setterRegions, m.index) && !inside(toRN, m.index)) {
      add(m.index, 'no-setstate-in-worklet', 'ERROR', 'React state set from a worklet or per scroll frame. Use scheduleOnRN for a discrete event, or keep it in a shared value.');
    }
  }

  // 2. Shared values: get()/set() only (React Compiler), and no reads on the JS thread.
  const names = new Set([...code.matchAll(SHARED_VALUE_DECL), ...code.matchAll(SHARED_VALUE_TYPED)].map((m) => m[1]));
  for (const name of names) {
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${name}\\s*\\.\\s*value\\b`, 'g'))) {
      add(m.index, 'shared-value-get-set', 'ERROR', `Use ${name}.get() / ${name}.set(): React Compiler is on, and it treats writing .value as mutating a hook result.`);
    }
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${name}\\s*\\.\\s*get\\s*\\(`, 'g'))) {
      if (!inside(uiThread, m.index)) {
        add(m.index, 'no-value-read-render', 'ERROR', `${name}.get() on the JS thread (render, effect or handler). Read shared values inside worklets: useAnimatedStyle, useDerivedValue, a gesture callback.`);
      }
    }
  }

  // 3. Layout props inside useAnimatedStyle.
  for (const [a, b] of callArgs(code, /\buseAnimatedStyle\s*\(/g)) {
    for (const m of code.slice(a, b).matchAll(LAYOUT_KEY)) {
      add(a + m.index, 'no-layout-in-animated-style', 'ERROR', `"${m[1]}" animated per frame re-runs layout. Animate transform and opacity (or backgroundColor) instead.`);
    }
  }
  return findings;
}

// ------------------------------------------------------------------------------------------------ API
/** Lints one file's source. `rel` is the repo-relative path with forward slashes. */
export function lintSource(rel, src) {
  if (/\.test\.|__tests__|spikes\//.test(rel)) return [];
  const { noComments, codeOnly } = mask(src);
  const rawLines = src.split('\n');
  const codeLines = noComments.split('\n');
  const findings = [];
  const ignored = (line) => /lint-ignore/.test(rawLines[line - 1] ?? '');

  for (const [id, sev, re, msg, fileFilter, raw] of LINE_RULES) {
    if (fileFilter && !fileFilter.test(rel)) continue;
    (raw ? rawLines : codeLines).forEach((text, i) => {
      if (re.test(text) && !ignored(i + 1)) findings.push({ sev, line: i + 1, id, msg });
    });
  }
  for (const { at, id, sev, msg } of structureFindings(src, codeOnly)) {
    const line = src.slice(0, at).split('\n').length;
    if (!ignored(line)) findings.push({ sev, line, id, msg });
  }
  if (rawLines.length > 300) {
    findings.push({ sev: 'WARN', line: 1, id: 'file-size', msg: `${rawLines.length} lines; split (target ≤ 250).` });
  }
  return findings.sort((x, y) => x.line - y.line);
}

// ------------------------------------------------------------------------------------------------ CLI
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(path);
  }
  return out;
}

function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const files = args.length ? args : [...walk(join(root, 'app')), ...walk(join(root, 'src'))];
  let errors = 0;
  let warns = 0;
  for (const file of files) {
    const rel = relative(root, file).split(sep).join('/');
    for (const { sev, line, id, msg } of lintSource(rel, readFileSync(file, 'utf8'))) {
      if (sev === 'ERROR') errors++;
      else warns++;
      console.log(`${sev} ${rel}:${line} [${id}] ${msg}`);
    }
  }
  console.log(`\npattern lint: ${errors} error(s), ${warns} warning(s) in ${files.length} file(s)`);
  process.exit(errors ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
