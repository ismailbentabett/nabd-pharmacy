/**
 * The product page's floating header: Back at the start, the cart at the end (P-03, G-08).
 *
 * - Floats over the gallery photo, so each button is a solid surface disc with a hairline ring
 *   (no blur, no shadow) and the screen's own colours, legible over any picture.
 * - Back points to the start edge: a left chevron in English, a right one in Arabic. It runs the
 *   same close as every other way back (the hero flies home), via `onBack`.
 * - The cart icon is the landing spot of the add-to-cart flight: its box is `cartIconRef` (measured
 *   on the UI thread) and `cartCatch` is its scale, so the icon swells when the thumb lands.
 *   CartBadge bumps by itself when the count goes up.
 * - Tapping the cart leaves the product page straight for the Cart tab.
 */
import { router } from "expo-router";
import { ChevronLeft, ShoppingBag } from "lucide-react-native";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/design/PressableScale";
import { makeStyles, useColors } from "@/design/theme";
import { layout, radius, size, space } from "@/design/tokens";
import { useT } from "@/i18n/useT";
import { useCartCount } from "@/state/cart.store";
import { testIds } from "@/testIds";
import { CartBadge } from "@/ui/CartBadge";
import { DirectionalIcon } from "@/ui/DirectionalIcon";
import { HeartButton } from "@/ui/HeartButton";

/** The visible disc; the touch target around it stays 48 dp (PressableScale). */
const DISC = 40;

export type ProductHeaderProps = {
  onBack: () => void;
  cartIconRef: AnimatedRef<View>;
  cartCatch: SharedValue<number>;
  /** The product on screen, for the favourite heart (same store as the grid tile's heart). */
  productId: string;
  productName: string;
};

function openCart() {
  // Leave the product page first, then switch tabs, so Back from the cart does not reopen it.
  if (router.canGoBack()) {
    router.back();
    router.navigate("/cart");
  } else {
    router.replace("/cart");
  }
}

export function ProductHeader({
  onBack,
  cartIconRef,
  cartCatch,
  productId,
  productName,
}: ProductHeaderProps) {
  const styles = useStyles();
  const c = useColors();
  const { t, tn } = useT();
  const insets = useSafeAreaInsets();
  const count = useCartCount();

  const catchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cartCatch.get() }],
  }));

  return (
    <View style={[styles.row, { paddingTop: insets.top + space.xs }]}>
      <PressableScale
        onPress={onBack}
        accessibilityLabel={t("product.back")}
        testID={testIds.productBack}
        style={styles.button}
      >
        <View style={styles.disc}>
          <DirectionalIcon
            icon={ChevronLeft}
            size={size.icon}
            color={c.textPrimary}
          />
        </View>
      </PressableScale>
      <View style={styles.end}>
        <HeartButton
          productId={productId}
          name={productName}
          discSize={DISC}
          testID={testIds.productFavorite}
        />
        <PressableScale
          onPress={openCart}
          accessibilityLabel={t("product.openCart")}
          accessibilityHint={tn("a11y.cartBadge", count)}
          testID={testIds.productCart}
          style={styles.button}
        >
          <Animated.View ref={cartIconRef} style={[styles.disc, catchStyle]}>
            <ShoppingBag
              size={size.icon - 2}
              color={c.textPrimary}
              strokeWidth={size.iconStroke}
            />
            <CartBadge count={count} testID={testIds.productCartBadge} />
          </Animated.View>
        </PressableScale>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // box-none: the strip between the two buttons lets touches through to the gallery underneath.
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter - space.xxs,
    pointerEvents: "box-none",
  },
  button: { alignItems: "center", justifyContent: "center" },
  end: { flexDirection: "row", columnGap: space.xxs },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    alignItems: "center",
    justifyContent: "center",
  },
}));
