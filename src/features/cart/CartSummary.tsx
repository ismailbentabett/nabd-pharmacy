/**
 * The totals card under the cart lines (K-04, D-07): free-delivery progress, then subtotal before
 * VAT, the 15 % VAT share on its own line, and the total in SAR.
 *
 * - Prices include VAT, so the total is the sum of the lines and VAT is the share inside it
 *   (`splitVat`, integer halalas, tested against docs/fixtures/cart-vectors.json).
 * - The numbers are plain text rendered from the store in the same commit as the change: they are
 *   never animated, so they are never stale, even for a frame. Only the delivery bar moves.
 * - This is the only component that subscribes to the total; rows and the header do not (F-05).
 *
 * The delivery bar fills with a translateX on the UI thread (no width animation). Its fill is drawn
 * full width and slid back towards the start by the part not yet earned; in Arabic it slides the other
 * way (`dir`). Under reduced motion it jumps to the new value.
 *
 * "Place order" closes the card (`CheckoutButton`); it does not read the total, so it does not
 * re-render on a quantity change.
 */
import { Truck } from 'lucide-react-native';
import { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { useDirection } from '@/i18n/direction';
import { formatSar } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useMotionPreference } from '@/motion/motionPreference';
import { effectsSlow } from '@/motion/springs';
import { useCartTotals } from '@/state/cart.store';
import { testIds } from '@/testIds';

import { CheckoutButton } from './CheckoutButton';
import { freeDeliveryProgress } from './freeDelivery';

const TRACK_HEIGHT = 4;

function SummaryLine({ label, value, testID, strong = false }: SummaryLineProps) {
  const styles = useStyles();
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text variant={strong ? 'heading' : 'body'} weight={strong ? 'semibold' : undefined} tone={strong ? 'primary' : 'muted'}>
        {label}
      </Text>
      <Text testID={testID} variant={strong ? 'heading' : 'body'} weight={strong ? 'semibold' : 'medium'} numeric>
        {value}
      </Text>
    </View>
  );
}

type SummaryLineProps = { label: string; value: string; testID: string; strong?: boolean };

export function CartSummary() {
  const styles = useStyles();
  const c = useColors();
  const { lang, t } = useT();
  const { dir } = useDirection();
  const reduceMotion = useMotionPreference();
  const { gross, vat, net } = useCartTotals();
  const delivery = freeDeliveryProgress(gross);

  const progress = useSharedValue(delivery.progress);
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    progress.set(reduceMotion ? delivery.progress : withSpring(delivery.progress, effectsSlow));
  }, [delivery.progress, reduceMotion, progress]);

  const fillStyle = useAnimatedStyle(() => {
    const width = trackWidth.get();
    return {
      // Hidden until measured, so the first frame never shows a full bar.
      opacity: width > 0 ? 1 : 0,
      transform: [{ translateX: -dir * (1 - progress.get()) * width }],
    };
  });

  const onTrackLayout = (event: LayoutChangeEvent) => trackWidth.set(event.nativeEvent.layout.width);

  const deliveryText = delivery.unlocked
    ? t('cart.freeDeliveryDone')
    : t('cart.freeDelivery', { amount: formatSar(delivery.remaining, lang) });

  return (
    <View style={styles.card}>
      <View testID={testIds.cartFreeDelivery} style={styles.delivery} accessible accessibilityLabel={deliveryText}>
        <View style={styles.deliveryText}>
          <Truck size={size.iconSmall} color={delivery.unlocked ? c.success : c.textMuted} strokeWidth={size.iconStroke} />
          <Text variant="caption" weight="medium" tone={delivery.unlocked ? 'success' : 'muted'} numeric style={styles.flex}>
            {deliveryText}
          </Text>
        </View>
        <View style={styles.track} onLayout={onTrackLayout}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>

      <SummaryLine label={t('cart.subtotal')} value={formatSar(net, lang)} testID={testIds.cartSubtotal} />
      <SummaryLine label={t('cart.vat')} value={formatSar(vat, lang)} testID={testIds.cartVat} />
      <View style={styles.rule} />
      <SummaryLine label={t('cart.total')} value={formatSar(gross, lang)} testID={testIds.cartTotal} strong />
      <CheckoutButton />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    marginHorizontal: layout.gutter,
    marginBottom: space.sm,
    padding: space.md,
    rowGap: space.xs,
    borderRadius: radius.tile,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    backgroundColor: c.bgSurface,
  },
  delivery: { rowGap: space.xs, paddingBottom: space.xs },
  deliveryText: { flexDirection: 'row', alignItems: 'center', columnGap: space.xs },
  flex: { flex: 1 },
  track: { height: TRACK_HEIGHT, borderRadius: radius.pill, backgroundColor: c.bgSunken, overflow: 'hidden' },
  fill: { flex: 1, borderRadius: radius.pill, backgroundColor: c.success },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', columnGap: space.sm },
  rule: { height: size.hairline, backgroundColor: c.lineHairline, marginVertical: space.xxs },
}));
