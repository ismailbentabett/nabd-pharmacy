/**
 * What the hero's one `progress` value does to each layer of the product page (P-01, G-09).
 * Every style here is transform + opacity only and runs on the UI thread.
 *
 * - hero: the gallery, moved and scaled so it covers the tile at 0 and its own place at 1, plus
 *   the "carry" offset that keeps it under a dragging finger. Without a tile rect it just fades.
 *   Its corners start as the tile's rounded ones and square off early in the flight (heroCornerRadius).
 *   That radius is the one animated property here besides transform and opacity: it is a paint
 *   property (no layout), on this one view only, and constant 0 from CORNERS_SQUARE_AT on
 *   (ADR-047). The view clips its children (`overflow: hidden`).
 * - backdrop: the page background, opaque by 60 % so the grid underneath is gone early.
 * - content: the body below the gallery, which fades in late and rises the last 24 pt into place.
 *   Under reduced motion it only fades.
 * - chrome: header and add-to-cart bar, which appear last, once the image has nearly arrived.
 */
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { radius } from '@/design/tokens';
import { clamp } from '@/motion/gestureMath';

import { coverTransform, galleryRect, heroCornerRadius, heroFrame, type Rect } from './heroMath';

/** How far the page body rises while it fades in: it settles into place rather than sliding. */
export const RISE = 24;

export type HeroStyleInputs = Readonly<{
  progress: SharedValue<number>;
  carryX: SharedValue<number>;
  carryY: SharedValue<number>;
  scrollY: SharedValue<number>;
  /** 0 until the hero starts, so it never shows on top of the tile before its image is drawn. */
  visible: SharedValue<number>;
  /** The tile's rect, or null to fade instead of flying. */
  srcRect: SharedValue<Rect | null> | null;
  width: number;
  reduceMotion: boolean;
}>;

export function useHeroStyles({
  progress,
  carryX,
  carryY,
  scrollY,
  visible,
  srcRect,
  width,
  reduceMotion,
}: HeroStyleInputs) {
  const heroStyle = useAnimatedStyle(() => {
    const p = clamp(progress.get(), 0, 1);
    const src = srcRect === null ? null : srcRect.get();
    if (src === null) {
      return { opacity: p, borderRadius: 0, transform: [{ translateX: carryX.get() }, { translateY: carryY.get() }] };
    }
    const dst = galleryRect(width, scrollY.get());
    const t = coverTransform(heroFrame(p, src, dst), dst);
    return {
      opacity: visible.get(),
      borderRadius: heroCornerRadius(p, t.scale, radius.image),
      transform: [
        { translateX: t.translateX + carryX.get() },
        { translateY: t.translateY + carryY.get() },
        { scale: t.scale },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.6], [0, 1], Extrapolation.CLAMP),
  }));

  const rise = reduceMotion ? 0 : RISE;
  const contentStyle = useAnimatedStyle(() => {
    const p = clamp(progress.get(), 0, 1);
    return {
      opacity: interpolate(p, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - p) * rise }],
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.6, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return { heroStyle, backdropStyle, contentStyle, chromeStyle };
}
