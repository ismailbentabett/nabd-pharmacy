/**
 * The product page route (P-01..P-03). Routes stay thin: the screen lives in `src/features/product`.
 *
 * The id comes from the URL and is looked up synchronously in the local catalog, so the page renders
 * its content on the first frame the hero needs (no loading state between the tile and the page).
 * `key` remounts the screen if the id ever changes in place, so the hero state never carries over
 * from one product to another. An id the catalog does not know shows the not-found state.
 *
 * `useProductPageLatch` holds the one-page latch (openProduct.ts) while this route is mounted and
 * clears it when it goes, so no tile or card can push a second product page over this one.
 */
import { useLocalSearchParams } from 'expo-router';

import { findProduct } from '@/core/catalog';
import { ProductNotFound } from '@/features/product/ProductNotFound';
import { ProductScreen } from '@/features/product/ProductScreen';
import { useProductPageLatch } from '@/motion/hero/openProduct';

export default function ProductRoute() {
  useProductPageLatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = typeof id === 'string' ? findProduct(id) : undefined;
  return product ? <ProductScreen key={product.id} product={product} /> : <ProductNotFound />;
}
