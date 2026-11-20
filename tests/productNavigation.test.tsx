/**
 * Leaving the product page, the hand-off from a grid tile, and the route (P-01, F-04, G-09).
 *
 * The router is a stand-in that records calls. Leaving is asynchronous on purpose: the close runs on
 * the "UI thread" and only its landing pops the route, so these tests wait for it. A page that
 * flies from a tile takes touches only once it has landed open (`untilInteractive`).
 */
import { act, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler, Dimensions } from 'react-native';

import ProductRoute from '../app/product/[id]';
import { readHeroSource } from '@/motion/hero/registry';
import { testIds } from '@/testIds';
import { productImageUri } from '@/ui/ProductImage';

import {
  galleryImageUris,
  product,
  renderProduct,
  renderTileAndPage,
  resetProductTests,
  settle,
  Shell,
  tileUri,
  untilInteractive,
} from './helpers/productHarness';
import { productRoute } from './helpers/productRouter';
import { pressNative, renderWithProviders } from './helpers/render';

jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/productRouter')>('./helpers/productRouter').productRouterMock);

const back = jest.mocked(router.back);
const replace = jest.mocked(router.replace);
const canGoBack = jest.mocked(router.canGoBack);

beforeEach(resetProductTests);
afterEach(() => {
  jest.restoreAllMocks();
});

describe('leaving the page (P-01, F-04)', () => {
  it('Back runs the close transition and pops the route once, when it lands', async () => {
    const { unmount } = await renderProduct();
    await pressNative(testIds.productBack);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();
    await unmount();
  });

  it('opened cold from a link (no history), Back goes Home instead', async () => {
    canGoBack.mockReturnValueOnce(false);
    const { unmount } = await renderProduct();
    await pressNative(testIds.productBack);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(back).not.toHaveBeenCalled();
    await unmount();
  });

  it("Android's Back key runs the same close, and the page keeps the key for itself", async () => {
    type BackKeyHandler = Parameters<typeof BackHandler.addEventListener>[1];
    let onBackKey: BackKeyHandler | null = null;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      onBackKey = handler;
      return { remove: jest.fn() };
    });
    const { unmount } = await renderProduct();
    const pressBackKey = onBackKey as BackKeyHandler | null;
    if (pressBackKey === null) throw new Error('The page did not listen for the Back key');

    let consumed: boolean | null | undefined;
    await act(async () => {
      consumed = pressBackKey({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    expect(consumed).toBe(true);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    // A second press while the page is already closing does not pop a second route.
    await act(async () => {
      pressBackKey({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    await settle();
    expect(back).toHaveBeenCalledTimes(1);
    await unmount();
  });
});

describe('the hand-off from a grid tile (P-01, G-09)', () => {
  it('the page starts from the exact image the tile is showing, and uses the hand-off once', async () => {
    const { show, onTilePress, unmount } = await renderTileAndPage();

    await pressNative(testIds.productTile(0));
    expect(onTilePress).toHaveBeenCalledWith(product, 0);
    expect(readHeroSource(product.id)?.uri).toBe(tileUri);

    await show(true, true);
    expect(galleryImageUris()).toContain(tileUri);
    expect(readHeroSource(product.id)).toBeNull();

    await untilInteractive();
    await pressNative(testIds.productBack);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await unmount();
  });

  it('opening the same product later without a tile (a Home card) fades: no stale flight', async () => {
    const { show, unmount } = await renderTileAndPage();
    await pressNative(testIds.productTile(0));
    await show(true, true);
    await untilInteractive();
    await pressNative(testIds.productBack);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await show(true, false);

    // The tile is still mounted under the tabs; the page opens again from somewhere else.
    await show(true, true);
    expect(galleryImageUris()).not.toContain(tileUri);
    await unmount();
  });

  it('a tile that goes away (unmounted or recycled) takes its hand-off with it', async () => {
    const { show, unmount } = await renderTileAndPage();
    await pressNative(testIds.productTile(0));
    expect(readHeroSource(product.id)).not.toBeNull();
    await show(false, false);
    expect(readHeroSource(product.id)).toBeNull();
    await unmount();
  });

  it('reduced motion: no flight from the tile, the page fades on its own images and still leaves', async () => {
    const { show, unmount } = await renderTileAndPage({ reduceMotion: true });
    await pressNative(testIds.productTile(0));

    await show(true, true);
    expect(galleryImageUris()).not.toContain(tileUri);
    // The page draws its own first image at the window's width (useWindowDimensions).
    expect(galleryImageUris()).toContain(productImageUri(product.id, 1, Dimensions.get('window').width));
    // Taken all the same, so it cannot be flown later from a stale rect.
    expect(readHeroSource(product.id)).toBeNull();

    await pressNative(testIds.productBack);
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    await unmount();
  });
});

describe('the route', () => {
  async function renderRoute(id: string) {
    productRoute.params.id = id;
    const result = await renderWithProviders(
      <Shell>
        <ProductRoute />
      </Shell>,
    );
    await settle();
    return result;
  }

  it('a known id shows that product', async () => {
    const { unmount } = await renderRoute(product.id);
    expect(screen.getByTestId(testIds.screen.product)).toBeTruthy();
    expect(screen.getByRole('header', { name: product.name })).toBeTruthy();
    await unmount();
  });

  it('an unknown id shows "not available", and its button leaves', async () => {
    const { unmount } = await renderRoute('no-such-product');
    expect(screen.getByTestId(testIds.productNotFound)).toBeTruthy();
    expect(screen.getByText('This product isn’t available')).toBeTruthy();
    expect(screen.queryByTestId(testIds.screen.product)).toBeNull();

    expect(screen.getByTestId(testIds.productNotFoundAction).props.accessibilityLabel).toBe('Go back');
    await pressNative(testIds.productNotFoundAction);
    expect(back).toHaveBeenCalledTimes(1);
    await unmount();
  });
});
