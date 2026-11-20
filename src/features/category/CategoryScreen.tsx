/**
 * The Category tab: a header with the result count and the "Filter & sort" button, the grid of
 * 1,000 products (C-01) and the filter & sort sheet (C-03).
 *
 * - This screen owns `{ sort, filters }`. Changing them changes the query key, so the grid swaps to
 *   that query's cached pages (or skeletons while the first page loads) and starts at the top.
 * - Home's category rail opens this tab with `?category=<id>` (H-03). The id becomes the category
 *   filter; `?category=all` clears it. The sort and other filters stay. The param is then cleared, so
 *   tapping the same category on Home again applies it again even if the filters were changed in
 *   between. A sheet left open under it closes, so its draft cannot undo the new category.
 * - Nothing here reads the cart. The tab bar is the only cart subscriber, so adding to the cart
 *   never re-renders this screen or its tiles (F-05).
 * - While the sheet is open, the header and grid are hidden from TalkBack, so swiping through the
 *   sheet cannot wander onto tiles behind it. When it closes, focus goes back to the Filter button
 *   that opened it, not to the top of the screen.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Product } from '@/core/catalog';
import { PressableScale, type PressableScaleHandle } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { control, layout, radius, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { openProductPage } from '@/motion/hero/openProduct';
import { testIds } from '@/testIds';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { moveA11yFocus } from '@/ui/moveA11yFocus';
import { onFirstScreenLayout } from '@/ui/LaunchVeil';

import { FilterSortSheet } from './FilterSortSheet';
import { activeFilterCount, asRouteCategory, NO_FILTERS, singleCategory, withRouteCategory, type FilterSortValue } from './filterSortValue';
import { ProductGrid, ProductGridSkeleton, type GridFooter } from './ProductGrid';
import { useProducts } from './useProducts';

/** The tab bar sits below the screen (not over it), so the grid only needs breathing room. */
const BOTTOM_INSET = space.xl;

export function CategoryScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, t, tn } = useT();
  const params = useLocalSearchParams<{ category?: string }>();
  const requested = asRouteCategory(params.category);

  const [value, setValue] = useState<FilterSortValue>(() => withRouteCategory(NO_FILTERS, requested));
  const [seenCategory, setSeenCategory] = useState(requested);
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButton = useRef<PressableScaleHandle>(null);
  const sheetWasOpen = useRef(false);

  // A new category param (or 'all') while the screen is mounted: apply it in this render (React's
  // "adjust state when a prop changes" pattern), so the grid never fetches the old filters for one
  // frame first. A sheet left open closes: its draft was made from the value this replaces.
  if (requested !== seenCategory) {
    setSeenCategory(requested);
    if (requested !== undefined) {
      setValue((current) => withRouteCategory(current, requested));
      setSheetOpen(false);
    }
  }

  // Clear the param once it is applied, so the same category from Home counts as a new request.
  useEffect(() => {
    if (params.category !== undefined) router.setParams({ category: undefined });
  }, [params.category, router]);

  // After the commit that closes the sheet, the button is visible to TalkBack again: focus it.
  useEffect(() => {
    if (sheetWasOpen.current && !sheetOpen && filterButton.current) {
      moveA11yFocus(filterButton.current);
    }
    sheetWasOpen.current = sheetOpen;
  }, [sheetOpen]);

  const products = useProducts({ sort: value.sort, filters: value.filters });
  const filterCount = activeFilterCount(value.filters);

  const only = singleCategory(value.filters);
  const title = only ? (lang === 'ar' ? only.ar : only.en) : t('category.title');

  // Stable across renders (F-05): the grid's renderItem depends on it, so a new function here would
  // re-render every visible tile on each page load, even without the React Compiler.
  const openProduct = useCallback((product: Product) => openProductPage(product.id, { router }), [router]);
  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);
  const apply = (next: FilterSortValue) => {
    setValue(next);
    setSheetOpen(false);
  };
  const resetFilters = () => setValue((current) => ({ ...current, filters: {} }));

  const footer: GridFooter = products.isFetchingNextPage ? 'loading' : products.nextPageError ? 'error' : 'none';

  let body;
  if (products.firstPage === 'loading') {
    body = <ProductGridSkeleton bottomInset={BOTTOM_INSET} />;
  } else if (products.firstPage === 'error') {
    body = (
      <View style={styles.centre}>
        <ErrorState onRetry={products.retry} testID={testIds.categoryState.error} />
      </View>
    );
  } else if (products.items.length === 0) {
    const reset = { label: t('category.reset'), onPress: resetFilters, testID: testIds.categoryState.reset };
    body = (
      <View style={styles.centre}>
        <EmptyState
          icon={SearchX}
          title={t('state.empty.title')}
          body={t('state.empty.body')}
          action={filterCount > 0 ? reset : undefined}
          testID={testIds.categoryState.empty}
        />
      </View>
    );
  } else {
    body = (
      <ProductGrid
        key={products.queryKey}
        items={products.items}
        footer={footer}
        onEndReached={products.fetchNextPage}
        onRetry={products.retry}
        onPressTile={openProduct}
        bottomInset={BOTTOM_INSET}
      />
    );
  }

  return (
    <View testID={testIds.screen.category} style={[styles.root, { paddingTop: insets.top }]} onLayout={onFirstScreenLayout}>
      <View
        style={styles.content}
        importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={sheetOpen}
      >
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text variant="title" weight="semibold" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Text variant="caption" tone="muted" numeric numberOfLines={1}>
              {products.firstPage === 'ready' ? tn('category.count', products.total) : ' '}
            </Text>
          </View>
          <FilterButton ref={filterButton} count={filterCount} expanded={sheetOpen} onPress={openSheet} />
        </View>
        <View style={styles.body}>{body}</View>
      </View>
      <FilterSortSheet open={sheetOpen} value={value} onApply={apply} onClose={closeSheet} />
    </View>
  );
}

type FilterButtonProps = {
  count: number;
  expanded: boolean;
  onPress: () => void;
  ref: Ref<PressableScaleHandle>;
};

/** "Filter & sort", with a lime count of active filters so a narrowed list never looks like the whole catalog. */
function FilterButton({ count, expanded, onPress, ref }: FilterButtonProps) {
  const styles = useStyles();
  const c = useColors();
  const { t, tn } = useT();
  const label = t('category.filter');
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      accessibilityLabel={count > 0 ? `${label}, ${tn('category.activeFilters', count)}` : label}
      accessibilityState={{ expanded }}
      testID={testIds.filterButton}
      style={styles.filterButton}
    >
      <SlidersHorizontal size={size.iconSmall} color={c.textPrimary} strokeWidth={size.iconStroke} />
      <Text variant="label" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
      {count > 0 ? (
        <View style={styles.filterCount}>
          <Text variant="caption" weight="semibold" tone="onAccent" numeric>
            {count}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgApp },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.sm,
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  titleBlock: { flex: 1 },
  body: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: c.lineStrong,
    backgroundColor: c.bgSurface,
  },
  filterCount: {
    minWidth: control.badge,
    height: control.badge,
    paddingHorizontal: space.xxs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
}));
