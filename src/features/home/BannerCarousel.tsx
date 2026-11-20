/**
 * How it works: the banner carousel (H-02).
 *
 * 1. The pages sit side by side in one row; a single translateX (`x`) on the row picks the page. A
 *    transform pager, not a paging ScrollView, so the finger, autoplay and the dots share one value
 *    and Arabic needs no special scroll offsets: `pageOffset` folds `dir` in (G-08).
 * 2. Autoplay is one JS timeout per page, so nothing runs between page turns (no per-frame clock).
 *    When it fires it asks the UI thread to spring the row to the next page (after the last, back to
 *    the first). React hears the new page once (for TalkBack), and that arms the next timeout. Any
 *    change to the page or to `shouldAutoplay` clears the pending timeout: every start gets a full 4 s.
 * 3. A finger down stops any running spring where it is (interruptible) and pauses autoplay. The UI
 *    thread marks `fingerDown` at once, so a timeout that fires a moment later does nothing, and React
 *    hears "touched" once at touch down and once at lift, which clears and re-arms the timeout. The row
 *    follows the finger, with resistance past the first and last page. On release the velocity is
 *    projected forward to choose the page (one page at most) and seeds the spring, so the settle
 *    continues the flick. Lifting the finger restarts the 4 s count.
 * 4. Autoplay is off when Home is not the visible tab, while the app is in the background, with one
 *    page, while a screen reader is on, and under reduce motion (ADR-025).
 * 5. Every place that chooses the page the row rests on also tells React, so the page React knows
 *    (TalkBack's "Promotion 2 of 4", the timeout's key) never drifts from the row on screen.
 *
 * Reduced motion: no autoplay; a swipe still works and settles with a short linear slide, no bounce.
 * RTL: the row mirrors, pages advance towards the reading end, and the dots follow `dir`.
 * Screen readers: the carousel is one "adjustable" element: swipe up/down changes the promotion,
 * double tap opens it, and it announces "Promotion 2 of 4".
 */
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { BANNERS } from '@/core/catalog';
import { makeStyles } from '@/design/theme';
import { layout, space } from '@/design/tokens';
import { useDirection } from '@/i18n/direction';
import { useT } from '@/i18n/useT';
import { clamp, pageIndexFromOffset, pageOffset, rubberBand } from '@/motion/gestureMath';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { spatialDefault, spatialSlow, timingReducedFade } from '@/motion/springs';
import { testIds } from '@/testIds';
import { PageDots } from '@/ui/PageDots';

import { BannerCard } from './BannerCard';
import { AUTOPLAY_MS, autoplayTarget, pageAt, releasePage, shouldAutoplay } from './carouselMath';
import { openCategory } from './homeRoutes';
import { useAppActive } from './useAppActive';
import { useScreenReaderEnabled } from './useScreenReaderEnabled';

/** Horizontal travel before the swipe takes over; vertical travel first lets the page scroll. */
const ACTIVATE_PX = 12;
const ACTIONS = [{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }] as const;

/** The swipe's testID: the gesture tests touch and release the banner through it. */
export const bannerPanTestId = `${testIds.homeBanner}-pan`;

