/**
 * The product page (P-01, P-02, P-03). The route is a transparent modal with no native animation:
 * this screen draws its own background and owns all of its motion.
 *
 * Layers, bottom to top:
 *   backdrop   the page colour; fades in over the grid as the hero leaves its tile
 *   scroll     the gallery (= the hero: moved/scaled by heroStyle) and the body (contentStyle)
 *   header     Back + cart, fades in last (chromeStyle)
 *   bar        quantity + Add to cart, fades in last; its flying thumb draws above everything
 *
 * Gestures: the back swipe wraps the body below the gallery, the pull-down wraps the gallery.
 * Both, the header Back and Android's Back key drive the same transition (useHeroTransition).
 * When the close lands, `leave` pops the route.
 *
 * The header and the bar are inert (no touches, hidden from TalkBack) until the open has landed,
 * and again from the moment a close starts: a tap on a half-faded "Add to cart" must never add,
 * and a second Back must never pop a second route. `interactive` is the one piece of React state
 * that changes while the page is open, set by two discrete events (open landed, close started),
 * never per frame. The React Compiler memoises the children, so it re-renders only these wrappers.
 *
 * Apart from that, this component subscribes to nothing that changes while the page is open: the
 * cart count lives in the header, the quantity in the bar, the page index in the pager hook.
 */
import { router } from "expo-router";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedRef,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Product } from "@/core/catalog";
import { makeStyles } from "@/design/theme";
import { size, space } from "@/design/tokens";
import { useMotionPreference } from "@/motion/motionPreference";
import { useHeroBackGestures } from "@/motion/hero/useHeroBackGestures";
import { useHeroTransition } from "@/motion/hero/useHeroTransition";
import { useT } from "@/i18n/useT";
import { testIds } from "@/testIds";
import { productImageUri } from "@/ui/ProductImage";

import { AddToCartBar } from "./AddToCartBar";
import { Gallery, GalleryDots } from "./Gallery";
import { ProductBody } from "./ProductBody";
import { ProductHeader } from "./ProductHeader";
import { useGalleryPager } from "./useGalleryPager";

/** Room under the body for the sticky bar: its button plus its top and bottom padding. */
const BAR_SPACE = size.touch + space.xxs + 2 * space.sm + space.xl;

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function ProductScreen({ product }: { product: Product }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const { lang } = useT();
  const pager = useGalleryPager(product.images.length, width);
  const cartIconRef = useAnimatedRef<View>();
  const cartCatch = useSharedValue(1);
  const [interactive, setInteractive] = useState(false);

  const hero = useHeroTransition({
    productId: product.id,
    width,
    reduceMotion,
    resetGallery: pager.resetToFirst,
    onInteractiveChange: setInteractive,
    onClosed: leave,
  });
  const { swipePan, pullPan } = useHeroBackGestures(hero.controls, width);

  // Inert chrome: no touches, and TalkBack skips it, until the open lands and once a close starts.
  const chromeA11y = {
    accessibilityElementsHidden: !interactive,
    importantForAccessibility: interactive
      ? ("auto" as const)
      : ("no-hide-descendants" as const),
  };

  return (
    <View testID={testIds.screen.product} style={styles.root}>
      <Animated.View style={[styles.backdrop, hero.backdropStyle]} />
      <Animated.ScrollView
        onScroll={hero.onScroll}
        scrollEventThrottle={16}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BAR_SPACE + insets.bottom }}
      >
        <GestureDetector gesture={pullPan}>
          <Animated.View
            style={[styles.hero, { width, height: width }, hero.heroStyle]}
          >
            <Gallery
              product={product}
              pager={pager}
              heroUri={hero.heroUri}
              onImageReady={hero.markImageReady}
            />
          </Animated.View>
        </GestureDetector>
        <GestureDetector gesture={swipePan}>
          <Animated.View style={hero.contentStyle}>
            <GalleryDots
              count={pager.count}
              offset={pager.offset}
              width={width}
            />
            <ProductBody product={product} />
          </Animated.View>
        </GestureDetector>
      </Animated.ScrollView>
      <Animated.View
        style={[styles.header, !interactive && styles.inert, hero.chromeStyle]}
        {...chromeA11y}
      >
        <ProductHeader
          onBack={hero.requestClose}
          cartIconRef={cartIconRef}
          cartCatch={cartCatch}
          productId={product.id}
          productName={lang === "ar" ? product.nameAr : product.name}
        />
      </Animated.View>
      <Animated.View
        style={[styles.bar, !interactive && styles.inert, hero.chromeStyle]}
        {...chromeA11y}
      >
        <AddToCartBar
          product={product}
          thumbUri={productImageUri(product.id, 1, width)}
          cartIconRef={cartIconRef}
          cartCatch={cartCatch}
        />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    backgroundColor: c.bgApp,
  },
  // Above the body, so the image is never drawn under the text while it flies. Clips the gallery
  // to the hero's animated corner radius (heroStyles.ts).
  hero: { zIndex: 1, overflow: "hidden" },
  header: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    pointerEvents: "box-none",
  },
  bar: { position: "absolute", bottom: 0, start: 0, end: 0 },
  // Overrides `box-none` on the header: nothing inside takes a touch while the page is moving.
  inert: { pointerEvents: "none" },
}));
