/**
 * Shared set-up for the product page tests (product, productNavigation, productChrome).
 *
 * Jest has no UI thread and no frames: Reanimated's mock finishes every spring and timing at once
 * and calls its callback straight away, and worklets scheduled with scheduleOnUI run on a later
 * tick. So the tests check what the page does (what it draws, what lands in the cart, which way it
 * leaves, when it takes touches), not how a frame looks; the frame maths is pinned in
 * heroMath.test.ts and flyPath.test.ts.
 *
 * Shared values live as long as the component (helpers/sharedValues), as on a device: the page's
 * "landed" and "interactive" flags must survive the re-render that the open's landing causes.
 *
 * Each test file mocks expo-router itself with helpers/productRouter (jest.mock is per file).
 */
import { act, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getCatalog, type Product } from '@/core/catalog';
import { ProductTile, tileImageSize } from '@/features/category/ProductTile';
import { ProductScreen } from '@/features/product/ProductScreen';
import type { Lang } from '@/i18n/format';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetProductOpenLatchForTest } from '@/motion/hero/openProduct';
import { resetHeroRegistryForTest } from '@/motion/hero/registry';
import { resetMotionPreferenceForTest, useMotionPreference } from '@/motion/motionPreference';
import { cartActions } from '@/state/cart.store';
import { testIds } from '@/testIds';
import { productImageUri } from '@/ui/ProductImage';

import { productRoute } from './productRouter';
import { renderWithProviders } from './render';
import { keepSharedValues } from './sharedValues';

const METRICS = { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } };
export const TILE_WIDTH = 170;

function pick(test: (product: Product) => boolean, what: string): Product {
  const found = getCatalog().products.find(test);
  if (!found) throw new Error(`The catalog has no ${what}`);
  return found;
}

export const product = pick((p) => p.inStock && p.images.length > 1, 'in-stock product with several images');
export const soldOut = pick((p) => !p.inStock, 'out-of-stock product');
export const tileUri = productImageUri(product.id, 1, tileImageSize(TILE_WIDTH));

/** beforeEach: every case starts with no page open, an empty cart and fresh motion settings. */
export function resetProductTests() {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  resetHeroRegistryForTest();
  resetProductOpenLatchForTest();
  jest.clearAllMocks();
  cartActions.clear();
  delete productRoute.params.id;
  keepSharedValues();
}

/** Mounts its children only once the motion preference reads `reduce`: the page reads it at mount. */
function OnceMotionIs({ reduce, children }: { reduce: boolean; children: ReactNode }) {
  return useMotionPreference() === reduce ? children : null;
}

export function Shell({ reduce = false, children }: { reduce?: boolean; children: ReactNode }) {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <OnceMotionIs reduce={reduce}>{children}</OnceMotionIs>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Let the motion preference resolve and the scheduled worklets run (shorter than the hero's 150 ms deadline). */
export async function settle() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

export type ProductRenderOptions = { lang?: Lang; reduceMotion?: boolean };

export async function renderProduct(item: Product = product, { lang = 'en', reduceMotion = false }: ProductRenderOptions = {}) {
  if (reduceMotion) jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
  const result = await renderWithProviders(
    <Shell reduce={reduceMotion}>
      <ProductScreen product={item} />
    </Shell>,
    { lang },
  );
  await settle();
  expect(screen.getByTestId(testIds.screen.product)).toBeTruthy();
  return result;
}

/**
 * Waits until the page has landed open: the header's Back is hidden from TalkBack (and from the
 * default queries) until then. A flight waits for the tile image or for the 150 ms deadline.
 */
export async function untilInteractive() {
  await screen.findByTestId(testIds.productBack);
}

/** Whether a control sits inside a view that takes no touches (`pointerEvents: 'none'`). */
export function isTouchBlocked(testID: string): boolean {
  let node: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId(testID, { includeHiddenElements: true });
  while (node !== null) {
    if (node.props.pointerEvents === 'none' || StyleSheet.flatten(node.props.style)?.pointerEvents === 'none') return true;
    node = node.parent;
  }
  return false;
}

/**
 * A grid tile with the product page over it, as in the app: the page is a modal on top of the grid,
 * so the tile stays mounted while the page is open.
 */
function TileAndPage({ tile, page, onTilePress }: { tile: boolean; page: boolean; onTilePress: () => void }) {
  return (
    <>
      {tile ? <ProductTile product={product} index={0} width={TILE_WIDTH} onPress={onTilePress} /> : null}
      {page ? <ProductScreen product={product} /> : null}
    </>
  );
}

export async function renderTileAndPage({ reduceMotion = false }: { reduceMotion?: boolean } = {}) {
  if (reduceMotion) jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
  const onTilePress = jest.fn();
  const view = (tile: boolean, page: boolean) => (
    <Shell reduce={reduceMotion}>
      <TileAndPage tile={tile} page={page} onTilePress={onTilePress} />
    </Shell>
  );
  const result = await renderWithProviders(view(true, false));
  await settle();
  const show = async (tile: boolean, page: boolean) => {
    await result.rerender(view(tile, page));
    await settle();
  };
  return { ...result, onTilePress, show };
}

/** Every image URL drawn inside the gallery (expo-image's `source`, an object or a list). */
export function galleryImageUris(): string[] {
  const found: string[] = [];
  const stack: unknown[] = [screen.getByTestId(testIds.productGallery).toJSON()];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) stack.push(...node);
    else if (node !== null && typeof node === 'object' && 'props' in node) {
      const { props, children } = node as { props: { source?: unknown }; children: unknown };
      for (const source of [props.source].flat()) {
        if (source !== null && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
          found.push(source.uri);
        }
      }
      if (children) stack.push(children);
    }
  }
  return found;
}

/** The gallery's "Image i of n", as TalkBack reads it. */
export function galleryPageText(): string | undefined {
  return (screen.getByTestId(testIds.productGallery).props.accessibilityValue as { text?: string } | undefined)?.text;
}

/** The number drawn on the header's cart icon (hidden from TalkBack, which hears the hint instead). */
export function badgeText(): string {
  const badge = screen.getByTestId(testIds.productCartBadge, { includeHiddenElements: true });
  return within(badge).getByText(/\d/, { includeHiddenElements: true }).props.children as string;
}
