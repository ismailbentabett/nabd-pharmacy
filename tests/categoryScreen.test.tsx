/**
 * The Category screen around the grid (C-01, C-03, H-03, F-05): loading, error and empty states,
 * opening a product, the filter sheet's open/close and what TalkBack sees, and the `category`
 * route param Home's rail sends.
 *
 * The fake API runs with no random failures and a 5 ms delay, so the tests see the real paging and
 * loading states without waiting. The filter sheet is replaced by a probe that records its props:
 * these tests drive Apply directly. The real sheet inside the screen is in categorySheetFlow.test.tsx.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

import { CategoryScreen } from '@/features/category/CategoryScreen';
import type { FilterSortSheetProps } from '@/features/category/FilterSortSheet';
import { resetProductOpenLatchForTest } from '@/motion/hero/openProduct';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { fakeApi as api } from '@/state/api';
import { cartActions, useCartCount } from '@/state/cart.store';
import { testIds } from '@/testIds';

import { firstProduct, noop, productAt, renderScreen, settle } from './helpers/category';
import { pressNative } from './helpers/render';
import { paramStore, testRouter } from './helpers/routeParams';

jest.mock('@/state/api', () => {
  const fake = jest.requireActual('@/core/api/fakeApi').createFakeApi({ delayMs: [5, 5], chaos: 0 });
  return { api: fake, fakeApi: fake };
});
jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/routeParams')>('./helpers/routeParams').expoRouterMock);

const mockSheet: { props: FilterSortSheetProps | null } = { props: null };
jest.mock('@/features/category/FilterSortSheet', () => ({
  FilterSortSheet: (props: FilterSortSheetProps) => {
    mockSheet.props = props;
    return null;
  },
}));

function sheet(): FilterSortSheetProps {
  if (mockSheet.props === null) throw new Error('The filter sheet was not rendered');
  return mockSheet.props;
}

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  resetProductOpenLatchForTest();
  jest.clearAllMocks();
  paramStore.params = {};
  mockSheet.props = null;
  api.debug.forceFailure = false;
  cartActions.clear();
});

describe('CategoryScreen: states', () => {
  it('shows skeletons first, then the grid and the result count', async () => {
    // Hold the first page: a 5 ms request can finish inside render's own act(), and then the
    // loading state would never be on screen to check.
    let release = noop;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const real = api.getProductsPage;
    const held = jest.spyOn(api, 'getProductsPage').mockImplementationOnce(async (request) => {
      await gate;
      return real(request);
    });
    try {
      await renderScreen(<CategoryScreen />);
      expect(screen.getByLabelText('Loading products').props.testID).toBe(testIds.categoryState.loading);
      expect(screen.queryByText('1,000 products')).toBeNull();

      await act(async () => release());
      await screen.findByTestId(testIds.productTile(0));
      expect(screen.queryByTestId(testIds.categoryState.loading, { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('1,000 products')).toBeTruthy();
      expect(screen.getByText('All products')).toBeTruthy();
      await settle();
    } finally {
      held.mockRestore();
    }
  });

  it('opens the product page for the pressed tile', async () => {
    await renderScreen(<CategoryScreen />);
    await screen.findByTestId(testIds.productTile(0));
    await settle();
    await pressNative(testIds.productTile(0));
    expect(testRouter.push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: productAt(0).id } });
  });

  it('shows a full error with retry when the first page fails, then recovers', async () => {
    api.debug.forceFailure = true;
    await renderScreen(<CategoryScreen />);
    await screen.findByTestId(testIds.categoryState.error);
    api.debug.forceFailure = false;
    await fireEvent(screen.getByLabelText('Try again'), 'buttonPress', { nativeEvent: {} });
    await screen.findByTestId(testIds.productTile(0));
    await settle();
  });

  it('shows the empty state for filters that match nothing, and resets them', async () => {
    await renderScreen(<CategoryScreen />);
    await screen.findByTestId(testIds.productTile(0));
    await act(async () => sheet().onApply({ sort: 'relevance', filters: { priceMin: 1_000_000 } }));
    await screen.findByTestId(testIds.categoryState.empty);
    expect(screen.getByText('No products match')).toBeTruthy();
    expect(screen.getByTestId(testIds.filterButton).props.accessibilityLabel).toBe('Filter & sort, 1 filter on');

    await pressNative(testIds.categoryState.reset);
    await screen.findByTestId(testIds.productTile(0));
    expect(sheet().value.filters).toEqual({});
    expect(screen.getByTestId(testIds.filterButton).props.accessibilityLabel).toBe('Filter & sort');
    await settle();
  });
});

describe('CategoryScreen: the filter sheet', () => {
  it('opens from the header button, and Apply both commits and closes it', async () => {
    await renderScreen(<CategoryScreen />);
    expect(sheet().open).toBe(false);
    await pressNative(testIds.filterButton);
    expect(sheet().open).toBe(true);
    await act(async () => sheet().onClose());
    expect(sheet().open).toBe(false);

    await pressNative(testIds.filterButton);
    await act(async () => sheet().onApply({ sort: 'rating', filters: {} }));
    expect(sheet()).toEqual(expect.objectContaining({ open: false, value: { sort: 'rating', filters: {} } }));
    await settle();
  });

  it('hides the header and grid from TalkBack while the sheet is open, then focuses the Filter button', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => undefined);
    await renderScreen(<CategoryScreen />);
    const hiddenAncestor = () => {
      let node = screen.getByTestId(testIds.filterButton, { includeHiddenElements: true }).parent;
      while (node !== null && node.props.importantForAccessibility === undefined) node = node.parent;
      return node;
    };

    expect(hiddenAncestor()?.props.importantForAccessibility).toBe('auto');
    await pressNative(testIds.filterButton);
    expect(hiddenAncestor()?.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(hiddenAncestor()?.props.accessibilityElementsHidden).toBe(true);
    expect(focus).not.toHaveBeenCalled();

    await act(async () => sheet().onClose());
    expect(hiddenAncestor()?.props.importantForAccessibility).toBe('auto');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    focus.mockRestore();
    await settle();
  });
});

describe('CategoryScreen: the category param from Home (H-03)', () => {
  it('preselects the category Home asked for, then clears the param', async () => {
    paramStore.params = { category: 'vitamins' };
    await renderScreen(<CategoryScreen />);
    expect(sheet().value.filters.categories).toEqual(['vitamins']);
    expect(testRouter.setParams).toHaveBeenCalledWith({ category: undefined });
    expect(paramStore.params.category).toBeUndefined();

    await screen.findByTestId(testIds.productTile(0));
    expect(screen.getByText('Vitamins')).toBeTruthy();
    expect(screen.getByText(`${api.countProducts({ filters: { categories: ['vitamins'] } })} products`)).toBeTruthy();
    const firstVitamin = firstProduct((p) => p.category === 'vitamins');
    expect(screen.getByTestId(testIds.productTile(0)).props.accessibilityLabel).toContain(firstVitamin.name);
    await settle();
  });

  it('follows a new category while mounted, and the same one again after the filters changed', async () => {
    await renderScreen(<CategoryScreen />);
    await act(async () => paramStore.set({ category: 'skincare' }));
    expect(sheet().value.filters.categories).toEqual(['skincare']);

    await act(async () => sheet().onApply({ sort: 'priceAsc', filters: { inStockOnly: true } }));
    await act(async () => paramStore.set({ category: 'skincare' }));
    expect(sheet().value).toEqual({ sort: 'priceAsc', filters: { inStockOnly: true, categories: ['skincare'] } });
    await settle();
  });

  it("'all' clears only the category filter: the sort and the other filters stay", async () => {
    await renderScreen(<CategoryScreen />);
    await act(async () => sheet().onApply({ sort: 'priceDesc', filters: { categories: ['vitamins'], inStockOnly: true, minRating: 4 } }));
    expect(screen.getByText('Vitamins')).toBeTruthy();

    await act(async () => paramStore.set({ category: 'all' }));
    expect(sheet().value).toEqual({ sort: 'priceDesc', filters: { inStockOnly: true, minRating: 4 } });
    expect(screen.getByText('All products')).toBeTruthy();
    expect(paramStore.params.category).toBeUndefined();
    await settle();
  });

  it('a new category closes a sheet left open, so its old draft cannot be applied over it', async () => {
    await renderScreen(<CategoryScreen />);
    await pressNative(testIds.filterButton);
    expect(sheet().open).toBe(true);

    await act(async () => paramStore.set({ category: 'vitamins' }));
    expect(sheet().open).toBe(false);
    expect(sheet().value.filters.categories).toEqual(['vitamins']);
    await settle();
  });

  it('ignores a category param it does not know', async () => {
    paramStore.params = { category: 'not-a-category' };
    await renderScreen(<CategoryScreen />);
    expect(sheet().value.filters).toEqual({});
    expect(screen.getByText('All products')).toBeTruthy();
    await settle();
  });
});

function CartCountProbe() {
  return <Text testID="cart-count-probe">{String(useCartCount())}</Text>;
}

describe('F-05: a cart change re-renders nothing in the Category screen', () => {
  it('commits nothing anywhere in the screen when items are added to the cart', async () => {
    const onRender = jest.fn();
    await renderScreen(
      <>
        <Profiler id="screen" onRender={onRender}>
          <CategoryScreen />
        </Profiler>
        <CartCountProbe />
      </>,
    );
    await screen.findByTestId(testIds.productTile(0));
    await settle();
    const commitsBefore = onRender.mock.calls.length;

    await act(async () => cartActions.add(productAt(0).id));
    await act(async () => cartActions.add(productAt(1).id));
    expect(screen.getByTestId('cart-count-probe')).toHaveTextContent('2');
    expect(onRender).toHaveBeenCalledTimes(commitsBefore);
  });
});
