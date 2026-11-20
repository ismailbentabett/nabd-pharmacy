/**
 * The signed-in user's favourites, newest first. Product data comes from the on-device catalog
 * (`findProduct`, synchronous), so the list draws with no request and no loading state.
 *
 * A plain map inside the Account ScrollView, not a virtualised list: it is one person's
 * favourites (tens of rows), and nesting a list inside the scroll view would break its recycling anyway.
 * Each row subscribes to nothing; the parent re-renders only when the id list changes.
 */
import { Heart } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { findProduct } from '@/core/catalog';
import { toHalalas } from '@/core/money';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { openProduct } from '@/features/home/homeRoutes';
import { formatSar } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useFavoriteIds } from '@/state/favorites.store';
import { testIds } from '@/testIds';
import { EmptyState } from '@/ui/EmptyState';
import { PriceBlock } from '@/ui/PriceBlock';
import { ProductImage } from '@/ui/ProductImage';

/** The row's picture, in dp; also the size that is downloaded. */
const THUMB = 56;

export function FavoritesList() {
  const styles = useStyles();
  const ids = useFavoriteIds();

  if (ids.length === 0) {
    return <AccountFavoritesEmpty />;
  }
  return (
    <View style={styles.list} testID={testIds.account.favorites}>
      {ids.map((id) => (
        <FavoriteRow key={id} id={id} />
      ))}
    </View>
  );
}

function AccountFavoritesEmpty() {
  const { t } = useT();
  return (
    <EmptyState
      icon={Heart}
      title={t('account.favorites.empty.title')}
      body={t('account.favorites.empty.body')}
      testID={testIds.account.favoritesEmpty}
    />
  );
}

const FavoriteRow = memo(function FavoriteRow({ id }: { id: string }) {
  const styles = useStyles();
  const { lang } = useT();
  const product = findProduct(id);
  if (product === undefined) return null;
  const name = lang === 'ar' ? product.nameAr : product.name;
  const brand = lang === 'ar' ? product.brandAr : product.brand;

  return (
    <PressableScale
      testID={testIds.account.favorite(id)}
      onPress={() => openProduct(id)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatSar(toHalalas(product.price), lang)}`}
      style={styles.row}
    >
      <View style={styles.rowContent} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ProductImage
          productId={id}
          displaySize={THUMB}
          placeholderColor={product.dominantColor}
          style={styles.thumb}
        />
        <View style={styles.text}>
          <Text variant="label" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {brand}
          </Text>
        </View>
        <PriceBlock price={product.price} oldPrice={product.oldPrice} size="tile" />
      </View>
    </PressableScale>
  );
});

const useStyles = makeStyles((c) => ({
  list: { rowGap: space.xs },
  row: {
    padding: space.xs,
    borderRadius: radius.tile,
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', columnGap: space.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.image },
  text: { flex: 1, rowGap: space.hair },
}));
