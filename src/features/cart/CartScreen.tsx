/**
 * The Cart tab (K-01 to K-04): a header with the item count, the lines, the totals card and the undo
 * bar for the last deletion. An empty cart shows a way back to the products instead.
 *
 * Who re-renders on what (F-05):
 * - This screen reads the line ids and the last deletion: it re-renders when a line is added,
 *   removed or restored, never on a quantity change.
 * - The header reads the unit count, each row its own line, the totals card the total.
 *   So "+" on one row re-renders that row, the header and the totals, nothing else.
 *
 * Layout: the tab bar sits below the screen (not over it), so the totals card ends just above it.
 * The undo bar floats over the bottom of the list, right above the totals (or above the tab bar
 * when the cart is empty), and the list keeps room under its last row so nothing stays hidden.
 *
 * Motion (K-01): deleting the last line fades the list and the totals card out, then the empty state
 * rises in once they are gone (enterAfterExit), so the two never overlap. Undo brings the totals card
 * back with the same entrance as the rows. The undo bar names the product it removed.
 *
 * After "Place order" succeeds the cart empties, so the confirmation (`CheckoutSuccess`) sits on top
 * of the empty state until it is dismissed or something new is added.
 */
import { useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findProduct } from '@/core/catalog';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { layout, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { cartActions, useCartCount, useCartIds, useLastRemoved } from '@/state/cart.store';
import { setLastPlacedOrder } from '@/state/orders';
import { testIds } from '@/testIds';
import { EmptyState } from '@/ui/EmptyState';
import { UndoBar } from '@/ui/UndoBar';
import { onFirstScreenLayout } from '@/ui/LaunchVeil';

import { CartList } from './CartList';
import { enterAfterExit, enterNow, exitCollapse, reducedEnter, reducedEnterAfterExit, reducedExit } from './cartMotion';
import { CartSummary } from './CartSummary';
import { CheckoutSuccess } from './CheckoutSuccess';

function CartHeader() {
  const styles = useStyles();
  const { t, tn } = useT();
  const count = useCartCount();
  // Same block as the Category header: title, then the count as a muted caption under it, in a box as
  // tall as Category's Filter button, so the title does not jump when switching tabs. The caption line
  // is kept (blank, hidden from TalkBack) when the cart is empty, so the header never changes height.
  return (
    <View style={styles.header}>
      <Text variant="title" weight="semibold" numberOfLines={1} accessibilityRole="header">
        {t('cart.title')}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        numeric
        numberOfLines={1}
        accessibilityElementsHidden={count === 0}
        importantForAccessibility={count > 0 ? 'auto' : 'no'}
      >
        {count > 0 ? tn('cart.items', count) : ' '}
      </Text>
    </View>
  );
}

export function CartScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, t } = useT();
  const reduceMotion = useMotionPreference();
  const ids = useCartIds();
  const lastRemoved = useLastRemoved();
  const removed = lastRemoved ? findProduct(lastRemoved.line.id) : undefined;
  const removedMessage = removed
    ? t('cart.removedItem', { name: lang === 'ar' ? removed.nameAr : removed.name })
    : t('cart.removed');
  const exiting = reduceMotion ? reducedExit : exitCollapse;
  const hasLines = ids.length > 0;

  // An order confirmation belongs to the cart it emptied: once something new is added, it is stale.
  useEffect(() => {
    if (hasLines) setLastPlacedOrder(null);
  }, [hasLines]);

  const undo = () => {
    haptics.tap();
    cartActions.undo();
  };

  return (
    <View testID={testIds.screen.cart} style={[styles.root, { paddingTop: insets.top }]} onLayout={onFirstScreenLayout}>
      <CartHeader />
      <View style={styles.body}>
        {ids.length > 0 ? (
          <Animated.View key="lines" style={styles.fill} exiting={exiting}>
            <CartList ids={ids} />
          </Animated.View>
        ) : (
          <Animated.View
            key="empty"
            style={styles.centre}
            entering={reduceMotion ? reducedEnterAfterExit : enterAfterExit}
          >
            <CheckoutSuccess />
            <EmptyState
              icon={ShoppingBag}
              title={t('cart.empty.title')}
              body={t('cart.empty.body')}
              action={{
                label: t('cart.empty.cta'),
                onPress: () => router.navigate('/category'),
                testID: testIds.cartEmptyCta,
              }}
            />
          </Animated.View>
        )}
        <View style={styles.undoSlot}>
          <UndoBar
            testID={testIds.undoBar}
            visible={lastRemoved !== null}
            eventKey={lastRemoved?.line.id}
            message={removedMessage}
            actionLabel={t('cart.undo')}
            actionHint={t('cart.undoHint')}
            onAction={undo}
            onTimeout={cartActions.commitRemoval}
          />
        </View>
      </View>
      {ids.length > 0 ? (
        <Animated.View entering={reduceMotion ? reducedEnter : enterNow} exiting={exiting}>
          <CartSummary />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgApp },
  header: {
    minHeight: size.touch,
    justifyContent: 'center',
    // Content-box min height: the padding is added on top, as Category's row adds it around its button.
    boxSizing: 'content-box',
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  body: { flex: 1 },
  fill: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center' },
  undoSlot: {
    position: 'absolute',
    start: layout.gutter,
    end: layout.gutter,
    bottom: space.sm,
    pointerEvents: 'box-none',
  },
}));
