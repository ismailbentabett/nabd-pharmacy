/**
 * One promotion of the banner carousel: a pine card with the copy at the reading start and a square
 * picture at the reading end. The whole card is one control that opens the promoted category.
 *
 * The card keeps a 16:7 shape as a minimum height, not a fixed one, so a large system font grows the
 * card instead of clipping the Arabic copy. The picture is requested at the size it is drawn (D-06).
 */
import { Image } from 'expo-image';
import { PixelRatio, View } from 'react-native';

import { imageUri, type Banner } from '@/core/catalog';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { layout, radius, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { testIds } from '@/testIds';
import { IMAGE_FADE_MS } from '@/ui/ProductImage';

import { openCategory } from './homeRoutes';

/** DESIGN §5: banners are 16:7. */
const BANNER_ASPECT = 7 / 16;
/** Side of the square picture, in dp. */
const BANNER_ART = 104;
const CTA_HEIGHT = 32;

const TRANSITION = { duration: IMAGE_FADE_MS, effect: 'cross-dissolve', skipOnCacheHit: 'all' } as const;

const bannerPageTestId = (index: number) => `${testIds.homeBanner}-page-${index}`;

export type BannerCardProps = {
  banner: Banner;
  index: number;
  /** Width of one page: the window width. The card sits inside it with the screen gutter. */
  pageWidth: number;
};

export function BannerCard({ banner, index, pageWidth }: BannerCardProps) {
  const styles = useStyles();
  const { lang } = useT();
  const copy = banner[lang];
  const cardWidth = pageWidth - 2 * layout.gutter;
  const uri = imageUri(`banner-${banner.id}`, 1, BANNER_ART, PixelRatio.get());

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <PressableScale
        testID={bannerPageTestId(index)}
        onPress={() => openCategory(banner.category)}
        accessibilityRole="link"
        accessibilityLabel={`${copy.title}. ${copy.cta}`}
        style={[styles.card, { minHeight: Math.round(cardWidth * BANNER_ASPECT) }]}
      >
        <View style={styles.copy}>
          <Text variant="heading" tone="onBrand" numberOfLines={2}>
            {copy.title}
          </Text>
          <Text variant="label" tone="onBrandMuted" numberOfLines={2} style={styles.sub}>
            {copy.sub}
          </Text>
          <View style={styles.cta}>
            <Text variant="label" weight="semibold" tone="onAccent" numberOfLines={1}>
              {copy.cta}
            </Text>
          </View>
        </View>
        <Image
          source={{ uri }}
          recyclingKey={uri}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={TRANSITION}
          accessible={false}
          style={styles.art}
        />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  page: { paddingHorizontal: layout.gutter },
  card: {
    flex: 1,
    flexDirection: 'row',
    columnGap: space.sm,
    padding: space.md,
    borderRadius: radius.banner,
    backgroundColor: c.bgBrand,
  },
  copy: { flex: 1, rowGap: space.xxs },
  sub: { flexGrow: 1 },
  cta: {
    alignSelf: 'flex-start',
    minHeight: CTA_HEIGHT,
    justifyContent: 'center',
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
  art: { width: BANNER_ART, height: BANNER_ART, borderRadius: radius.image, backgroundColor: c.imagePlaceholder },
}));
