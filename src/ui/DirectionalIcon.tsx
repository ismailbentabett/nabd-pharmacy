/**
 * The one way to draw a glyph whose meaning depends on the reading direction: chevrons, arrows,
 * Back (G-08, DESIGN §4).
 *
 * - Pass the glyph as it should look in English (Back = ChevronLeft, "See all" = ChevronRight).
 *   In Arabic the same glyph is flipped about its own centre, so it points the other way.
 * - Mirroring one glyph, instead of swapping it for its opposite, works for any icon (an arrow
 *   with a tail, an undo curl) and leaves one code path, so the two languages cannot drift.
 * - The style is static per language (the direction only changes on a reload), not an animation.
 * - Decorative: it carries no label or role. The pressable around it says what it does.
 */
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useDirection } from '@/i18n/direction';

const MIRRORED = { transform: [{ scaleX: -1 }] } as const;

export type DirectionalIconProps = {
  /** The lucide glyph, drawn pointing the English way. */
  icon: LucideIcon;
  size: number;
  color: string;
};

export function DirectionalIcon({ icon: Icon, size, color }: DirectionalIconProps) {
  const { isRTL } = useDirection();
  return (
    <View style={isRTL ? MIRRORED : undefined}>
      <Icon size={size} color={color} />
    </View>
  );
}
