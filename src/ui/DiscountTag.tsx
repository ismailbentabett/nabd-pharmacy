/**
 * The "Save 20%" tag on a discounted product (DESIGN §4: the discount chip in a danger tint). The
 * grid tile puts it over the picture and the product page beside the price, so a discount looks the
 * same in both.
 *
 * - Danger text on its own tint: 4.78:1 light, 5.80:1 dark (scripts/contrast.mjs), so it passes as
 *   small text, and the tint is not lime, which keeps the lime budget for the CTA and the badge.
 * - Tabular digits, so "Save 15%" and "Save 20%" take the same width.
 * - Where it sits is the caller's business (`style`): absolute over the picture, or in a row.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';

export type DiscountTagProps = {
  /** Whole percent off, as `discountPercent(product)` returns it. */
  percent: number;
  style?: StyleProp<ViewStyle>;
};

export function DiscountTag({ percent, style }: DiscountTagProps) {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={[styles.tag, style]}>
      <Text variant="caption" weight="semibold" tone="danger" numeric numberOfLines={1}>
        {t('product.save', { p: percent })}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  tag: {
    paddingHorizontal: space.xs,
    paddingVertical: space.hair,
    borderRadius: radius.pill,
    backgroundColor: c.dangerSurface,
  },
}));
