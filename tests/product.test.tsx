/**
 * The product page's content and its add-to-cart bar (P-02, P-03, F-03, G-08, G-09).
 * Leaving the page and the tile hand-off: productNavigation.test.tsx. When the header and the bar
 * take touches, the gallery reset and the back swipe: productChrome.test.tsx.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { t } from '@/i18n/strings';
import { ADDED_HOLD_MS } from '@/motion/springs';
import { cartActions, getCartState } from '@/state/cart.store';
import { MAX_QTY } from '@/state/cartMath';
import { testIds } from '@/testIds';

import { badgeText, galleryPageText, product, renderProduct, resetProductTests, soldOut } from './helpers/productHarness';
import { pressNative } from './helpers/render';

jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/productRouter')>('./helpers/productRouter').productRouterMock);

beforeEach(resetProductTests);
afterEach(() => {
  jest.restoreAllMocks();
});

describe('the page shows the product (P-02)', () => {
  it('content, and a label on every control (English)', async () => {
    const { unmount } = await renderProduct();
    const n = product.images.length;

    expect(screen.getByText(product.brand)).toBeTruthy();
    expect(screen.getByRole('header', { name: product.name })).toBeTruthy();
    expect(screen.getByText('Prices include 15% VAT')).toBeTruthy();
    expect(screen.getByText('In stock')).toBeTruthy();
    expect(screen.getByText('About this product')).toBeTruthy();
    expect(screen.getByText(product.descriptionEn)).toBeTruthy();
    expect(screen.getByLabelText(/^Rated \S+ out of 5, /)).toBeTruthy();

    expect(screen.getByTestId(testIds.productBack).props.accessibilityLabel).toBe('Back');
    expect(screen.getByTestId(testIds.productCart).props.accessibilityLabel).toBe('Open cart');
    expect(screen.getByTestId(testIds.addToCart).props.accessibilityLabel).toBe(`Add ${product.name} to cart`);
    const gallery = screen.getByTestId(testIds.productGallery);
    expect(gallery.props.accessibilityRole).toBe('adjustable');
    expect(gallery.props.accessibilityLabel).toBe('Product images');
    expect(galleryPageText()).toBe(`Image 1 of ${n}`);
    expect(screen.getByTestId(testIds.productQuantity).props.accessibilityValue).toMatchObject({ now: 1 });
    // The dots are drawn but not read: the gallery itself already says "Image 1 of n".
    expect(screen.queryByTestId(testIds.productDots)).toBeNull();
    expect(screen.getByTestId(testIds.productDots, { includeHiddenElements: true })).toBeTruthy();
    await unmount();
  });

  it('the gallery turns pages with the screen reader, and stops at the first one', async () => {
    const { unmount } = await renderProduct();
    const n = product.images.length;
    const action = async (actionName: string) => {
      await fireEvent(screen.getByTestId(testIds.productGallery), 'accessibilityAction', { nativeEvent: { actionName } });
    };

    await action('decrement');
    expect(galleryPageText()).toBe(`Image 1 of ${n}`);
    await action('increment');
    expect(galleryPageText()).toBe(`Image 2 of ${n}`);
    await action('decrement');
    expect(galleryPageText()).toBe(`Image 1 of ${n}`);
    await unmount();
  });
});

describe('add to cart (P-03, F-03)', () => {
  it('one press adds one at once, bumps the badge, and confirms by touch and voice', async () => {
    const { unmount } = await renderProduct();
    expect(screen.queryByTestId(testIds.productCartBadge, { includeHiddenElements: true })).toBeNull();

    await pressNative(testIds.addToCart);
    // In the store straight away: nothing waits for the animation.
    expect(getCartState().byId[product.id]?.qty).toBe(1);
    // The badge is for the eye; TalkBack hears the count in the cart button's hint.
    expect(badgeText()).toBe('1');
    expect(screen.getByTestId(testIds.productCart).props.accessibilityHint).toBe('1 item in cart');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(`${product.name} added to cart`);
    await unmount();
  });

  it('the stepper picks how many; every press adds that many again', async () => {
    const { unmount } = await renderProduct();
    const stepper = () => screen.getByTestId(testIds.productQuantity);

    await pressNative(`${testIds.productQuantity}-decrement`); // already at 1: stays there
    expect(stepper().props.accessibilityValue).toMatchObject({ now: 1 });
    await pressNative(`${testIds.productQuantity}-increment`);
    await pressNative(`${testIds.productQuantity}-increment`);
    expect(stepper().props.accessibilityValue).toMatchObject({ now: 3 });

    await pressNative(testIds.addToCart);
    expect(getCartState().byId[product.id]?.qty).toBe(3);
    await pressNative(testIds.addToCart);
    expect(getCartState().byId[product.id]?.qty).toBe(6);
    expect(getCartState().ids).toEqual([product.id]);
    expect(badgeText()).toBe('6');
    await unmount();
  });

  it('an out-of-stock product has no stepper and a disabled button that says so', async () => {
    const { unmount } = await renderProduct(soldOut);
    const button = screen.getByTestId(testIds.addToCart);
    expect(button.props.accessibilityLabel).toBe('Out of stock');
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId(testIds.productQuantity)).toBeNull();

    await pressNative(testIds.addToCart);
    expect(getCartState().ids).toEqual([]);
    await unmount();
  });

  it('under reduced motion "Added" still stays up for the whole hold (G-09)', async () => {
    // Reanimated's withDelay skips its wait under the system setting unless told otherwise; the
    // hold is a reading pause, not motion. Jest has no clock to watch, so this pins the opt-out.
    const withDelay = jest.spyOn(Reanimated, 'withDelay');
    const { unmount } = await renderProduct(product, { reduceMotion: true });

    await pressNative(testIds.addToCart);
    await waitFor(() =>
      expect(withDelay).toHaveBeenCalledWith(ADDED_HOLD_MS, expect.anything(), Reanimated.ReduceMotion.Never),
    );
    expect(getCartState().byId[product.id]?.qty).toBe(1);
    await unmount();
  });
});

describe('the per-item limit (P-03)', () => {
  const limitText = `Max ${MAX_QTY} per item`;

  it('a press adds only what still fits, and says "added"', async () => {
    cartActions.add(product.id, MAX_QTY - 2);
    const { unmount } = await renderProduct();
    for (let i = 0; i < 4; i += 1) await pressNative(`${testIds.productQuantity}-increment`);
    expect(screen.getByTestId(testIds.productQuantity).props.accessibilityValue).toMatchObject({ now: 5 });

    await pressNative(testIds.addToCart);
    expect(getCartState().byId[product.id]?.qty).toBe(MAX_QTY);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(`${product.name} added to cart`);
    // Now full: the button says so, by eye and in TalkBack's hint, and stays pressable to explain.
    expect(screen.getByText(limitText)).toBeTruthy();
    expect(screen.getByTestId(testIds.addToCart).props.accessibilityHint).toBe(limitText);
    expect(screen.getByTestId(testIds.addToCart).props.accessibilityState).toMatchObject({ disabled: false });
    await unmount();
  });

  it('at the limit a press adds nothing, warns by touch, and says why instead of "added"', async () => {
    cartActions.add(product.id, MAX_QTY);
    const { unmount } = await renderProduct();
    expect(screen.getByText(limitText)).toBeTruthy();

    await pressNative(testIds.addToCart);
    expect(getCartState().byId[product.id]?.qty).toBe(MAX_QTY);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(limitText);
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith(`${product.name} added to cart`);
    await unmount();
  });
});

describe('Arabic (G-08)', () => {
  it('renders the Arabic copy and labels, and announces in Arabic', async () => {
    const { unmount } = await renderProduct(product, { lang: 'ar' });
    const n = product.images.length;

    expect(screen.getByRole('header', { name: product.nameAr })).toBeTruthy();
    expect(screen.getByText(product.descriptionAr)).toBeTruthy();
    expect(screen.getByText(t('ar', 'product.vatNote'))).toBeTruthy();
    expect(screen.getByTestId(testIds.productBack).props.accessibilityLabel).toBe('رجوع');
    expect(screen.getByTestId(testIds.addToCart).props.accessibilityLabel).toBe(`إضافة ${product.nameAr} إلى السلة`);
    expect(galleryPageText()).toBe(t('ar', 'a11y.page', { i: 1, n }));

    await pressNative(testIds.addToCart);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      t('ar', 'a11y.addedToCart', { name: product.nameAr }),
    );
    await unmount();
  });
});
