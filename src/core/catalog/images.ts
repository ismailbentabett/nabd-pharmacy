/**
 * Image URLs (D-06). The catalog stores 800 px originals; screens ask for the size they draw,
 * snapped to a few buckets so the HTTP/disk cache is shared between screens that draw similar sizes.
 */
export const IMAGE_BUCKETS = [160, 240, 320, 480, 640, 800] as const;
export type ImageBucket = (typeof IMAGE_BUCKETS)[number];

const MAX_BUCKET: ImageBucket = 800;

export function fullImageUri(id: string, n: number): string {
  return `https://picsum.photos/seed/${id}-${n}/${MAX_BUCKET}/${MAX_BUCKET}`;
}

/** Smallest bucket that covers `displayDp × pixelRatio` physical pixels, capped at 800. */
export function imageBucket(displayDp: number, pixelRatio: number): ImageBucket {
  const needed = Math.ceil(displayDp * pixelRatio);
  for (const bucket of IMAGE_BUCKETS) {
    if (bucket >= needed) return bucket;
  }
  return MAX_BUCKET;
}

/** Picsum URL for image `n` (1-based) of a product, at the size it will actually be drawn. */
export function imageUri(id: string, n: number, displayDp: number, pixelRatio: number): string {
  const size = imageBucket(displayDp, pixelRatio);
  return `https://picsum.photos/seed/${id}-${n}/${size}/${size}`;
}
