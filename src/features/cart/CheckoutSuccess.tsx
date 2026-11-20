/**
 * The confirmation shown on the (now empty) Cart tab after an order is placed: order number and the
 * total paid. It stays until it is dismissed or something new goes into the cart (CartScreen clears
 * it), so leaving the tab and coming back does not lose it.
 */
import { CircleCheck, X } from 'lucide-react-native';
import { View } from 'react-native';

import { orderNumber } from '@/core/api/ordersApi';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { formatSar } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { setLastPlacedOrder, useLastPlacedOrder } from '@/state/orders';
import { testIds } from '@/testIds';

export function CheckoutSuccess() {
  const styles = useStyles();
  const c = useColors();
  const { lang, t } = useT();
  const order = useLastPlacedOrder();
  if (order === null) return null;

  const body = t('checkout.success.body', { id: orderNumber(order.id), total: formatSar(order.grossH, lang) });
  const dismiss = t('checkout.success.dismiss');

  return (
    <View testID={testIds.checkout.success} style={styles.card} accessibilityLiveRegion="polite">
      <CircleCheck size={size.icon} color={c.success} strokeWidth={size.iconStroke} />
      <View style={styles.text} accessible accessibilityLabel={`${t('checkout.success.title')}. ${body}`}>
        <Text variant="body" weight="semibold" tone="success">
          {t('checkout.success.title')}
        </Text>
        <Text variant="caption" tone="primary" numeric>
          {body}
        </Text>
      </View>
      <PressableScale onPress={() => setLastPlacedOrder(null)} accessibilityLabel={dismiss} style={styles.close}>
        <X size={size.iconSmall} color={c.textMuted} strokeWidth={size.iconStroke} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.sm,
    marginHorizontal: layout.gutter,
    marginTop: space.sm,
    paddingStart: space.md,
    borderRadius: radius.tile,
    backgroundColor: c.successSurface,
  },
  text: { flex: 1, rowGap: space.xxs, paddingVertical: space.sm },
  close: { alignItems: 'center', justifyContent: 'center' },
}));
