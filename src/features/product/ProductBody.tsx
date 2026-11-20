/**
 * Everything under the gallery: who makes it, what it is, what it costs and why to trust it.
 *
 * Plain views and text, rendered once: the hero transition fades and lifts this whole block as one
 * layer (contentStyle), so nothing in here animates on its own. Names and descriptions follow the
 * current language; prices come from the catalog in DA and are formatted through centimes
 * (PriceBlock), so the page and the cart can never disagree by a rounding.
 */
import { Star, Truck } from 'lucide-react-native';
import { View } from 'react-native';

import { discountPercent, type Product } from '@/core/catalog';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { PriceBlock } from '@/ui/PriceBlock';

const STAR_SIZE = 14;
const LINE_ICON = 18;

export function ProductBody({ product }: { product: Product }) {
  const styles = useStyles();
  const c = useColors();
  const { lang, t, tn } = useT();
  const ar = lang === 'ar';
  const discount = discountPercent(product);
  const rating = product.rating.toFixed(1);
  const reviews = tn('product.reviews', product.reviews);

  return (
    <View style={styles.root}>
      <Text variant="label" tone="muted" numberOfLines={1}>
        {ar ? product.brandAr : product.brand}
      </Text>
      <Text variant="title" accessibilityRole="header" style={styles.name}>
        {ar ? product.nameAr : product.name}
      </Text>

      <View style={styles.priceRow}>
        <PriceBlock price={product.price} oldPrice={product.oldPrice} size="hero" />
        {discount > 0 ? (
          <View style={styles.savePill}>
            <Text variant="caption" weight="semibold" tone="danger" numeric numberOfLines={1}>
              {t('product.save', { p: discount })}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" tone="muted">
        {t('product.vatNote')}
      </Text>

      <View style={styles.rating} accessible accessibilityLabel={`${t('a11y.rating', { r: rating })}, ${reviews}`}>
        <Star size={STAR_SIZE} color={c.accent} fill={c.accent} strokeWidth={size.iconStroke} />
        <Text variant="label" weight="semibold" numeric>
          {rating}
        </Text>
        <Text variant="label" tone="muted" style={styles.shrink}>
          {reviews}
        </Text>
      </View>

      <View style={styles.facts}>
        <Text variant="label" weight="semibold" tone={product.inStock ? 'success' : 'danger'}>
          {product.inStock ? t('product.inStock') : t('product.outOfStock')}
        </Text>
        <View style={styles.line}>
          <Truck size={LINE_ICON} color={c.textMuted} strokeWidth={size.iconStroke} />
          <Text variant="label" tone="muted" style={styles.shrink}>
            {t('product.delivery')}
          </Text>
        </View>
      </View>

      <Text variant="heading" accessibilityRole="header" style={styles.aboutTitle}>
        {t('product.about')}
      </Text>
      <Text variant="body" tone="muted">
        {ar ? product.descriptionAr : product.descriptionEn}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { paddingHorizontal: layout.gutter, paddingTop: space.md },
  name: { marginTop: space.xxs },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: space.xxs,
    marginTop: space.sm,
  },
  savePill: {
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: c.dangerSurface,
  },
  rating: { flexDirection: 'row', alignItems: 'center', columnGap: space.xxs, marginTop: space.md },
  shrink: { flexShrink: 1 },
  facts: {
    marginTop: space.md,
    paddingVertical: space.sm,
    rowGap: space.xs,
    borderTopWidth: size.hairline,
    borderBottomWidth: size.hairline,
    borderColor: c.lineHairline,
  },
  line: { flexDirection: 'row', alignItems: 'center', columnGap: space.xs },
  aboutTitle: { marginTop: space.lg, marginBottom: space.xs },
}));
