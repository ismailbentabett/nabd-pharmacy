/**
 * The Nabd mark: a lime disc with a pulse line (one heartbeat) cut through it. "Nabd" (نبض) is
 * Arabic for "pulse". Same geometry as the launcher icon, which `scripts/brand/make-icons.py` draws
 * from these numbers (100-unit box): disc radius 40 centred at (50, 50), pulse stroke 7 with round
 * caps and joins, through the points in `PULSE` below.
 *
 * A logo is not mirrored in Arabic, so this ignores the layout direction. It is decorative: the
 * wordmark next to it carries the name for screen readers.
 */
import Svg, { Circle, Path } from 'react-native-svg';

import { useColors } from './theme';

/** The heartbeat: flat, a small rise, the sharp spike down and up, a recovery, flat again. */
export const PULSE: readonly (readonly [number, number])[] = [
  [21, 53],
  [35, 53],
  [41, 43],
  [47, 69],
  [56, 29],
  [63, 59],
  [67, 53],
  [79, 53],
];
export const PULSE_STROKE = 7;
export const DISC_RADIUS = 40;

const PULSE_PATH = PULSE.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

export type BrandMarkProps = {
  size: number;
  /** The colour behind the mark, used for the pulse cut-out. Defaults to the brand surface. */
  cutout?: string;
  /**
   * One colour for the disc instead of lime: the faint watermark inside loading skeletons, where
   * the bright mark would read as content rather than as a placeholder.
   */
  mono?: string;
};

export function BrandMark({ size, cutout, mono }: BrandMarkProps) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Circle cx={50} cy={50} r={DISC_RADIUS} fill={mono ?? c.accent} />
      <Path
        d={PULSE_PATH}
        stroke={cutout ?? c.bgBrand}
        strokeWidth={PULSE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
