/**
 * How it works: the Home screen (H-01 to H-04).
 *
 * 1. One vertical scroll view holds the banner carousel, the category rail and the best sellers.
 *    The collapsing header floats above it; the content is padded by the header's full height.
 * 2. The scroll handler runs on the UI thread. Every frame it only copies the offset into `scrollY`,
 *    which the header reads in its animated styles: no React render while scrolling (F-02).
 * 3. Settling: when a drag or a fling ends with the header half-collapsed, the content is scrolled
 *    (on the UI thread, `scrollTo`) to whichever state is nearer, fully open or fully compact. A new
 *    drag stops that scroll natively, so the snap never fights the finger. A release further down the
 *    page is left alone.
 * 4. The splash screen is hidden on the first layout of this screen, so the first thing the user sees
 *    is a usable Home, not a blank frame (F-07).
 *
 * Reduced motion: no settling scroll; the header simply stays where the finger left it.
 * RTL: nothing here is directional; each section mirrors itself.
 */
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import Animated, { scrollTo, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '@/design/theme';
import { space } from '@/design/tokens';
import { useMotionPreference } from '@/motion/motionPreference';
import { testIds } from '@/testIds';
import { onFirstScreenLayout } from '@/ui/LaunchVeil';

import { BannerCarousel } from './BannerCarousel';
import { BestSellersRail } from './BestSellersRail';
import { CategoryRail } from './CategoryRail';
import { HomeHeader } from './HomeHeader';
import { expandedHeaderHeight, headerSnapTarget } from './headerMath';

/**
 * Release speed (points per millisecond, as React Native reports it) below which a drag counts as
 * let go at rest. iOS sends no momentum events then, so the settle has to start from the drag end.
 */
const RELEASE_AT_REST = 0.05;

/** The pine header needs light status bar icons; other screens get the automatic style back. */
function lightStatusBarWhileFocused() {
  StatusBar.setStyle('light');
  return () => StatusBar.setStyle('auto');
}

export function HomeScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);

  useFocusEffect(lightStatusBarWhileFocused);

  const settleHeader = (y: number) => {
    'worklet';
    if (reduceMotion) return;
    const target = headerSnapTarget(y);
    if (target !== null) scrollTo(scrollRef, 0, target, true);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
    onEndDrag: (event) => {
      if (Math.abs(event.velocity?.y ?? 0) < RELEASE_AT_REST) settleHeader(event.contentOffset.y);
    },
    onMomentumEnd: (event) => {
      settleHeader(event.contentOffset.y);
    },
  });

  return (
    <View testID={testIds.screen.home} style={styles.root} onLayout={onFirstScreenLayout}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: expandedHeaderHeight(insets.top) + space.md }]}
      >
        <BannerCarousel />
        <CategoryRail />
        <BestSellersRail />
      </Animated.ScrollView>
      <HomeHeader scrollY={scrollY} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgApp },
  content: { rowGap: space.xl, paddingBottom: space.xl },
}));
