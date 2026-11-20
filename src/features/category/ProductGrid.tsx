/**
 * The virtualised two-column grid of products (C-01, F-01, F-05).
 *
 * FlashList v2 measures real cell sizes, so there is no size estimate to keep in sync with the tile.
 * What this file controls instead:
 * - Stable keys (the product id) and two item types, so recycled cells keep their view tree.
 * - One `renderItem` for the life of the grid (it only changes with the window width), because
 *   FlashList re-renders a visible cell whenever `renderItem` changes identity.
 * - The tile width is worked out once here from the window width, not measured per tile.
 * - Pages are asked for early: `onEndReached` fires while several screens of products are still
 *   ahead, and FlashList checks again after every page lands, so a fling rarely meets the footer.
 * - The footer is a skeleton row while the next page loads and a retry row if it failed.
 */
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { discountPercent, type Product } from '@/core/catalog';
import { makeStyles } from '@/design/theme';
import { layout, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { testIds } from '@/testIds';
import { ErrorState } from '@/ui/ErrorState';

import { ProductTile, ProductTileSkeleton } from './ProductTile';

const COLUMNS = 2;

/**
 * Fetch the next page while this many screen heights of products are still below the viewport.
 * A page of 20 is 10 rows, about three screens; four screens of runway hides a 300-800 ms request
 * behind normal scrolling. A starting point, to be tuned with the fling measurement (PERF_PLAN).
 */
export const END_REACHED_THRESHOLD = 4;

/** Rows of skeleton tiles shown before the first page arrives. Enough to fill a tall phone. */
const SKELETON_ROWS = 4;

/** Half the gap sits on each side of every tile, so the outer padding makes up the rest of the gutter. */
const CONTENT_PADDING = layout.gutter - layout.gridGap / 2;

/** A tile's outer width for a window `windowWidth` wide: two columns, two gutters, one gap. */
export function tileWidthFor(windowWidth: number): number {
  return Math.floor((windowWidth - 2 * layout.gutter - layout.gridGap) / COLUMNS);
}

export type GridFooter = 'none' | 'loading' | 'error';

export type ProductGridProps = {
  items: readonly Product[];
  footer: GridFooter;
  onEndReached: () => void;
  onRetry: () => void;
  onPressTile: (product: Product, index: number) => void;
  /** Space under the last row, so it can scroll clear of the tab bar. */
  bottomInset: number;
};

const keyExtractor = (product: Product) => product.id;

const getItemType = (product: Product) => (discountPercent(product) > 0 ? 'sale' : 'regular');

export function ProductGrid({ items, footer, onEndReached, onRetry, onPressTile, bottomInset }: ProductGridProps) {
  const styles = useStyles();
  const tileWidth = tileWidthFor(useWindowDimensions().width);

  const renderItem = useCallback<ListRenderItem<Product>>(
    ({ item, index }) => <ProductTile product={item} index={index} width={tileWidth} onPress={onPressTile} />,
    [tileWidth, onPressTile],
  );

  const footerElement =
    footer === 'loading' ? (
      <SkeletonRows rows={1} tileWidth={tileWidth} />
    ) : footer === 'error' ? (
      <View style={styles.footerError}>
        <ErrorState compact onRetry={onRetry} testID={testIds.categoryState.nextPageRetry} />
      </View>
    ) : null;

  return (
    <FlashList
      testID={testIds.productGrid}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      numColumns={COLUMNS}
      onEndReached={onEndReached}
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      ListFooterComponent={footerElement}
      contentContainerStyle={{ ...styles.content, paddingBottom: bottomInset }}
    />
  );
}

/**
 * The first-page placeholder: the grid's own layout, in skeleton tiles, not a spinner. To a screen
 * reader it is one element, "Loading products", announced politely when it appears (a live region),
 * and the grey tiles inside it are not read one by one.
 */
export function ProductGridSkeleton({ bottomInset }: { bottomInset: number }) {
  const styles = useStyles();
  const { t } = useT();
  const tileWidth = tileWidthFor(useWindowDimensions().width);
  return (
    <View
      testID={testIds.categoryState.loading}
      style={[styles.content, styles.skeletonGrid, { paddingBottom: bottomInset }]}
      accessible
      accessibilityLabel={t('state.loading')}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
    >
      <SkeletonRows rows={SKELETON_ROWS} tileWidth={tileWidth} />
    </View>
  );
}

function SkeletonRows({ rows, tileWidth }: { rows: number; tileWidth: number }) {
  const styles = useStyles();
  return (
    <View testID={rows === 1 ? testIds.categoryState.nextPageLoading : undefined} style={styles.skeletonRows}>
      {Array.from({ length: rows * COLUMNS }, (_, slot) => (
        <ProductTileSkeleton key={`skeleton-${slot}`} width={tileWidth} />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  content: { paddingHorizontal: CONTENT_PADDING, paddingTop: space.xs },
  skeletonGrid: { flex: 1, overflow: 'hidden' },
  skeletonRows: { flexDirection: 'row', flexWrap: 'wrap' },
  footerError: { paddingHorizontal: layout.gridGap / 2, paddingBottom: layout.gridGap },
}));
