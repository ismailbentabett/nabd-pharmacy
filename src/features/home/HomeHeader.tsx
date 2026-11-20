/**
 * How it works: the collapsing Home header (H-01).
 *
 * 1. The header floats over the scroll view with a fixed height, and the content is padded by that
 *    height, so nothing jumps on the first frame and no height is ever animated.
 * 2. HomeScreen writes the scroll offset into `scrollY` on the UI thread. Three styles read it here:
 *    the header slides up by the greeting row (translateY), the greeting fades out before it reaches
 *    the status bar (opacity), and the search field's white surface shrinks from 48 to 44 dp tall
 *    (scaleY on a background layer only). The field's box, its icon and its text never scale, so its
 *    start and end edges stay on the 16 dp gutter in both directions and the touch target stays 48 dp.
 *    All three are clamped interpolations, so overscroll and long scrolls never push them past their
 *    end states.
 * 3. The language toggle sits next to the search field, not in the greeting row, so it stays on the
 *    compact bar and is always one tap away (G-08).
 * 4. Collapsing is one discrete event: when the header passes halfway, the faded greeting leaves the
 *    screen reader, so TalkBack never reads text nobody can see. One scheduled state change, not one
 *    per frame. (The greeting has no touch handler, so there is nothing to switch off for touches.)
 * 5. The snap to fully open or fully compact on release lives in HomeScreen, next to the scroll view.
 *
 * Reduced motion: the header still follows the finger (motion the user drives), nothing else moves.
 * RTL: the rows are flex rows, so the greeting and the field start at the reading start and the
 * toggle sits at the reading end.
 */
import { MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { BrandMark } from '@/design/BrandMark';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { testIds } from '@/testIds';
import { LanguageToggle } from '@/ui/LanguageToggle';

import {
  collapseProgress,
  COLLAPSE_DISTANCE,
  COMPACT_SCALE,
  expandedHeaderHeight,
  GREETING_FADE_END,
  HEADER,
  isCollapsed,
} from './headerMath';
import { openSearch } from './homeRoutes';

const SMALL_ICON = 16;
const SEARCH_ICON = 20;
/** The mark fills most of the 32 dp greeting row. */
const BRAND_MARK = 28;

export type HomeHeaderProps = {
  /** Vertical scroll offset of the Home content, written on the UI thread. */
  scrollY: SharedValue<number>;
};

export function HomeHeader({ scrollY }: HomeHeaderProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);

  useAnimatedReaction(
    () => isCollapsed(scrollY.get()),
    (now, before) => {
      if (now !== before) scheduleOnRN(setCollapsed, now);
    },
  );

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -COLLAPSE_DISTANCE * collapseProgress(scrollY.get()) }],
  }));
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapseProgress(scrollY.get()), [0, GREETING_FADE_END], [1, 0], Extrapolation.CLAMP),
  }));
  // Only the surface layer shrinks, about its own centre: the edges stay on the gutter.
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: interpolate(collapseProgress(scrollY.get()), [0, 1], [1, COMPACT_SCALE], Extrapolation.CLAMP) },
    ],
  }));


  return (
    <Animated.View
      style={[styles.header, { height: expandedHeaderHeight(insets.top), paddingTop: insets.top + HEADER.padTop }, headerStyle]}
    >
      <Animated.View
        style={[styles.greeting, greetingStyle]}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'yes'}
        accessibilityElementsHidden={collapsed}
      >
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel={t('app.name')}>
          <BrandMark size={BRAND_MARK} />
          <Text variant="label" weight="semibold" tone="onBrand" numberOfLines={1}>
            {t('app.name')}
          </Text>
        </View>
        <View
          style={styles.location}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${t('home.greeting')} ${t('home.location')}`}
        >
          <MapPin size={SMALL_ICON} color={c.textOnBrandMuted} strokeWidth={size.iconStroke} />
          <Text variant="caption" tone="onBrandMuted" numberOfLines={1} style={styles.shrink}>
            {t('home.greeting')}
          </Text>
          <Text variant="label" weight="semibold" tone="onBrand" numberOfLines={1} style={styles.shrink}>
            {t('home.location')}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.searchRow}>
        <View style={styles.fieldBox}>
          <PressableScale
            testID={testIds.homeSearch}
            onPress={openSearch}
            accessibilityRole="button"
            accessibilityLabel={t('home.search')}
            style={styles.field}
          >
            <Animated.View
              testID={`${testIds.homeSearch}-surface`}
              pointerEvents="none"
              style={[styles.fieldSurface, surfaceStyle]}
            />
            {/* In a View so it paints above the absolute surface on web too (a bare <svg> paints under it). */}
            <View>
              <Search size={SEARCH_ICON} color={c.textMuted} strokeWidth={size.iconStroke} />
            </View>
            <Text variant="body" tone="muted" numberOfLines={1} style={styles.placeholder}>
              {t('home.search')}
            </Text>
          </PressableScale>
        </View>
        <LanguageToggle />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 1,
    paddingHorizontal: layout.gutter,
    backgroundColor: c.bgBrand,
  },
  greeting: {
    height: HEADER.row,
    marginBottom: HEADER.gap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space.sm,
  },
  // Mark and name at the reading start, "Deliver to Algiers" at the reading end (flex row: mirrors in RTL).
  brand: { flexDirection: 'row', alignItems: 'center', columnGap: space.xs },
  location: { flexDirection: 'row', alignItems: 'center', columnGap: space.xxs, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  searchRow: { height: HEADER.field, flexDirection: 'row', alignItems: 'center', columnGap: space.xs },
  fieldBox: { flex: 1 },
  field: {
    height: HEADER.field,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
    paddingHorizontal: space.sm,
  },
  // The field's white surface, drawn behind the icon and the text. Logical insets: it fills the field
  // in both directions.
  fieldSurface: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    borderRadius: radius.button,
    backgroundColor: c.bgSurface,
  },
  placeholder: { flex: 1 },
}));
