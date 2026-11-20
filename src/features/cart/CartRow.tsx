/**
 * One cart line (K-02, K-03): picture, brand and name, unit price, quantity stepper and line total,
 * with swipe-to-delete underneath.
 *
 * - The row subscribes to its own line only (`useCartLine(id)`). Changing another line, the totals
 *   or the badge never re-renders it (F-05).
 * - Three ways to delete, all undoable from the bar: swipe towards the start edge (or tap the red
 *   button it uncovers), the bin the stepper turns into at quantity 1, and the "Delete" action a
 *   screen reader offers on the line (TalkBack cannot swipe a row).
 * - The red layer sits under the content with its button at the END edge. `justifyContent:
 *   'flex-end'` follows the layout direction, so the button is on the right in English and on the
 *   left in Arabic, always where the content uncovers it.
 */
import { Trash2 } from 'lucide-react-native';
import { View, type AccessibilityActionEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue } from 'react-native-reanimated';

import { findProduct } from '@/core/catalog';
import { toHalalas } from '@/core/money';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { formatSar } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { cartActions, getCartState, useCartLine } from '@/state/cart.store';
import { testIds } from '@/testIds';
import { ProductImage } from '@/ui/ProductImage';
import { QuantityStepper } from '@/ui/QuantityStepper';

import { ACTION_WIDTH } from './swipeMath';
import { useSwipeToDelete } from './useSwipeToDelete';

/** Thumbnail size in dp; also the size requested from the image server (D-06, F-06). */
export const CART_IMAGE_SIZE = 72;

export function CartRow({ id, openRowId }: { id: string; openRowId: SharedValue<string> }) {
  const styles = useStyles();
  const c = useColors();
  const { lang, t } = useT();
  const line = useCartLine(id);
  const product = findProduct(id);
  const remove = () => cartActions.remove(id);
  const swipe = useSwipeToDelete({ onDelete: remove, rowId: id, openRowId, testID: testIds.cartRowSwipe(id) });
  // The stepper reads the quantity from the store at press time, not from this render: two taps that
  // land before React re-renders would otherwise both send the same "qty + 1" and one would be lost.
  const qtyNow = () => getCartState().byId[id]?.qty ?? 0;
  const increment = () => cartActions.setQty(id, qtyNow() + 1);
  const decrement = () => {
    const qty = qtyNow();
    // Never 1 → 0 here: removing always goes through `remove` (the bin), the one undoable path (ADR-015).
    if (qty > 1) cartActions.setQty(id, qty - 1);
  };

  if (line === undefined || product === undefined) return null;

  const name = lang === 'ar' ? product.nameAr : product.name;
  const brand = lang === 'ar' ? product.brandAr : product.brand;
  const unitH = toHalalas(product.price);
  const unit = formatSar(unitH, lang);
  const total = formatSar(unitH * line.qty, lang);
  const removeLabel = t('a11y.remove', { name });

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'delete') remove();
  };

  return (
    <GestureDetector gesture={swipe.pan}>
      <View testID={testIds.cartRow(id)} style={styles.row} onLayout={swipe.onLayout}>
        <Animated.View
          style={[styles.action, swipe.actionStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <PressableScale
            onPress={swipe.deleteFromButton}
            accessibilityLabel={removeLabel}
            testID={testIds.cartRowDelete(id)}
            shrinkOnPress={false}
            style={styles.actionButton}
          >
            <Animated.View style={swipe.iconStyle}>
              <Trash2 size={size.icon} color={c.bgSurface} />
            </Animated.View>
            <Text variant="caption" weight="semibold" style={styles.actionLabel} numberOfLines={1}>
              {t('cart.delete')}
            </Text>
          </PressableScale>
        </Animated.View>

        <Animated.View testID={testIds.cartRowContent(id)} style={[styles.content, swipe.contentStyle]}>
          <ProductImage
            productId={id}
            displaySize={CART_IMAGE_SIZE}
            placeholderColor={product.dominantColor}
            style={styles.image}
          />
          <View style={styles.body}>
            <View
              testID={testIds.cartRowInfo(id)}
              accessible
              accessibilityLabel={t('cart.lineLabel', { name, price: unit, total })}
              accessibilityActions={[{ name: 'delete', label: t('cart.delete') }]}
              onAccessibilityAction={onAccessibilityAction}
            >
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {brand}
              </Text>
              <Text variant="body" weight="medium" numberOfLines={2}>
                {name}
              </Text>
              <Text variant="caption" tone="muted" numeric numberOfLines={1}>
                {t('cart.unitPrice', { price: unit })}
              </Text>
            </View>
            <View style={styles.footer}>
              <QuantityStepper
                testID={testIds.cartRowQty(id)}
                value={line.qty}
                onIncrement={increment}
                onDecrement={decrement}
                onRemove={remove}
                removeLabel={removeLabel}
              />
              {/* Already read as part of the line label above. */}
              <Text
                testID={testIds.cartRowTotal(id)}
                variant="body"
                weight="semibold"
                numeric
                numberOfLines={1}
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.total}
              >
                {total}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((c) => ({
  row: { borderRadius: radius.tile, overflow: 'hidden' },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: c.danger,
  },
  actionButton: {
    width: ACTION_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: space.xxs,
  },
  // bgSurface on danger reads 5.6:1 in light and 6:1 in dark, where plain white on the lighter red would not.
  actionLabel: { color: c.bgSurface },
  content: {
    flexDirection: 'row',
    columnGap: space.sm,
    padding: space.sm,
    borderRadius: radius.tile,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    backgroundColor: c.bgSurface,
  },
  image: { width: CART_IMAGE_SIZE, height: CART_IMAGE_SIZE },
  body: { flex: 1, rowGap: space.xs },
  // Wraps at large font scales: the total drops under the stepper instead of being squeezed.
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.xs, rowGap: space.xs },
  // The auto margin takes the free space on the start side, so the total sits on the end edge on
  // either line, in both directions.
  total: { marginStart: 'auto' },
}));
