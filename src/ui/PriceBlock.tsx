/**
 * A product's price, and the old price struck through when it is discounted. Used by the grid tile,
 * the best-sellers rail and the product page, so a price looks the same everywhere.
 *
 * Catalog prices are DA with TVA included (D-07). They become integer centimes here, at the display
 * boundary, and are formatted from centimes, so there is no float formatting anywhere (CART_SPEC).
 * TalkBack reads one sentence ("1,800.00 DA, was 2,150.00 DA") instead of two loose numbers.
 */
import { View } from 'react-native';

import { toCentimes } from '@/core/money';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { space } from '@/design/tokens';
import { formatDzd } from '@/i18n/format';
import { useT } from '@/i18n/useT';

export type PriceBlockProps = {
  /** DA, TVA included, as stored in the catalog. */
  price: number;
  oldPrice: number | null;
  /** `tile` for grid and rails, `hero` for the product page. */
  size: 'tile' | 'hero';
  testID?: string;
};

export function PriceBlock({ price, oldPrice, size, testID }: PriceBlockProps) {
  const styles = useStyles();
  const { lang, t } = useT();
  const now = formatDzd(toCentimes(price), lang);
  const was = oldPrice !== null && oldPrice > price ? formatDzd(toCentimes(oldPrice), lang) : null;
  const hero = size === 'hero';
  return (
    <View
      testID={testID}
      style={[styles.row, hero && styles.rowHero]}
      accessible
      accessibilityLabel={was ? t('a11y.price', { price: now, old: was }) : now}
    >
      <Text variant={hero ? 'title' : 'label'} weight="semibold" numeric>
        {now}
      </Text>
      {was ? (
        <Text variant={hero ? 'body' : 'caption'} tone="muted" numeric style={styles.was}>
          {was}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.xs },
  rowHero: { columnGap: space.sm },
  was: { textDecorationLine: 'line-through' },
}));
