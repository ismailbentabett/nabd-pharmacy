/**
 * expo-router for the Category tests. The params behave like the router's: a change re-renders the
 * screen in place (the tab stays mounted), and `setParams` merges into them. That is what lets a
 * test change the param while the screen stays mounted, as Home's category rail does.
 *
 * A mock factory may only reach `mock*` names, so a test file wires it up like this:
 *   jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/routeParams')>('./helpers/routeParams').expoRouterMock);
 * and imports `paramStore` / `testRouter` normally (it is the same module instance).
 */
import { useSyncExternalStore } from 'react';

type Params = { category?: string };

export const paramStore = {
  params: {} as Params,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    paramStore.listeners.add(listener);
    return () => paramStore.listeners.delete(listener);
  },
  set(next: Params) {
    paramStore.params = next;
    paramStore.listeners.forEach((listener) => listener());
  },
};

export const testRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn((next: Params) => paramStore.set({ ...paramStore.params, ...next })),
};

export const expoRouterMock = {
  useRouter: () => testRouter,
  useLocalSearchParams: () => useSyncExternalStore(paramStore.subscribe, () => paramStore.params),
  useIsFocused: () => true,
};
