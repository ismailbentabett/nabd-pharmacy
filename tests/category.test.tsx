/**
 * The Category grid (C-01, C-02, D-06, F-05, F-06): the tile, the loading and footer states,
 * Arabic, column widths, and the re-render budget. The data hook behind it (paging, retry) is in
 * useProducts.test.tsx; the screen around the grid is in categoryScreen.test.tsx.
 *
 * F-05 is checked two ways. The React Profiler shows that a cart change commits nothing inside the
 * grid. For a new page, the grid does commit (new cells), so the test looks at the tiles already on
 * screen instead: the test renderer swaps a host view's props object only when React re-renders it,
 * so an unchanged props object means that tile did not re-render. A control case shows the check
 * does notice a re-render.
 */
import { act, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { Text } from 'react-native';

import { discountPercent, getCatalog, type Product } from '@/core/catalog';
import { toCentimes } from '@/core/money';
import { layout } from '@/design/tokens';
import { ProductGrid, ProductGridSkeleton, tileWidthFor, type ProductGridProps } from '@/features/category/ProductGrid';
import { ProductTile, tileImageSize } from '@/features/category/ProductTile';
import { formatDzd } from '@/i18n/format';
import { resetProductOpenLatchForTest } from '@/motion/hero/openProduct';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { cartActions, useCartCount } from '@/state/cart.store';
import { testIds } from '@/testIds';
import { productImageUri } from '@/ui/ProductImage';

import { firstProduct, noop, productAt, settle } from './helpers/category';
import { pressNative, renderWithProviders } from './helpers/render';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  resetProductOpenLatchForTest();
  cartActions.clear();
});

describe('ProductTile', () => {
  const sale = firstProduct((p) => discountPercent(p) > 0);

  it('reads name and price as one sentence and reports which tile was pressed', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ProductTile product={sale} index={3} width={170} onPress={onPress} />);
    const now = formatDzd(toCentimes(sale.price), 'en');
    const was = formatDzd(toCentimes(sale.oldPrice ?? 0), 'en');
    expect(screen.getByTestId(testIds.productTile(3)).props.accessibilityLabel).toBe(`${sale.name}, ${now}, was ${was}`);
    expect(screen.getByText(sale.name, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(`Save ${discountPercent(sale)}%`, { includeHiddenElements: true })).toBeTruthy();

    await pressNative(testIds.productTile(3));
    expect(onPress).toHaveBeenCalledWith(sale, 3);
  });

  it('uses the Arabic name, brand and currency in Arabic', async () => {
    const plain = firstProduct((p) => p.oldPrice === null);
    await renderWithProviders(<ProductTile product={plain} index={0} width={170} onPress={noop} />, { lang: 'ar' });
    const label = screen.getByTestId(testIds.productTile(0)).props.accessibilityLabel;
    expect(label).toBe(`${plain.nameAr}, ${formatDzd(toCentimes(plain.price), 'ar')}`);
    expect(screen.getByText(plain.brandAr, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(plain.name, { includeHiddenElements: true })).toBeNull();
  });

  it('downloads the picture at the size it is drawn, not the 800 px original (D-06, F-06)', async () => {
    await renderWithProviders(<ProductTile product={sale} index={0} width={170} onPress={noop} />);
    expect(findImageUri()).toBe(productImageUri(sale.id, 1, tileImageSize(170)));
    expect(findImageUri()).not.toContain('/800/800');
  });
});

/** The image's recycling key, which is the URL it downloads. */
function findImageUri(): string | undefined {
  const stack: unknown[] = [screen.toJSON()];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) stack.push(...node);
    else if (node !== null && typeof node === 'object' && 'props' in node) {
      const { props, children } = node as { props: { recyclingKey?: string }; children: unknown };
      if (typeof props.recyclingKey === 'string') return props.recyclingKey;
      if (children) stack.push(children);
    }
  }
  return undefined;
}

function Grid({ items, footer = 'none', onPressTile = noop, onRetry = noop }: Partial<ProductGridProps> & { items: readonly Product[] }) {
  return <ProductGrid items={items} footer={footer} onEndReached={noop} onRetry={onRetry} onPressTile={onPressTile} bottomInset={0} />;
}

