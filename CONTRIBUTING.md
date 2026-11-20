# Contributing to Nabd

Thanks for taking the time to help. This file covers how to set the project up, how to propose a change, and the
rules every change has to follow. The rules are not style preferences: most of them exist because breaking them
costs frames on a mid-range Android phone or breaks the Arabic (RTL) layout.

## Setup

You need Node 22 or 24 (React Native 0.88 and Expo SDK 58 require `^22.13.0 || ^24.3.0`), a JDK and the Android SDK.
Expo Go is not supported; the app is a native build.

```bash
git clone https://github.com/ismailbentabett/nabd-pharmacy.git
cd nabd-pharmacy
npm ci
npm run android          # debug build + Metro, for day-to-day work
```

A fresh clone runs on the built-in fake backend with no keys. Supabase is optional; see the README for the steps.
Put any keys in a local `.env` (it is git-ignored) and never commit it.

Install new dependencies with `npx expo install <pkg>` so the version matches the Expo SDK.

Debug builds are slow and are not used to judge performance. If your change touches motion, lists or images,
check it in a release build on a real Android phone (`npm run android:release`).

## Before you open a pull request

```bash
npm run check            # typecheck, pattern linter (+ its self-test), palette contrast, Jest
npm run lint             # ESLint (expo lint)
```

`npm run check` must pass. CI runs typecheck, lint and Jest on every push and pull request to `master`.

## Branches and commits

- Branch from `master`. Name the branch after the change, for example `fix/cart-undo-race` or `feat/favourite-heart`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `perf:`, `test:`, `docs:`
  (plus `refactor:` and `chore:` when they fit). An optional scope is welcome: `fix(motion): ...`.
- Keep commits small. Each commit should leave `npm run check` green.
- Do not include generated native folders (`android/`, `ios/`) or build output.

## Project rules

These are enforced by review, and many of them by `scripts/lint-patterns.mjs`.

### Motion and rendering

- **No per-frame React state.** Gestures and animations run on the UI thread with Reanimated shared values and
  worklets. Never call `setState` in a gesture `onUpdate` or a scroll handler, and never read `sv.value` during
  render or in an effect.
- Use `scheduleOnRN` / `scheduleOnUI` from `react-native-worklets`. `runOnJS` and `runOnUI` are deprecated.
- **Animate `transform` and `opacity` only** (plus `backgroundColor`). Never animate `width`, `height`, `top`,
  `left` or margins per frame.
- Gesture Handler 3 is a hooks API (`usePanGesture`, ...). Check the installed version's types before writing
  library code.
- Layout animations (`entering`, `exiting`, `layout`) only in non-virtualised lists. Never inside FlashList items.
- Honour the system reduce-motion setting.

### Layout and RTL

- Use logical properties: `start` / `end`, `marginStart`, `paddingEnd`, `borderStartWidth`. Never `left` / `right`
  for layout.
- Do not read `I18nManager` in components. Use `useDirection()`, and multiply gesture and transition math by `dir`.
- Check every UI change in both English (LTR) and Arabic (RTL), gestures included.

### Money

- Money is integer centimes everywhere in logic (1 DA = 100 centimes). Floats appear only at display time. Prices
  include 19% TVA, and the TVA share is `floor((38 * gross + 119) / 238)`. See [docs/CART_SPEC.md](docs/CART_SPEC.md).

### Accessibility

- Touch targets are at least 48 dp.
- Every control has an accessibility label and role.
- Text contrast follows [docs/DESIGN.md](docs/DESIGN.md), and layouts must survive large font scaling.

### Performance numbers

- Never put an estimated number in docs or the README. Numbers come from `scripts/perf/*` output on a real device
  in a release build, with the device model, OS version and build type. If something was not measured, say so.

## Where to read more

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is put together.
- [docs/DESIGN.md](docs/DESIGN.md): design tokens, type, spacing, contrast, and what to avoid.
- [docs/DECISIONS.md](docs/DECISIONS.md): architecture decision records. A change to the stack or a core pattern
  needs a new ADR there.

## Reporting bugs and security issues

Open a bug report from the issue templates. For security problems, do not open a public issue; follow
[SECURITY.md](SECURITY.md).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE) and that you will
follow the [Code of Conduct](CODE_OF_CONDUCT.md).