export function BannerCarousel() {
  const styles = useStyles();
  const { t, lang } = useT();
  const { dir } = useDirection();
  const { width } = useWindowDimensions();
  const reduceMotion = useMotionPreference();
  const screenReader = useScreenReaderEnabled();
  const appActive = useAppActive();
  const focused = useIsFocused();
  const count = BANNERS.length;
  const lastOffset = pageOffset(count - 1, width, dir);
  const minOffset = Math.min(0, lastOffset);
  const maxOffset = Math.max(0, lastOffset);

  // The page TalkBack announces and the autoplay timeout is keyed on. Set only when a page is chosen.
  const [page, setPage] = useState(0);
  // A finger is on the banner. Set at touch down and at lift, never per frame.
  const [touched, setTouched] = useState(false);
  const x = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const dragStartPage = useSharedValue(0);
  const activationX = useSharedValue(0);
  const dragging = useSharedValue(false);
  // The UI thread's own copy of `touched`: it is true from the first touch frame, before React knows.
  const fingerDown = useSharedValue(false);

  const autoplay = shouldAutoplay({ reduceMotion, screenReader, focused, appActive, touched, count });
  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = setTimeout(() => {
      scheduleOnUI(() => {
        'worklet';
        // The timeout fired on the JS thread; a finger may have landed since. The touch wins.
        if (fingerDown.get()) return;
        const target = autoplayTarget(x.get(), width, dir, count);
        x.set(withSpring(pageOffset(target, width, dir), spatialSlow));
        scheduleOnRN(setPage, target);
      });
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [autoplay, page, width, dir, count, x, fingerDown]);

  // The app is portrait-only, but split screen and foldables still change the width, and the language
  // toggle flips the direction: keep the same page in view. The page is read back with the width and
  // direction the row was placed with, then placed again with the new ones. Runs on the UI thread,
  // where the row's position lives.
  const placedWidth = useSharedValue(width);
  const placedDir = useSharedValue<1 | -1>(dir);
  useEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      const shown = clamp(pageAt(x.get(), placedWidth.get(), placedDir.get()), 0, count - 1);
      placedWidth.set(width);
      placedDir.set(dir);
      cancelAnimation(x);
      x.set(pageOffset(shown, width, dir));
      scheduleOnRN(setPage, shown);
    });
  }, [width, dir, count, x, placedWidth, placedDir]);

  const pan = usePanGesture({
    activeOffsetX: [-ACTIVATE_PX, ACTIVATE_PX],
    failOffsetY: [-ACTIVATE_PX, ACTIVATE_PX],
    enabled: count > 1,
    testID: bannerPanTestId,
    onBegin: () => {
      fingerDown.set(true);
      scheduleOnRN(setTouched, true);
      cancelAnimation(x);
      dragStartX.set(x.get());
      dragStartPage.set(pageAt(x.get(), width, dir));
    },
    onActivate: (e) => {
      dragging.set(true);
      // The swipe starts where the finger is now, so the row does not jump by the 12 px slop.
      activationX.set(e.translationX);
    },
    onUpdate: (e) => {
      x.set(rubberBand(dragStartX.get() + e.translationX - activationX.get(), minOffset, maxOffset));
    },
    onDeactivate: (e) => {
      const from = dragStartPage.get();
      const target = releasePage(from, x.get(), e.velocityX, width, count, dir);
      const to = pageOffset(target, width, dir);
      x.set(reduceMotion ? withTiming(to, timingReducedFade) : withSpring(to, { ...spatialDefault, velocity: e.velocityX }));
      // Even "back to where the drag started" is told: the finger may have caught an autoplay slide
      // that React had already counted as the next page.
      scheduleOnRN(setPage, target);
      if (target !== from) scheduleOnRN(haptics.tap);
    },
    onFinalize: () => {
      // A touch that never became a swipe (a tap, a vertical scroll) may have stopped an autoplay
      // slide halfway: finish it on the nearest page.
      if (!dragging.get()) {
        const settle = clamp(pageAt(x.get(), width, dir), 0, count - 1);
        x.set(withSpring(pageOffset(settle, width, dir), spatialDefault));
        scheduleOnRN(setPage, settle);
      }
      dragging.set(false);
      fingerDown.set(false);
      scheduleOnRN(setTouched, false);
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const progress = useDerivedValue(() => pageIndexFromOffset(x.get(), width, dir));

  const goTo = (target: number) => {
    const next = clamp(target, 0, count - 1);
    const to = pageOffset(next, width, dir);
    x.set(reduceMotion ? to : withSpring(to, spatialDefault));
    setPage(next);
  };

  const current = BANNERS[page];
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const action = event.nativeEvent.actionName;
    if (action === 'increment') goTo(page + 1);
    else if (action === 'decrement') goTo(page - 1);
    else if (action === 'activate' && current) openCategory(current.category);
  };

  if (!current) return null;

  return (
    <View
      testID={testIds.homeBanner}
      style={styles.carousel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${current[lang].title}. ${current[lang].sub}`}
      accessibilityValue={{ text: t('a11y.banner', { i: page + 1, n: count }) }}
      accessibilityActions={ACTIONS}
      onAccessibilityAction={onAccessibilityAction}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.row, { width: width * count }, rowStyle]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {BANNERS.map((banner, index) => (
            <BannerCard key={banner.id} banner={banner} index={index} pageWidth={width} />
          ))}
        </Animated.View>
      </GestureDetector>
      <View style={styles.dots} pointerEvents="none">
        <PageDots count={count} progress={progress} tone="onBrand" testID={`${testIds.homeBanner}-dots`} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  carousel: { overflow: 'hidden' },
  // flex-start keeps the over-wide row anchored at the reading start: page 0 is on screen in both
  // directions, and the row mirrors with the layout.
  row: { flexDirection: 'row', alignSelf: 'flex-start' },
  dots: { position: 'absolute', bottom: space.md, end: layout.gutter + space.md + space.xs },
}));
