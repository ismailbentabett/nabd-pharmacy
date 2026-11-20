---
name: state-management
description: zustand selectors, TanStack Query infinite lists, MMKV persistence, avoiding re-renders. Load for any store/query work.
---
- zustand v5: `create<State>()((set,get)=>…)`; subscribe with **narrow selectors**; for arrays/objects use `useShallow`; actions live in the store, not components; pure reducers in `core/` for unit tests.
- Never select the whole store. Badge: `useCart(selectCount)`. Row: `useCart(s => s.byId[id])`.
- Persist with a custom MMKV storage adapter (sync, no flash); persist only prefs + cart + tab (small); version + migrate.
- TanStack Query: `useInfiniteQuery` with `getNextPageParam`, `staleTime: Infinity`, `retry: 0` for pages (our retry UI), `placeholderData: keepPreviousData` on filter change; flatten via `select` memoised; prefetch with `queryClient.prefetchInfiniteQuery`.
- Derived data (totals, counts) via selectors, not duplicated state.
- No React context for hot state. No global mutable singletons except the hero registry (UI-thread shared values, documented).
