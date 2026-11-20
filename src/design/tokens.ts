/**
 * Spacing, shape and size tokens (docs/DESIGN.md §3). Colours live in `palette.ts` and reach
 * components through `theme.tsx`; type lives in `typography.ts`. Everything here is a plain number,
 * so it can be used in `StyleSheet.create` and in worklets alike.
 */

/** The 4-pt rhythm. Use these instead of literal paddings so the rhythm stays consistent. */
export const space = {
  /** Half a step. Only for insets inside small tags and between tightly stacked lines of one block. */
  hair: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const layout = {
  /** Horizontal padding between the screen edge and content. */
  gutter: 16,
  /** Gap between grid tiles, both directions. */
  gridGap: 12,
} as const;

/** One radius per kind of surface, so a tile never ends up 14 on one screen and 16 on another. */
export const radius = {
  image: 12,
  button: 14,
  tile: 16,
  banner: 20,
  sheet: 24,
  pill: 999,
} as const;

export const size = {
  /** Minimum touch target (Android guidance, CLAUDE.md accessibility floor). */
  touch: 48,
  hairline: 1,
  /** Lucide icons are drawn on a 24 grid; 1.75 strokes read crisper than the default 2 at this size. */
  icon: 24,
  iconStroke: 1.75,
  /** An icon beside a label inside a control (e.g. the Filter button), drawn on the same stroke. */
  iconSmall: 18,
  /** The rating star, sized to sit on a caption line. */
  iconTiny: 12,
  /** An icon inside a line of body or caption text (delivery note, retry button). */
  iconInline: 16,
  /** A secondary header icon that should read a step quieter than `icon` (the header bag, the search glass). */
  iconMedium: 20,
  /** The illustration icon of an empty or error state. */
  iconLarge: 32,
} as const;

/**
 * The drawn parts of small controls. These are what you see, not what you touch: each one sits inside
 * a PressableScale (or a whole row) that is at least `size.touch` on both axes.
 */
export const control = {
  /** The visible pill of a filter chip; its touch box stays `size.touch` tall. */
  chipHeight: 36,
  /** A round count badge (the active-filter count on the Filter button). */
  badge: 20,
  /** Radio ring and its dot. */
  radio: 20,
  radioDot: 10,
  /** Stroke of a radio ring. */
  border: 2,
  /** Switch track, the gap around its thumb, and the thumb (track height minus both gaps). */
  switchWidth: 40,
  switchHeight: 24,
  switchInset: 2,
  switchThumb: 20,
  /** The bar at the top of a bottom sheet that says "this can be dragged". */
  gripWidth: 36,
  gripHeight: 4,
  /** A thin progress track (the free-delivery bar in the cart summary). */
  trackHeight: 4,
  /** How far the cart badge hangs past the top and the end of its icon, so it reads as attached to it. */
  badgeOverlapY: 6,
  badgeOverlapX: 10,
} as const;
