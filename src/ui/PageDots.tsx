/**
 * The page indicator for the banner carousel (H-02) and the product gallery (P-02).
 *
 * Static dots mark the pages; one pill slides between them, driven by `progress` (the fractional page
 * index, e.g. 1.4 while the user drags from page 1 to 2). The pill follows the finger because
 * `progress` is a shared value the gesture writes on the UI thread: translateX only, no React render
 * per frame (F-02). Transforms do not mirror in RTL, so the distance is multiplied by `dir`.
 *
 * Decorative for TalkBack: the pager that owns it announces "Image 2 of 5" itself.
 */
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { makeStyles } from '@/design/theme';
import { radius } from '@/design/tokens';
import { useDirection } from '@/i18n/direction';

export const DOT = 6;
export const DOT_GAP = 8;
export const PILL = 18;
/** Distance between two dot centres: how far the pill travels per page. */
export const DOT_STEP = DOT + DOT_GAP;
/** Padding at each end so the wider pill is never clipped over the first or last dot. */
const INSET = (PILL - DOT) / 2;

export type PageDotsProps = {
  count: number;
  /** Fractional current page, 0 … count − 1. */
  progress: SharedValue<number>;
  /** `onBrand` on the dark banners, `default` on light surfaces. */
  tone?: 'default' | 'onBrand';
  testID?: string;
};

export function PageDots({ count, progress, tone = 'default', testID }: PageDotsProps) {
  const styles = useStyles();
  const { dir } = useDirection();
  const onBrand = tone === 'onBrand';

  const pillStyle = useAnimatedStyle(() => {
    const page = Math.min(Math.max(progress.get(), 0), Math.max(count - 1, 0));
    return { transform: [{ translateX: dir * page * DOT_STEP }] };
  });

  if (count < 2) return null;

  return (
    <View
      testID={testID}
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={`dot-${i}`} style={[styles.dot, onBrand ? styles.dotOnBrand : styles.dotDefault]} />
      ))}
      <Animated.View
        testID={testID ? `${testID}-pill` : undefined}
        style={[styles.pill, onBrand ? styles.pillOnBrand : styles.pillDefault, pillStyle]}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: DOT_GAP, paddingHorizontal: INSET, height: DOT * 2 },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, opacity: 0.35 },
  dotDefault: { backgroundColor: c.textPrimary },
  dotOnBrand: { backgroundColor: c.textOnBrand },
  pill: { position: 'absolute', start: 0, width: PILL, height: DOT, borderRadius: radius.pill },
  pillDefault: { backgroundColor: c.textPrimary },
  pillOnBrand: { backgroundColor: c.textOnBrand },
}));
