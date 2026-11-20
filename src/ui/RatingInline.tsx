/**
 * A product's rating on one line: a small lime star, the score and the review count. The grid tile,
 * the best-seller card and the product page all use it, so a rating looks and reads the same everywhere.
 *
 * - One accessible element: TalkBack hears one sentence ("Rated 4.5 out of 5, 1,234 reviews"), not
 *   a star, a number and a bracketed number as three stops. The parts inside are not focusable.
 * - The score is semibold with tabular digits; the count is muted, a step quieter. On screen the
 *   count is the short "(1,234)" so the row fits half a phone width at 1.5x text; the spoken label
 *   says "reviews" in full.
 * - The star is decoration beside the number that carries the meaning, so lime on white is fine
 *   here: it is never the only signal. Its stroke comes from the app's LucideProvider.
 * - RTL (G-08): a plain row, so star, score and count follow the reading direction on their own.
 */
import { Star } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { typeStyle } from '@/design/typography';
import { formatCount, type Lang } from '@/i18n/format';
import { useT } from '@/i18n/useT';

export type RatingInlineProps = {
  /** 0 to 5, shown with one decimal. */
  rating: number;
  reviews: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The row's height at a font scale the caller has already capped (MAX_FONT_SCALE): one caption line,
 * or the star if that is taller. Skeletons use it to reserve exactly the room the real row takes.
 */
export function ratingInlineHeight(lang: Lang, fontScale: number): number {
  // Every type style sets a line height; `TextStyle` just types it as optional.
  return Math.max(size.iconTiny, (typeStyle(lang, 'caption').lineHeight ?? 0) * fontScale);
}

export function RatingInline({ rating, reviews, style }: RatingInlineProps) {
  const styles = useStyles();
  const c = useColors();
  const { t, tn } = useT();
  const score = rating.toFixed(1);
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={`${t('a11y.rating', { r: score })}, ${tn('product.reviews', reviews)}`}
    >
      <Star size={size.iconTiny} color={c.accent} fill={c.accent} />
      <Text variant="caption" weight="semibold" numeric>
        {score}
      </Text>
      <Text variant="caption" tone="muted" numeric numberOfLines={1} style={styles.count}>
        {`(${formatCount(reviews)})`}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', columnGap: space.xxs },
  count: { flexShrink: 1 },
}));
