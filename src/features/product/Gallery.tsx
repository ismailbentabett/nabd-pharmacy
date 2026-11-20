/**
 * The product images: a full-width square pager with a page indicator (P-02, G-08).
 *
 * How it works:
 * - The pages sit side by side in one row; a single shared value, `offset`, slides the row
 *   (translateX only). The pager state (offset, page index) lives in `useGalleryPager`, owned by
 *   the product screen, so the hero can put the pager back on image 1 while flying home.
 * - The swipe follows the finger 1:1, rubber-bands past the first and last image, and on release
 *   projects its velocity forward to pick the page (never more than one page per flick), then
 *   springs there with the finger's speed. A touch stops a running spring where it is.
 * - Arabic: the row mirrors natively (page 1 at the right) and `pageOffset` multiplies by `dir`,
 *   so a swipe towards the reading end shows the next image in both languages.
 * - Every horizontal swipe here is a page turn. The back swipe lives on the body below
 *   (useHeroBackGestures.ts), so the two never compete for the same touch.
 * - Page 1 shows the tile's own cached image underneath the full-size one, so the hero has a
 *   picture in its first frame; `onImageReady` tells it when that picture is drawn.
 * - TalkBack: one "adjustable" element, "Product images, Image 1 of 3"; swipe up/down turns pages.
 */
import { Image } from 'expo-image';
import { View, type AccessibilityActionEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { Product } from '@/core/catalog';
import { makeStyles } from '@/design/theme';
import { space } from '@/design/tokens';
import { useDirection } from '@/i18n/direction';
import { useT } from '@/i18n/useT';
import { clamp, pageIndexFromOffset, pageOffset, projectEnd, rubberBand } from '@/motion/gestureMath';
import { testIds } from '@/testIds';
import { PageDots } from '@/ui/PageDots';
import { ProductImage } from '@/ui/ProductImage';

import type { GalleryPager } from './useGalleryPager';

/** Horizontal travel before the pager takes the touch; vertical first lets the page scroll. */
const ACTIVATE_PX = 10;
const ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

export type GalleryProps = {
  product: Product;
  /** The pager state from `useGalleryPager(product.images.length, width)`. */
  pager: GalleryPager;
  /** The URL the grid tile was showing, or null when the page did not open from a tile. */
  heroUri: string | null;
  onImageReady: () => void;
};

export function Gallery({ product, pager, heroUri, onImageReady }: GalleryProps) {
  const styles = useStyles();
  const { t } = useT();
  const { dir } = useDirection();
  const { count, width, page, offset, current, settleOn, goTo } = pager;
  const dragStart = useSharedValue(0);
  const activationX = useSharedValue(0);
  const dragging = useSharedValue(false);

  const last = pageOffset(count - 1, width, dir);
  const minOffset = Math.min(0, last);
  const maxOffset = Math.max(0, last);

  const pan = usePanGesture({
    enabled: count > 1,
    activeOffsetX: [-ACTIVATE_PX, ACTIVATE_PX],
    failOffsetY: [-ACTIVATE_PX, ACTIVATE_PX],
    onBegin: () => {
      cancelAnimation(offset);
      dragStart.set(offset.get());
    },
    onActivate: (e) => {
      dragging.set(true);
      activationX.set(e.translationX);
    },
    onUpdate: (e) => {
      offset.set(rubberBand(dragStart.get() + e.translationX - activationX.get(), minOffset, maxOffset));
    },
    onDeactivate: (e) => {
      const from = current.get();
      const landing = pageIndexFromOffset(projectEnd(offset.get(), e.velocityX), width, dir);
      const target = clamp(Math.round(landing), Math.max(0, from - 1), Math.min(count - 1, from + 1));
      settleOn(target, e.velocityX);
    },
    onFinalize: () => {
      // A touch that stopped a spring but never became a swipe finishes on the nearest page.
      if (!dragging.get()) {
        settleOn(clamp(Math.round(pageIndexFromOffset(offset.get(), width, dir)), 0, count - 1), 0);
      }
      dragging.set(false);
    },
  });

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') goTo(page + 1);
    if (event.nativeEvent.actionName === 'decrement') goTo(page - 1);
  };

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const square = { width, height: width };

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testIds.productGallery}
        style={[styles.frame, square]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('a11y.gallery')}
        accessibilityValue={{ text: t('a11y.page', { i: page + 1, n: count }) }}
        accessibilityActions={ACTIONS}
        onAccessibilityAction={onAccessibilityAction}
      >
        <Animated.View style={[styles.row, { width: width * count }, rowStyle]}>
          {product.images.map((_, i) => (
            <View key={`${product.id}-${i}`} style={[square, { backgroundColor: product.dominantColor }]}>
              {i === 0 && heroUri !== null ? (
                <Image
                  source={{ uri: heroUri }}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  onDisplay={onImageReady}
                  style={styles.fill}
                />
              ) : null}
              <ProductImage
                productId={product.id}
                n={i + 1}
                displaySize={width}
                // Transparent on page 1 while the tile image underneath is the placeholder.
                placeholderColor={i === 0 && heroUri !== null ? 'transparent' : product.dominantColor}
                radius={0}
                priority={i === 0 ? 'high' : 'normal'}
                style={styles.fill}
              />
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** The page dots, under the gallery: they follow the swipe frame by frame, from the same offset. */
export function GalleryDots({ count, offset, width }: { count: number; offset: SharedValue<number>; width: number }) {
  const styles = useStyles();
  const { dir } = useDirection();
  const progress = useDerivedValue(() => pageIndexFromOffset(offset.get(), width, dir));
  return (
    <View style={styles.dots}>
      <PageDots count={count} progress={progress} testID={testIds.productDots} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  frame: { overflow: 'hidden' },
  row: { flexDirection: 'row' },
  fill: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  dots: { alignItems: 'center', paddingTop: space.sm },
}));
