/**
 * One product in the Home "Best sellers" rail (H-04).
 *
 * - Memoised, and its only prop is the catalog's own product object, so it renders once. Nothing in
 *   it reads the cart: adding to the cart re-renders zero cards (F-05). The quick-add button keeps
 *   its feedback in a shared value for the same reason.
 * - The card body and the quick-add button are siblings, not nested buttons: a press on "+" can never
 *   also open the product, and TalkBack gets two clear stops ("name, price" and "Add name to cart").
 * - The picture is requested at the size it is drawn (D-06, F-06). The name always reserves two
 *   lines and the price room for a wrapped old price, scaled with the system font, so every card in
 *   the rail has the same height.
 * - `BestSellerCardSkeleton` is the loading stand-in: the same shell (width, border, corners), the
 *   same picture square and the same reserved text heights, so nothing moves when the products land.
 * - The picture is a hero source (P-01), like a Category tile: it sits in its own `Animated.View`
 *   that the product page measures and hides, so the image grows out of the card and flies back
 *   into it. The press goes through the one-page latch (openProduct.ts) with the card's hand-off,
 *   so a double tap opens one page. The hidden switch is a shared value: no card re-render.
 */
import { memo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Product } from '@/core/catalog';
import { toCentimes } from '@/core/money';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { MAX_FONT_SCALE, typeStyle } from '@/design/typography';
import { formatDzd } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useHeroSource } from '@/motion/hero/useHeroSource';
import { testIds } from '@/testIds';
import { PriceBlock } from '@/ui/PriceBlock';
import { ProductImage, productImageUri } from '@/ui/ProductImage';
import { RatingInline, ratingInlineHeight } from '@/ui/RatingInline';
import { Skeleton, SKELETON_MARK_RATIO } from '@/ui/Skeleton';

import { openProduct } from './homeRoutes';
import { QUICK_ADD_DISC, QuickAddButton } from './QuickAddButton';

/** DESIGN §5: best-seller cards are 156 dp wide. */
export const CARD_WIDTH = 156;
const PAD = space.xs;
/** The picture fills the card inside its padding and border. */
const CARD_IMAGE = CARD_WIDTH - 2 * (PAD + size.hairline);
/** The quick-add touch box overhangs the disc by this much on each side. */
const BUTTON_OVERHANG = (size.touch - QUICK_ADD_DISC) / 2;
/** Height of one grey text bar in the skeleton; it fits inside the smallest line (a 16 dp caption). */
const SKELETON_BAR = 12;

type CardMetrics = Readonly<{ name: number; rating: number; price: number }>;

/**
 * The heights the card reserves for its text, for the current language and system font (capped at
 * the app's 1.5x). Shared by the card and its skeleton, so the two are always the same size.
 */
function useCardMetrics(): CardMetrics {
  const { lang } = useT();
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(fontScale, MAX_FONT_SCALE);
  // Every type style sets a line height; `TextStyle` just types it as optional.
  const label = (typeStyle(lang, 'label').lineHeight ?? 0) * scale;
  const body = (typeStyle(lang, 'body').lineHeight ?? 0) * scale;
  const caption = (typeStyle(lang, 'caption').lineHeight ?? 0) * scale;
  return {
    name: 2 * label,
    rating: ratingInlineHeight(lang, scale),
    // The price is a body line; a discount adds the old price, which may wrap onto a caption line.
    price: Math.max(QUICK_ADD_DISC, body + caption),
  };
}

export type BestSellerCardProps = { product: Product };

function BestSellerCardView({ product }: BestSellerCardProps) {
  const styles = useStyles();
  const { lang, t } = useT();
  const metrics = useCardMetrics();
  const { ref: imageRef, hiddenStyle, prepare } = useHeroSource(product.id);
  const name = lang === 'ar' ? product.nameAr : product.name;
  const now = formatDzd(toCentimes(product.price), lang);
  const price =
    product.oldPrice !== null && product.oldPrice > product.price
      ? t('a11y.price', { price: now, old: formatDzd(toCentimes(product.oldPrice), lang) })
      : now;

  return (
    <View style={styles.card}>
      <PressableScale
        testID={testIds.homeBestSeller(product.id)}
        onPress={() => openProduct(product.id, () => prepare(productImageUri(product.id, 1, CARD_IMAGE)))}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${price}`}
        style={styles.body}
      >
        <View style={styles.content} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View ref={imageRef} style={[styles.imageBox, hiddenStyle]}>
            <ProductImage
              productId={product.id}
              displaySize={CARD_IMAGE}
              placeholderColor={product.dominantColor}
              style={styles.image}
            />
          </Animated.View>
          <Text variant="label" numberOfLines={2} style={{ minHeight: metrics.name }}>
            {name}
          </Text>
          <RatingInline rating={product.rating} reviews={product.reviews} style={{ minHeight: metrics.rating }} />
          <View style={[styles.price, { minHeight: metrics.price }]}>
            <PriceBlock price={product.price} oldPrice={product.oldPrice} size="tile" />
          </View>
        </View>
      </PressableScale>
      <View style={styles.quickAdd}>
        <QuickAddButton productId={product.id} name={name} />
      </View>
    </View>
  );
}

export const BestSellerCard = memo(BestSellerCardView);

/** The loading card: the real card's shell and heights, with grey blocks where the content goes. */
export function BestSellerCardSkeleton({ testID }: { testID?: string }) {
  const styles = useStyles();
  const metrics = useCardMetrics();
  return (
    <View style={styles.card} testID={testID}>
      <View style={[styles.body, styles.content]}>
        <Skeleton
          width={CARD_IMAGE}
          height={CARD_IMAGE}
          style={styles.imageBox}
          markSize={Math.round(CARD_IMAGE * SKELETON_MARK_RATIO)}
        />
        <View style={[styles.lines, { height: metrics.name }]}>
          <Skeleton width="90%" height={SKELETON_BAR} radius={radius.pill} />
          <Skeleton width="60%" height={SKELETON_BAR} radius={radius.pill} />
        </View>
        <View style={[styles.lines, { height: metrics.rating }]}>
          <Skeleton width="30%" height={SKELETON_BAR} radius={radius.pill} />
        </View>
        <View style={[styles.price, styles.lines, { height: metrics.price }]}>
          <Skeleton width="60%" height={SKELETON_BAR} radius={radius.pill} />
        </View>
      </View>
      <Skeleton width={QUICK_ADD_DISC} height={QUICK_ADD_DISC} radius={radius.pill} style={styles.discSkeleton} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.tile,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    backgroundColor: c.bgSurface,
    overflow: 'hidden',
  },
  body: { padding: PAD },
  content: { rowGap: space.xxs },
  imageBox: { width: CARD_IMAGE, height: CARD_IMAGE, marginBottom: space.xxs },
  image: { width: '100%', height: '100%' },
  rating: { flexDirection: 'row', alignItems: 'center', columnGap: space.xxs },
  // Room at the reading end for the quick-add disc, so a long price wraps instead of running under it.
  // Its height comes from `useCardMetrics`.
  price: { justifyContent: 'center', paddingEnd: QUICK_ADD_DISC + space.xxs },
  quickAdd: { position: 'absolute', bottom: PAD - BUTTON_OVERHANG, end: PAD - BUTTON_OVERHANG },
  // Skeleton only: text bars sit in the middle of the height the real text reserves.
  lines: { justifyContent: 'space-evenly' },
  // Where the real lime disc is drawn: the touch box's overhang taken back out.
  discSkeleton: { position: 'absolute', bottom: PAD, end: PAD },
}));
