/**
 * Order history on the Account tab: number, date, status, item count and total of each past order,
 * newest first.
 *
 * Who sees what:
 * - Offline build: the in-memory orders placed in this session (`src/state/orders.ts`).
 * - Supabase build: the signed-in user's orders (RLS returns only their rows). Signed out: nothing,
 *   the Account screen shows the sign-in form instead. While the stored session loads: the skeleton.
 *
 * The query is keyed by user (`['orders', userId]`), so signing in as someone else never shows the
 * previous person's cached orders. Checkout invalidates the `['orders']` prefix, which covers it.
 *
 * At most ORDER_HISTORY_LIMIT rows, so a plain map (not a virtualised list) is enough: it sits inside
 * the Account screen's scroll view.
 */
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react-native';
import { View } from 'react-native';

import { orderNumber, type OrderStatus, type OrderSummary } from '@/core/api/ordersApi';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { formatDzd, type Lang } from '@/i18n/format';
import type { MessageKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { ORDERS_QUERY_KEY, ordersApi } from '@/state/orders';
import { useSession } from '@/state/session.store';
import { testIds } from '@/testIds';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';

const SKELETON_ROWS = 3;
const ROW_HEIGHT = 72;

const STATUS_KEY: Readonly<Record<OrderStatus, MessageKey>> = {
  placed: 'orders.status.placed',
  preparing: 'orders.status.preparing',
  delivered: 'orders.status.delivered',
  cancelled: 'orders.status.cancelled',
};

// Gregorian calendar and Western digits in both languages, like every other number in the app.
const DATE_FORMATS: Readonly<Record<Lang, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  ar: new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }),
};

/** "20 Nov 2026" / "20 نوفمبر 2026". */
export function formatOrderDate(iso: string, lang: Lang): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMATS[lang].format(date);
}

function OrderRow({ order }: { order: OrderSummary }) {
  const styles = useStyles();
  const { lang, t, tn } = useT();
  const title = t('orders.number', { id: orderNumber(order.id) });
  const date = formatOrderDate(order.createdAt, lang);
  const status = t(STATUS_KEY[order.status]);
  const items = tn('orders.items', order.itemCount);
  const total = formatDzd(order.grossH, lang);
  return (
    <View
      testID={testIds.orders.row(order.id)}
      style={styles.row}
      accessible
      accessibilityLabel={`${title}, ${date}, ${status}, ${items}, ${total}`}
    >
      <View style={styles.rowLine}>
        <Text variant="body" weight="semibold" numeric style={styles.flex} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="body" weight="semibold" numeric>
          {total}
        </Text>
      </View>
      <View style={styles.rowLine}>
        <Text variant="caption" tone="muted" numeric style={styles.flex} numberOfLines={1}>
          {`${date} · ${items}`}
        </Text>
        <View style={styles.status}>
          <Text variant="caption" weight="medium">
            {status}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function OrdersSection() {
  const styles = useStyles();
  const { t } = useT();
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const offline = ordersApi.kind === 'fake';
  const enabled = offline || status === 'signedIn';

  const orders = useQuery({
    queryKey: [...ORDERS_QUERY_KEY, userId ?? 'offline'],
    queryFn: () => ordersApi.listOrders(),
    enabled,
  });

  if (!offline && status === 'signedOut') return null;

  let body;
  if (!enabled || orders.isPending) {
    body = (
      <View testID={testIds.orders.loading} accessible accessibilityLabel={t('orders.loading')} style={styles.list}>
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          <Skeleton key={`skeleton-${row}`} height={ROW_HEIGHT} radius={radius.tile} />
        ))}
      </View>
    );
  } else if (orders.isError) {
    body = (
      <ErrorState
        compact
        testID={testIds.orders.error}
        title={t('orders.error.title')}
        onRetry={() => void orders.refetch()}
      />
    );
  } else if (orders.data.length === 0) {
    body = (
      <EmptyState
        testID={testIds.orders.empty}
        icon={Receipt}
        title={t('orders.empty.title')}
        body={t('orders.empty.body')}
      />
    );
  } else {
    body = (
      <View testID={testIds.orders.list} style={styles.list}>
        {orders.data.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text variant="heading" weight="semibold" accessibilityRole="header">
        {t('account.orders.title')}
      </Text>
      {body}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { rowGap: space.sm },
  list: { rowGap: space.xs },
  row: {
    minHeight: ROW_HEIGHT,
    justifyContent: 'center',
    rowGap: space.xxs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.tile,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    backgroundColor: c.bgSurface,
  },
  rowLine: { flexDirection: 'row', alignItems: 'center', columnGap: space.sm },
  flex: { flex: 1 },
  status: {
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: c.bgSunken,
  },
}));