function CartCountProbe() {
  return <Text testID="cart-count-probe">{String(useCartCount())}</Text>;
}

describe('F-05: tiles re-render only when their own props change', () => {
  const page1 = getCatalog().products.slice(0, 20);

  it('commits nothing inside the grid when the cart count changes', async () => {
    const onRender = jest.fn();
    await renderWithProviders(
      <>
        <Profiler id="grid" onRender={onRender}>
          <Grid items={page1} />
        </Profiler>
        <CartCountProbe />
      </>,
    );
    await screen.findByTestId(testIds.productTile(0));
    await settle();
    const commitsBefore = onRender.mock.calls.length;

    await act(async () => cartActions.add(productAt(0).id));
    expect(screen.getByTestId('cart-count-probe')).toHaveTextContent('1');
    expect(onRender).toHaveBeenCalledTimes(commitsBefore);
  });

  it('leaves the tiles on screen alone when the next page of 20 lands; a new handler does re-render them', async () => {
    const tileProps = () => [0, 1].map((index) => screen.getByTestId(testIds.productTile(index)).props);
    const { rerender } = await renderWithProviders(<Grid items={page1} />);
    await settle();
    const before = tileProps();

    await rerender(<Grid items={getCatalog().products.slice(0, 40)} />);
    await settle();
    const afterNextPage = tileProps();
    expect(afterNextPage[0]).toBe(before[0]);
    expect(afterNextPage[1]).toBe(before[1]);

    // Control: the same check does see a re-render when every tile gets a new press handler.
    await rerender(<Grid items={getCatalog().products.slice(0, 40)} onPressTile={() => {}} />);
    await settle();
    expect(tileProps()[0]).not.toBe(before[0]);
  });
});

describe('grid states', () => {
  const items = getCatalog().products.slice(0, 4);

  it('shows a skeleton row while the next page loads', async () => {
    await renderWithProviders(<Grid items={items} footer="loading" />);
    expect(screen.getByTestId(testIds.categoryState.nextPageLoading, { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows a retry row when the next page failed, without hiding the loaded tiles', async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<Grid items={items} footer="error" onRetry={onRetry} />);
    expect(screen.getByTestId(testIds.productTile(0))).toBeTruthy();
    await pressNative(testIds.categoryState.nextPageRetry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('the first-page skeleton is one busy element that says it is loading, in each language', async () => {
    const { unmount } = await renderWithProviders(<ProductGridSkeleton bottomInset={0} />);
    const skeleton = screen.getByLabelText('Loading products');
    expect(skeleton.props.testID).toBe(testIds.categoryState.loading);
    expect(skeleton.props.accessibilityLiveRegion).toBe('polite');
    expect(skeleton.props.accessibilityState).toEqual({ busy: true });
    await unmount();

    await renderWithProviders(<ProductGridSkeleton bottomInset={0} />, { lang: 'ar' });
    expect(screen.getByLabelText('جارٍ تحميل المنتجات')).toBeTruthy();
  });

  it('in Arabic, the grid shows the same products in the same order, named in Arabic', async () => {
    await renderWithProviders(<Grid items={items} />, { lang: 'ar' });
    for (const [index, product] of items.slice(0, 2).entries()) {
      expect(screen.getByTestId(testIds.productTile(index)).props.accessibilityLabel).toMatch(new RegExp(`^${escape(product.nameAr)}, `));
    }
    expect(screen.queryByText(productAt(0).name, { includeHiddenElements: true })).toBeNull();
  });
});

describe('tileWidthFor', () => {
  it('splits the window into two columns after both gutters and the gap, rounding down', () => {
    // 16 dp gutters and a 12 dp gap: (400 - 32 - 12) / 2 = 178; 401 leaves half a dp, dropped.
    expect([layout.gutter, layout.gridGap]).toEqual([16, 12]);
    expect(tileWidthFor(400)).toBe(178);
    expect(tileWidthFor(401)).toBe(178);
    expect(tileWidthFor(402)).toBe(179);
    // Two tiles, two gutters and one gap never overflow the window.
    for (const width of [320, 360, 393, 412, 480]) {
      expect(2 * tileWidthFor(width) + 2 * layout.gutter + layout.gridGap).toBeLessThanOrEqual(width);
    }
  });
});

/** A product name as a literal inside a regular expression. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
