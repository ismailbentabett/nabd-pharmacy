---
name: testing-rn
description: Jest (jest-expo) and React Native Testing Library conventions, what to test, mocking Reanimated/MMKV/expo-haptics, deterministic time. Load when writing tests.
---
- Pure logic first (`core/`): no RN imports → fast tests. Vectors from `docs/fixtures`. Property tests with seeded RNG.
- Component tests (RNTL v14): query by role/label (proves a11y), `userEvent`, assert behaviour not implementation. Mock `react-native-reanimated` with the official mock, `react-native-mmkv` with an in-memory map, `expo-haptics` no-op. Use fake timers for undo window.
- Determinism: inject seed/clock; fakeApi test mode (`delayMs:[0,0]`, `failEvery`).
- Name tests as sentences; one behaviour each; arrange-act-assert; no snapshot sprawl (snapshots only for formatSar).
- `check.sh` runs `jest --ci`; coverage report informational; target ≥ 90 % on `core/` and `state/`.
- Never mark a task done without pasting real test output.
