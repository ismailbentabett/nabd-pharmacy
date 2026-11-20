/**
 * expo-router for the product page tests: a global `router` that records calls, and the route's
 * params, which a test sets before it renders the route.
 *
 * A mock factory may only reach `mock*` names, so a test file wires it up like this:
 *   jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/productRouter')>('./helpers/productRouter').productRouterMock);
 * and imports `productRoute` or `router` (from expo-router) normally: it is the same module instance.
 */
export const productRoute = { params: {} as { id?: string } };

export const productRouterMock = {
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    replace: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: () => productRoute.params,
};
