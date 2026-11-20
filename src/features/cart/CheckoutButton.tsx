/**
 * "Place order" at the bottom of the totals card.
 *
 * - Supabase build: only a signed-in user can order. Signed out, the button says so and opens the
 *   Account tab; while the stored session is still loading it waits, disabled.
 * - Offline build: orders go to the in-memory fake (`src/state/orders.ts`), and a caption says so.
 *
 * The press itself is answered by the native pressed state and a haptic at once (F-03); the label
 * switches to "Placing order…" in the same render, before any network work. The order is the cart as
 * it is at the moment of the press (read once with `getCartState`, so this component does not
 * subscribe to the lines). On success exactly the ordered quantities leave the cart (anything added
 * while the order was in flight stays) and the Cart tab shows the confirmation (`CheckoutSuccess`);
 * the order history is invalidated so the Account tab refetches.
 * On failure the reason is shown inline, under the button, from the typed `CheckoutError`. A
 * "signed out" refusal (expired session) also signs out locally, so the Account tab shows the form.
 *
 * Idempotency: one request id per checkout attempt of a given cart. Pressing again after a failure
 * with the same lines reuses it (a timeout may hide an order the server did write); a changed cart
 * or a successful order starts a new one.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uuid } from 'expo';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';

import { toCheckoutError, type CheckoutError, type OrderLineInput } from '@/core/api/ordersApi';
import { findProduct } from '@/core/catalog';
import { signOut } from '@/features/account/auth';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { Translator } from '@/i18n/useT';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { cartActions, getCartState } from '@/state/cart.store';
import { ORDERS_QUERY_KEY, ordersApi, setLastPlacedOrder } from '@/state/orders';
import { useSession } from '@/state/session.store';
import { testIds } from '@/testIds';

function currentCartLines(): OrderLineInput[] {
  const { ids, byId } = getCartState();
  const lines: OrderLineInput[] = [];
  for (const id of ids) {
    const line = byId[id];
    if (line !== undefined) lines.push({ productId: id, qty: line.qty });
  }
  return lines;
}

/** Same lines, same order: the key that decides whether a press is a retry. */
function linesKey(lines: readonly OrderLineInput[]): string {
  return lines.map((line) => `${line.productId}x${line.qty}`).join(',');
}

interface PlaceOrderInput {
  lines: OrderLineInput[];
  requestId: string;
}

/** The sentence for a failed checkout. Exported for tests. */
export function checkoutErrorMessage(error: CheckoutError, { lang, t }: Translator): string {
  switch (error.kind) {
    case 'outOfStock': {
      const product = findProduct(error.productId);
      if (product === undefined) return t('checkout.error.unknownProduct');
      return t('checkout.error.outOfStock', { name: lang === 'ar' ? product.nameAr : product.name });
    }
    case 'unknownProduct':
      return t('checkout.error.unknownProduct');
    case 'tooMany':
      return t('checkout.error.tooMany');
    case 'signedOut':
      return t('checkout.error.signedOut');
    case 'empty':
    case 'generic':
      return t('checkout.error.generic');
  }
}

export function CheckoutButton() {
  const styles = useStyles();
  const router = useRouter();
  const translator = useT();
  const { t } = translator;
  const queryClient = useQueryClient();
  const status = useSession((s) => s.status);

  // The id of the attempt in progress or last failed, with the lines it was for. Only read in the
  // press handler and the mutation callbacks, never in render.
  const attempt = useRef<{ requestId: string; key: string } | null>(null);

  const placeOrder = useMutation({
    mutationFn: ({ lines, requestId }: PlaceOrderInput) => ordersApi.placeOrder(lines, requestId),
    // On the mutation itself (not `mutate`'s options) so they still run once the cart empties and
    // this card unmounts.
    onSuccess: (order, { lines }) => {
      haptics.success();
      attempt.current = null;
      setLastPlacedOrder(order);
      // Only what was sent: not `clear()`, which would also drop what was added during the request.
      cartActions.removeOrdered(lines);
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
    onError: (error) => {
      haptics.warn();
      // The server no longer accepts this session (expired or revoked): drop it on this phone too.
      if (toCheckoutError(error).kind === 'signedOut') void signOut();
    },
  });

  const needsAccount = ordersApi.kind === 'supabase' && status !== 'signedIn';
  const signedOut = needsAccount && status === 'signedOut';
  const pending = placeOrder.isPending;
  const disabled = pending || (needsAccount && !signedOut);

  const label = signedOut ? t('checkout.signInFirst') : pending ? t('checkout.placing') : t('checkout.placeOrder');

  const onPress = () => {
    haptics.confirm();
    if (signedOut) {
      router.navigate('/account');
      return;
    }
    setLastPlacedOrder(null);
    const lines = currentCartLines();
    const key = linesKey(lines);
    if (attempt.current === null || attempt.current.key !== key) {
      attempt.current = { requestId: uuid.v4(), key };
    }
    placeOrder.mutate({ lines, requestId: attempt.current.requestId });
  };

  const errorText = placeOrder.isError ? checkoutErrorMessage(toCheckoutError(placeOrder.error), translator) : null;

  return (
    <View style={styles.root}>
      <PressableScale
        testID={testIds.checkout.button}
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        style={styles.button}
      >
        <Text variant="label" weight="semibold" tone="onAccent" align="center">
          {label}
        </Text>
      </PressableScale>
      {errorText !== null ? (
        <Text testID={testIds.checkout.error} variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      ) : null}
      {ordersApi.kind === 'fake' && errorText === null ? (
        <Text variant="caption" tone="muted">
          {t('checkout.offlineNote')}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { rowGap: space.xs, marginTop: space.sm },
  button: {
    backgroundColor: c.accent,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
