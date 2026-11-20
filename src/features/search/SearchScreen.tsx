/**
 * Search: a pushed stack screen over the tabs (opened from Home's search field).
 *
 * - The field is focused on arrival, so the keyboard is up the moment the page is.
 * - Typing is debounced (`SEARCH_DEBOUNCE_MS`) before it becomes a query: a fast typist sends one
 *   request for "omega", not five. Each query is cached by TanStack Query under its own key, so
 *   deleting back to an earlier word shows its results instantly.
 * - While a new query loads, the previous results stay on screen (`keepPreviousData`) instead of
 *   flashing a skeleton between keystrokes; the skeleton only shows for the very first query.
 * - Every state is its own view with its own testID: idle (nothing typed), loading, error with retry,
 *   no matches, results. The backend (`api`) is the fake service offline or Supabase when configured;
 *   this screen does not know which.
 * - Rows are hero sources, like Category tiles: the picture grows from the row into the product page.
 * - A plain FlatList, not FlashList: a search returns at most `SEARCH_LIMIT` rows.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, Search, SearchX, X } from 'lucide-react-native';
import { memo, useEffect, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Product } from '@/core/catalog';
import { toCentimes } from '@/core/money';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { MAX_FONT_SCALE, typeStyle } from '@/design/typography';
import { openProduct } from '@/features/home/homeRoutes';
import { useDirection } from '@/i18n/direction';
import { formatDzd } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useHeroSource } from '@/motion/hero/useHeroSource';
import { api } from '@/state/api';
import { testIds } from '@/testIds';
import { DirectionalIcon } from '@/ui/DirectionalIcon';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PriceBlock } from '@/ui/PriceBlock';
import { ProductImage, productImageUri } from '@/ui/ProductImage';
import { RatingInline } from '@/ui/RatingInline';
import { Skeleton } from '@/ui/Skeleton';

/** How long typing must pause before the text becomes a query. */
export const SEARCH_DEBOUNCE_MS = 250;
/** The most rows one search shows. */
export const SEARCH_LIMIT = 40;
/** The back disc, same as the product page header. */
const DISC = 40;
/** The row's picture, in dp; also the size that is downloaded. */
const THUMB = 72;
const SKELETON_ROWS = 6;
const SKELETON_BAR = 12;

/** The text after the pause, trimmed. Exported for the tests' sake. */
export function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function SearchScreen() {
  const styles = useStyles();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { lang, t, tn } = useT();
  const { isRTL } = useDirection();
  const [text, setText] = useState('');
  const query = useDebounced(text, SEARCH_DEBOUNCE_MS).trim();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.searchProducts(query, SEARCH_LIMIT),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });

  let body: React.ReactNode;
  if (query.length === 0) {
    body = (
      <EmptyState
        icon={Search}
        title={t('search.idle.title')}
        body={t('search.idle.body')}
        testID={testIds.search.idle}
      />
    );
  } else if (isError) {
    body = <ErrorState onRetry={() => void refetch()} testID={testIds.search.error} />;
  } else if (isPending || data === undefined) {
    body = <SearchSkeleton />;
  } else if (data.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('search.empty.title', { query })}
        body={t('search.empty.body')}
        testID={testIds.search.empty}
      />
    );
  } else {
    body = (
      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <SearchRow product={item} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.xl }]}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <Text variant="caption" tone="muted" style={styles.count} testID={testIds.search.count}>
            {tn('search.results', data.length)}
          </Text>
        }
      />
    );
  }

  return (
    <View style={styles.root} testID={testIds.screen.search}>
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('product.back')}
          testID={testIds.search.back}
          style={styles.button}
        >
          <View style={styles.disc}>
            <DirectionalIcon icon={ChevronLeft} size={size.icon} color={c.textPrimary} />
          </View>
        </PressableScale>
        <View style={styles.field}>
          <Search size={20} strokeWidth={size.iconStroke} color={c.textMuted} />
          <TextInput
            testID={testIds.search.input}
            value={text}
            onChangeText={setText}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            placeholder={t('search.placeholder')}
            placeholderTextColor={c.textMuted}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={t('search.placeholder')}
            style={[typeStyle(lang, 'body'), styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
          />
          {text.length > 0 ? (
            <PressableScale
              onPress={() => setText('')}
              accessibilityRole="button"
              accessibilityLabel={t('search.clear')}
              testID={testIds.search.clear}
              style={styles.clear}
            >
              <X size={18} strokeWidth={size.iconStroke} color={c.textMuted} />
            </PressableScale>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>{body}</View>
    </View>
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

function SearchRowView({ product }: { product: Product }) {
  const styles = useStyles();
  const { lang, t } = useT();
  const { ref, hiddenStyle, prepare } = useHeroSource(product.id);
  const name = lang === 'ar' ? product.nameAr : product.name;
  const brand = lang === 'ar' ? product.brandAr : product.brand;
  const now = formatDzd(toCentimes(product.price), lang);
  const price =
    product.oldPrice !== null && product.oldPrice > product.price
      ? t('a11y.price', { price: now, old: formatDzd(toCentimes(product.oldPrice), lang) })
      : now;

  return (
    <PressableScale
      testID={testIds.search.result(product.id)}
      onPress={() => openProduct(product.id, () => prepare(productImageUri(product.id, 1, THUMB)))}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${price}`}
      style={styles.row}
    >
      <View style={styles.rowContent} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View ref={ref} style={[styles.thumb, hiddenStyle]}>
          <ProductImage
            productId={product.id}
            displaySize={THUMB}
            placeholderColor={product.dominantColor}
            style={styles.image}
          />
        </Animated.View>
        <View style={styles.text}>
          <Text variant="label" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {brand}
          </Text>
          <RatingInline rating={product.rating} reviews={product.reviews} />
          <PriceBlock price={product.price} oldPrice={product.oldPrice} size="tile" />
        </View>
      </View>
    </PressableScale>
  );
}

const SearchRow = memo(SearchRowView);

function SearchSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.list} testID={testIds.search.loading}>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <View key={i} style={[styles.row, styles.rowContent]}>
          <Skeleton width={THUMB} height={THUMB} />
          <View style={[styles.text, styles.skeletonText]}>
            <Skeleton width="80%" height={SKELETON_BAR} radius={radius.pill} />
            <Skeleton width="40%" height={SKELETON_BAR} radius={radius.pill} />
            <Skeleton width="30%" height={SKELETON_BAR} radius={radius.pill} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgApp },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xxs,
    paddingHorizontal: layout.gutter - space.xxs,
    paddingBottom: space.xs,
  },
  button: { alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    minHeight: size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
    paddingStart: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
  },
  input: { flex: 1, color: c.textPrimary, paddingVertical: space.xs },
  clear: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  list: { paddingHorizontal: layout.gutter, paddingTop: space.xs },
  count: { marginBottom: space.xs },
  separator: { height: space.xs },
  row: {
    padding: space.xs,
    borderRadius: radius.tile,
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
  },
  rowContent: { flexDirection: 'row', columnGap: space.sm, alignItems: 'center' },
  thumb: { width: THUMB, height: THUMB },
  image: { width: '100%', height: '100%' },
  text: { flex: 1, rowGap: space.hair },
  skeletonText: { rowGap: space.xs },
}));
