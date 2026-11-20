/**
 * Every product picture in the app goes through this one component, so the image rules (F-06, C-02)
 * live in one place:
 *
 * - Sized to display: the URL asks picsum for the bucket that covers `displaySize × pixelRatio`, never
 *   the 800 px original for a small tile (D-06).
 * - Placeholder first: the box is painted in the product's dominant colour before a byte arrives.
 * - Short fade, once: a 160 ms cross-dissolve on first load, skipped on any cache hit, so scrolling back
 *   over a tile shows it instantly instead of flickering (C-02).
 * - Recycling-safe: `recyclingKey` is the URL, so a recycled FlashList cell drops the old picture
 *   immediately instead of showing the previous product for a frame.
 *
 * The hero transition draws its overlay with `productImageUri`, which returns the same URL the tile
 * used, so the overlay is a guaranteed memory-cache hit and never flashes.
 */
import { Image, type ImageStyle } from 'expo-image';
import { PixelRatio, type StyleProp } from 'react-native';

import { imageUri } from '@/core/catalog';
import { radius as radii } from '@/design/tokens';

/** First-load fade. Long enough to soften the pop-in, short enough to never feel slow (DESIGN §5). */
export const IMAGE_FADE_MS = 160;

const TRANSITION = { duration: IMAGE_FADE_MS, effect: 'cross-dissolve', skipOnCacheHit: 'all' } as const;

/** The URL a product image of `displaySize` dp resolves to on this device. Shared with the hero. */
export function productImageUri(productId: string, n: number, displaySize: number): string {
  return imageUri(productId, n, displaySize, PixelRatio.get());
}

export type ProductImageProps = {
  productId: string;
  /** Which image of the product, 1-based (picsum seed `<id>-<n>`). */
  n?: number;
  /** The width the image is drawn at, in dp. Decides which size is downloaded. */
  displaySize: number;
  /** `product.dominantColor`: what the box shows until the picture arrives. */
  placeholderColor: string;
  radius?: number;
  style?: StyleProp<ImageStyle>;
  priority?: 'low' | 'normal' | 'high';
  accessibilityLabel?: string;
  testID?: string;
};

export function ProductImage({
  productId,
  n = 1,
  displaySize,
  placeholderColor,
  radius = radii.image,
  style,
  priority = 'normal',
  accessibilityLabel,
  testID,
}: ProductImageProps) {
  const uri = productImageUri(productId, n, displaySize);
  return (
    <Image
      testID={testID}
      source={{ uri }}
      recyclingKey={uri}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={TRANSITION}
      priority={priority}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ backgroundColor: placeholderColor, borderRadius: radius }, style]}
    />
  );
}
