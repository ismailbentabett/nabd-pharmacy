/**
 * One product page at a time (P-01, F-04): the latch in motion/hero/openProduct.ts.
 *
 * A quick double tap used to push two product pages, because the second press lands before the
 * first page has mounted. Every way in (a Category tile, a Home best seller) now goes through
 * `openProductPage`: while a page is opening or open, a press pushes nothing and leaves no hero
 * hand-off. The route holds the latch while it is mounted; a push that never mounts a page stops
 * counting after OPENING_TIMEOUT_MS, so it cannot lock the app.
 */
import { screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import ProductRoute from '../app/product/[id]';
import { ProductTile } from '@/features/category/ProductTile';
import { BestSellerCard, CARD_WIDTH } from '@/features/home/BestSellerCard';
import { size, space } from '@/design/tokens';
import { isProductOpening, OPENING_TIMEOUT_MS, openProductPage } from '@/motion/hero/openProduct';
import * as registry from '@/motion/hero/registry';
import { testIds } from '@/testIds';
import { productImageUri } from '@/ui/ProductImage';

import { product, resetProductTests, settle, Shell, TILE_WIDTH, tileUri } from './helpers/productHarness';
import { productRoute } from './helpers/productRouter';
import { pressNative, renderWithProviders } from './helpers/render';

jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/productRouter')>('./helpers/productRouter').productRouterMock);

const push = jest.mocked(router.push);
const productPath = (id: string) => ({ pathname: '/product/[id]', params: { id } });

beforeEach(resetProductTests);
afterEach(() => {
  jest.restoreAllMocks();
});

describe('openProductPage', () => {
  it('a second open before the page mounts pushes nothing and prepares nothing', () => {
    const first = jest.fn();
    const second = jest.fn();
    expect(openProductPage(product.id, { prepare: first })).toBe(true);
    expect(openProductPage('p-0001', { prepare: second })).toBe(false);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(productPath(product.id));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(isProductOpening()).toBe(true);
  });

  it('a push that never mounts a page stops counting after the timeout', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    openProductPage(product.id);
    now.mockReturnValue(10_000 + OPENING_TIMEOUT_MS - 1);
    expect(isProductOpening()).toBe(true);
    now.mockReturnValue(10_000 + OPENING_TIMEOUT_MS);
    expect(isProductOpening()).toBe(false);

    expect(openProductPage(product.id)).toBe(true);
    expect(push).toHaveBeenCalledTimes(2);
  });
});

describe('the product route holds the latch', () => {
  it('while it is mounted (past the timeout too), and clears it when it goes', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(50_000);
    openProductPage(product.id);
    productRoute.params.id = product.id;
    const { unmount } = await renderWithProviders(
      <Shell>
        <ProductRoute />
      </Shell>,
    );
    await settle();

    now.mockReturnValue(50_000 + 10 * OPENING_TIMEOUT_MS);
    expect(isProductOpening()).toBe(true);
    expect(openProductPage('p-0001')).toBe(false);

    await unmount();
    expect(isProductOpening()).toBe(false);
    expect(openProductPage('p-0001')).toBe(true);
    expect(push).toHaveBeenCalledTimes(2);
  });
});

describe('a double tap opens one page', () => {
  it('Category tile: the second press leaves no hand-off and does not navigate', async () => {
    const register = jest.spyOn(registry, 'registerHeroSource');
    // As CategoryScreen wires it: the tile prepares its hand-off, the screen pushes through the latch.
    const onPress = jest.fn((pressed: typeof product) => openProductPage(pressed.id));
    const { unmount } = await renderWithProviders(
      <Shell>
        <ProductTile product={product} index={0} width={TILE_WIDTH} onPress={onPress} />
      </Shell>,
    );
    await settle();

    await pressNative(testIds.productTile(0));
    await pressNative(testIds.productTile(0));
    expect(push).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    expect(registry.readHeroSource(product.id)?.uri).toBe(tileUri);
    await unmount();
  });

  it('Home best seller: one push, and the card is a hero source with the image it shows', async () => {
    const register = jest.spyOn(registry, 'registerHeroSource');
    const { unmount } = await renderWithProviders(
      <Shell>
        <BestSellerCard product={product} />
      </Shell>,
    );
    await settle();

    await pressNative(testIds.homeBestSeller(product.id));
    await pressNative(testIds.homeBestSeller(product.id));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(productPath(product.id));
    expect(register).toHaveBeenCalledTimes(1);
    // The card's picture fills it inside its padding and hairline border.
    const cardImage = CARD_WIDTH - 2 * (space.xs + size.hairline);
    expect(registry.readHeroSource(product.id)?.uri).toBe(productImageUri(product.id, 1, cardImage));
    expect(screen.getByTestId(testIds.homeBestSeller(product.id))).toBeTruthy();
    await unmount();
  });
});
