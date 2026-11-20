/**
 * The product page's sticky bottom bar (P-03, K-03 stepper reused): pick a quantity, add it.
 *
 * - One press adds the stepper's quantity exactly once (1 unless changed), straight into the cart
 *   store, before any animation runs: the feedback never waits on anything (F-03).
 * - The motion is useAddToCartMotion's: label swap, the thumb's flight to the header cart icon,
 *   the icon catching it. The thumb is mounted all the time at opacity 0, so its image is decoded
 *   before the first press and the flight never starts blank.
 * - TalkBack hears one control, "Add <name> to cart", and is told "<name> added to cart" after.
 * - The cart holds at most MAX_QTY of one product. A press adds what still fits (97 in the cart +
 *   5 adds 2). With nothing left to fit, the button says "Max 99 per item" and a press gives the
 *   warning haptic and announces the limit instead: no "Added", no flight, no success. This bar
 *   subscribes to its own cart line for that label: one product's line, never the whole cart.
 * - The button names what the press costs, "Add · 93.98 SAR": unit price x the stepper's quantity, in
 *   integer halalas, formatted only here at display. Tabular digits, so the label does not jitter.
 * - Out of stock: no stepper, a disabled button that says so. It is dimmed once, by PressableScale's
 *   disabled opacity, on a neutral surface with full-strength text. The at-limit button stays
 *   pressable (no disabled opacity), so there the muted text is its one dim.
 */
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { type AnimatedRef, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Product } from '@/core/catalog';
import { toHalalas } from '@/core/money';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { useDirection } from '@/i18n/direction';
import { formatSar } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { cartActions, getCartState, useCartLine } from '@/state/cart.store';
import { MAX_QTY } from '@/state/cartMath';
import { testIds } from '@/testIds';
import { QuantityStepper } from '@/ui/QuantityStepper';

import { THUMB, useAddToCartMotion } from './useAddToCartMotion';

export type AddToCartBarProps = {
  product: Product;
  /** The URL the gallery shows first: already in memory, so the flying thumb is instant. */
  thumbUri: string;
  cartIconRef: AnimatedRef<View>;
  cartCatch: SharedValue<number>;
};

export function AddToCartBar({ product, thumbUri, cartIconRef, cartCatch }: AddToCartBarProps) {
  const styles = useStyles();
  const c = useColors();
  const { lang, t } = useT();
  const { isRTL } = useDirection();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const [qty, setQty] = useState(1);
  // Destructured: the refs only go to their views, they are never read during render.
  const { barRef, buttonRef, thumbStyle, idleLabelStyle, addedLabelStyle, play } = useAddToCartMotion({
    cartIconRef,
    cartCatch,
    reduceMotion,
    isRTL,
  });
  const name = lang === 'ar' ? product.nameAr : product.name;
  const inStock = product.inStock;
  const inCart = useCartLine(product.id)?.qty ?? 0;
  const atLimit = inCart >= MAX_QTY;
  // The label prices what a press really adds: with 97 in the cart and 5 picked, that is 2.
  const willAdd = Math.max(0, Math.min(qty, MAX_QTY - inCart));
  const limitText = t('product.limitReached', { max: MAX_QTY });

  const add = () => {
    if (!inStock) return;
    // Read at press time, not from the render: two presses in one frame must both see the truth.
    const room = MAX_QTY - (getCartState().byId[product.id]?.qty ?? 0);
    if (room <= 0) {
      haptics.warn();
      AccessibilityInfo.announceForAccessibility(limitText);
      return;
    }
    cartActions.add(product.id, Math.min(qty, room));
    haptics.confirm();
    AccessibilityInfo.announceForAccessibility(t('a11y.addedToCart', { name }));
    play();
  };

  const lineTotal = formatSar(toHalalas(product.price) * willAdd, lang);
  const idleText = !inStock
    ? t('product.outOfStock')
    : atLimit
      ? limitText
      : t('product.addWithPrice', { price: lineTotal });
  const idleTone = !inStock ? 'primary' : atLimit ? 'muted' : 'onAccent';

  return (
    <Animated.View ref={barRef} style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
      {inStock ? (
        <QuantityStepper
          value={qty}
          onIncrement={() => setQty((n) => n + 1)}
          onDecrement={() => setQty((n) => Math.max(1, n - 1))}
          testID={testIds.productQuantity}
        />
      ) : null}
      <Animated.View ref={buttonRef} style={styles.buttonBox}>
        <PressableScale
          onPress={add}
          disabled={!inStock}
          accessibilityLabel={inStock ? t('a11y.addToCart', { name }) : t('product.outOfStock')}
          accessibilityHint={inStock && atLimit ? limitText : undefined}
          testID={testIds.addToCart}
          style={[styles.button, (!inStock || atLimit) && styles.buttonDisabled]}
        >
          <Animated.View style={[styles.label, idleLabelStyle]}>
            {/* Two lines at most: at the largest font scale a long total wraps instead of clipping. */}
            <Text
              variant="body"
              weight="semibold"
              tone={idleTone}
              numeric
              align="center"
              numberOfLines={2}
              style={styles.labelText}
            >
              {idleText}
            </Text>
          </Animated.View>
          <Animated.View style={[styles.label, styles.labelOver, addedLabelStyle]}>
            <Check size={size.iconSmall} color={c.onAccent} />
            <Text variant="body" weight="semibold" tone="onAccent" numberOfLines={1}>
              {t('product.added')}
            </Text>
          </Animated.View>
        </PressableScale>
      </Animated.View>
      <Animated.View style={[styles.thumb, thumbStyle]}>
        <Image source={{ uri: thumbUri }} cachePolicy="memory-disk" contentFit="cover" style={styles.thumbImage} />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.sm,
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    backgroundColor: c.bgSurface,
    borderTopWidth: size.hairline,
    borderTopColor: c.lineHairline,
  },
  buttonBox: { flex: 1 },
  button: {
    minHeight: size.touch + space.xxs,
    borderRadius: radius.button,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  // Out of stock and at the limit: a neutral surface, never a faded lime one (lime means "you can buy").
  buttonDisabled: { backgroundColor: c.bgSunken },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: space.xxs },
  // In a row a Text does not shrink by default; without this a long total would overflow the button.
  labelText: { flexShrink: 1 },
  // The "Added" layer sits exactly on top of the idle label; only one is visible at a time.
  labelOver: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  // Not a touch target: it only flies. `start: 0` is mirrored in Arabic; flyPath accounts for it.
  thumb: {
    position: 'absolute',
    top: 0,
    start: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.image,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  thumbImage: { width: '100%', height: '100%' },
}));
