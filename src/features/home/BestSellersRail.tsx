/**
 * The "Best sellers" rail (H-04): a horizontal FlashList of product cards.
 *
 * The products come from the fake service like every other screen's data (300-800 ms, about 1 in 20
 * requests fails, D-04/D-05), through TanStack Query: Home shows skeleton cards of the same size
 * while it waits and a one-line retry if the request fails (a retry shows the skeletons again
 * straight away). Data is cached for the session, so
 * coming back to Home never shows the skeletons twice.
 *
 * FlashList v2 sizes a horizontal list to its cards and recycles them; keys are product ids. In
 * Arabic the list starts at the right and scrolls leftwards (FlashList reads the native direction).
 *
 * Web preview only (ADR-049): FlashList takes the direction from `I18nManager.isRTL`, which
 * react-native-web always reports as LTR. In Arabic it put card 1 at the far left of a scroller that
 * opens at its right edge, so the rail looked empty. On web the 12 cards go in a plain ScrollView,
 * which follows the page's `dir`. The phone always uses FlashList.
 */
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import type { Product } from '@/core/catalog';
import { makeStyles } from '@/design/theme';
import { layout, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { api } from '@/state/api';
import { testIds } from '@/testIds';
import { ErrorState } from '@/ui/ErrorState';

import { BestSellerCard, BestSellerCardSkeleton } from './BestSellerCard';
import { openCategory } from './homeRoutes';
import { SectionHeader } from './SectionHeader';

const BEST_SELLERS_QUERY_KEY = ['best-sellers'] as const;
const SKELETON_CARDS = 3;

const renderCard: ListRenderItem<Product> = ({ item }) => <BestSellerCard product={item} />;
const keyOf = (product: Product) => product.id;

function Gap() {
  const styles = useStyles();
  return <View style={styles.gap} />;
}

/**
 * The loading row: the real cards' shell and heights, with the list's gutter and gap, so nothing
 * shifts when the products arrive.
 */
function SkeletonRow() {
  const styles = useStyles();
  return (
    <View style={styles.skeletonRow} testID={`${testIds.homeBestSellers}-loading`}>
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <BestSellerCardSkeleton key={`skeleton-${i}`} testID={`${testIds.homeBestSellers}-skeleton-${i}`} />
      ))}
    </View>
  );
}

export function BestSellersRail() {
  const styles = useStyles();
  const { t } = useT();
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: BEST_SELLERS_QUERY_KEY,
    queryFn: () => api.getBestSellers(),
  });

  let body;
  // A retry keeps the query in its error state until the new answer arrives, so "fetching after an
  // error" is the retry: show the skeletons at once rather than a dead error row (F-03).
  if (isPending || (isError && isFetching)) body = <SkeletonRow />;
  else if (isError) body = <ErrorState compact onRetry={() => void refetch()} testID={`${testIds.homeBestSellers}-error`} />;
  else if (data.length === 0) return null;
  else if (Platform.OS === 'web')
    body = (
      <ScrollView
        testID={testIds.homeBestSellers}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {data.map((product, i) => (
          <Fragment key={product.id}>
            {i > 0 && <Gap />}
            <BestSellerCard product={product} />
          </Fragment>
        ))}
      </ScrollView>
    );
  else
    body = (
      <FlashList
        testID={testIds.homeBestSellers}
        horizontal
        data={data}
        renderItem={renderCard}
        keyExtractor={keyOf}
        ItemSeparatorComponent={Gap}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    );

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.bestSellers')} onSeeAll={() => openCategory(null)} />
      {body}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  section: { rowGap: space.xs },
  list: { paddingHorizontal: layout.gutter },
  gap: { width: space.sm },
  // The list's padding and the `Gap` separator, in a plain row.
  skeletonRow: { flexDirection: 'row', columnGap: space.sm, paddingHorizontal: layout.gutter, overflow: 'hidden' },
}));
