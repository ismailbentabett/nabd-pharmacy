/**
 * One product in the Category grid (C-01, C-02, F-05, F-06).
 *
 * Why it looks the way it does:
 * - Memoised, and its props are a product object from the catalog (never copied), a number, a width
 *   and one stable handler. Nothing here reads the cart, so a cart change re-renders zero tiles (F-05).
 * - The whole tile is one button. TalkBack hears one sentence ("name, price"); the parts inside are
 *   hidden from it so the price is not read a second time as its own stop.
 * - A hairline border on the surface colour instead of a shadow: Android elevation on 20 visible
 *   tiles costs extra render passes on a mid-range GPU (DESIGN §3).
 * - The tree has the same shape for every product except the discount tag, which is why the grid
 *   tells FlashList two item types ("sale" and "regular"): a recycled cell only ever gets a product
 *   with the same shape, so it updates its views instead of rebuilding them.
 * - The picture sits in its own `Animated.View`. The shared-element transition (P-01) measures and
 *   hides that view, so the hero can grow out of exactly this box. On press the tile leaves its
 *   hand-off (`prepare`, the same URL it is showing) and only then calls `onPress`, which pushes
 *   the product route in the same tick (useHeroSource.ts). The hidden switch is a shared value, so
 *   hiding and showing the picture never re-renders the tile.
 * - A press while a product page is already opening or open does nothing (openProduct.ts): a
 *   double tap must not write a second hand-off or push a second page.
 */
import { memo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { discountPercent, type Product } from '@/core/catalog';
import { toHalalas } from '@/core/money';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { MAX_FONT_SCALE, typeStyle, type Variant } from '@/design/typography';
import { formatSar } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { isProductOpening } from '@/motion/hero/openProduct';
import { useHeroSource } from '@/motion/hero/useHeroSource';
import { testIds } from '@/testIds';
import { DiscountTag } from '@/ui/DiscountTag';
import { PriceBlock } from '@/ui/PriceBlock';
import { ProductImage, productImageUri } from '@/ui/ProductImage';
import { RatingInline, ratingInlineHeight } from '@/ui/RatingInline';
import { Skeleton, SKELETON_MARK_RATIO } from '@/ui/Skeleton';

/** Space between the tile's border and its content. */
const TILE_PADDING = space.xs;
/** Height of one grey text bar in the skeleton; it fits inside the smallest line (a 16 dp caption). */
const SKELETON_BAR = 12;

/** The width (and height) the picture is drawn at in a tile `tileWidth` wide. Also the size downloaded. */
export function tileImageSize(tileWidth: number): number {
  return tileWidth - 2 * (TILE_PADDING + size.hairline);
}

type TileMetrics = Readonly<{ brand: number; name: number; rating: number; price: number }>;

/**
 * The heights the tile's text takes for the current language and system font (capped at the app's
 * 1.5x). The tile reserves two name lines with it, so a one-line name does not make a shorter tile,
 * and the skeleton draws the same heights, so nothing moves when the page lands.
 */
function useTileMetrics(): TileMetrics {
  const { lang } = useT();
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(fontScale, MAX_FONT_SCALE);
  // Every type style sets a line height; `TextStyle` just types it as optional.
  const line = (variant: Variant) => (typeStyle(lang, variant).lineHeight ?? 0) * scale;
  return { brand: line('caption'), name: 2 * line('label'), rating: ratingInlineHeight(lang, scale), price: line('body') };
}

export type ProductTileProps = {
  product: Product;
  index: number;
  /** The tile's outer width in dp, worked out once by the grid from the window width. */
  width: number;
  onPress: (product: Product, index: number) => void;
};

function ProductTileView({ product, index, width, onPress }: ProductTileProps) {
  const styles = useStyles();
  const metrics = useTileMetrics();
  const { lang, t } = useT();
  const ar = lang === 'ar';
  const name = ar ? product.nameAr : product.name;
  const discount = discountPercent(product);
  const imageSize = tileImageSize(width);
  // Destructured: the ref is only handed to the view, never read during render (react-hooks/refs).
  const { ref: imageRef, hiddenStyle, prepare } = useHeroSource(product.id);

  const now = formatSar(toHalalas(product.price), lang);
  const price =
    discount > 0 && product.oldPrice !== null
      ? t('a11y.price', { price: now, old: formatSar(toHalalas(product.oldPrice), lang) })
      : now;

  const handlePress = () => {
    if (isProductOpening()) return;
    prepare(productImageUri(product.id, 1, imageSize));
    onPress(product, index);
  };

  return (
    <PressableScale
      onPress={handlePress}
      accessibilityLabel={`${name}, ${price}`}
      testID={testIds.productTile(index)}
      style={styles.tile}
    >
      <View style={styles.body} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View ref={imageRef} style={[styles.imageBox, hiddenStyle]}>
          <ProductImage
            productId={product.id}
            displaySize={imageSize}
            placeholderColor={product.dominantColor}
            style={styles.image}
          />
          {discount > 0 ? <DiscountTag percent={discount} style={styles.discount} /> : null}
        </Animated.View>
        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.brand}>
          {ar ? product.brandAr : product.brand}
        </Text>
        <Text variant="label" numberOfLines={2} style={{ minHeight: metrics.name }}>
          {name}
        </Text>
        <View style={styles.footer}>
          <RatingInline rating={product.rating} reviews={product.reviews} />
          <PriceBlock price={product.price} oldPrice={product.oldPrice} size="tile" />
        </View>
      </View>
    </PressableScale>
  );
}

