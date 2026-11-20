---
name: react-patterns
description: Modern React 19 patterns with the React Compiler: component design, hooks, memoisation policy, effects, composition. Load for any component/hook work.
---
- React Compiler is on: write plain components; don't sprinkle `useMemo/useCallback/memo` unless the profiler shows need (then explain why). Follow Rules of React (pure render, no mutation of props/state, hooks at top level). Keep `eslint-config-expo` + compiler lint clean.
- Component design: small, single purpose, ≤ ~150 lines; props are primitives/stable refs for list items; composition over prop-drilling; slots (`children`, `renderRight`) instead of boolean-flag explosions; colocate state with where it's used.
- Effects: for syncing with external systems only. Derive during render, not via effect+state. Always clean up (timers, listeners, `AccessibilityInfo` subscriptions). Avoid `useEffect` for data fetching → TanStack Query.
- State: lift only as high as needed; server state (Query) ≠ client state (zustand) ≠ animation state (shared values).
- Custom hooks: name `useX`, return stable shapes, no side effects at call time.
- Keys: stable ids, never index for reorderable lists.
- Suspense/transition: not needed here; don't add.
- Avoid context for hot-changing values (cart, scroll); context only for static-ish (theme, direction, locale).