export const ProductTile = memo(ProductTileView);

/**
 * The tile's placeholder while a page loads: the same box, and each text part's real height (from
 * useTileMetrics) with a grey bar in its middle, so nothing jumps when the products land.
 */
export function ProductTileSkeleton({ width }: { width: number }) {
  const styles = useStyles();
  const metrics = useTileMetrics();
  const image = tileImageSize(width);
  return (
    <View style={[styles.tile, styles.skeletonTile, { width }]}>
      <Skeleton width={image} height={image} markSize={Math.round(image * SKELETON_MARK_RATIO)} />
      <View style={[styles.brand, styles.lines, { height: metrics.brand }]}>
        <Skeleton width="45%" height={SKELETON_BAR} radius={radius.pill} />
      </View>
      <View style={[styles.lines, { height: metrics.name }]}>
        <Skeleton width="90%" height={SKELETON_BAR} radius={radius.pill} />
        <Skeleton width="60%" height={SKELETON_BAR} radius={radius.pill} />
      </View>
      <View style={styles.footer}>
        <View style={[styles.lines, { height: metrics.rating }]}>
          <Skeleton width="35%" height={SKELETON_BAR} radius={radius.pill} />
        </View>
        <View style={[styles.lines, { height: metrics.price }]}>
          <Skeleton width="55%" height={SKELETON_BAR} radius={radius.pill} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  tile: {
    // flexGrow: FlashList gives every cell in a row the height of the tallest one; the tile fills it.
    flexGrow: 1,
    marginHorizontal: layout.gridGap / 2,
    marginBottom: layout.gridGap,
    padding: TILE_PADDING,
    borderRadius: radius.tile,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    backgroundColor: c.bgSurface,
  },
  body: { flexGrow: 1 },
  imageBox: { width: '100%', aspectRatio: 1 },
  image: { width: '100%', height: '100%' },
  discount: { position: 'absolute', top: space.xs, start: space.xs },
  brand: { marginTop: space.xs },
  // marginTop auto pins rating and price to the bottom, so prices line up across a row.
  footer: { marginTop: 'auto', paddingTop: space.xxs, rowGap: space.hair },
  skeletonTile: { flexGrow: 0 },
  // Skeleton only: text bars sit in the middle of the height the real text takes.
  lines: { justifyContent: 'space-evenly' },
}));
