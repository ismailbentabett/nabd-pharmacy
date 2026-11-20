/**
 * A bottom sheet that follows the finger and snaps open or closed (C-03). How it works:
 * - One number moves it: `y`, its translateY on the UI thread (0 = open, its own height = closed). The
 *   backdrop's opacity is computed from the same `y`. Nothing re-renders per frame (F-02).
 * - The handle and title bar drag it. So does a downward drag on the body while the body is scrolled
 *   to the top; otherwise the body scrolls (the hand-off is in useSheetDrag). Touch down cancels any
 *   running spring and catches the sheet where it is, even mid-bounce above open (`fingerOrigin`: no
 *   jump); it then moves 1:1 with the finger and resists above open. On release it goes where the
 *   throw would carry it (`projectEnd`): the nearer of open or closed, on a spring that starts at the
 *   sheet's own speed (`releaseVelocity`).
 * - A drag that ends closed reports `onClose` once the sheet is at rest, so grabbing it on the way
 *   down cancels the close. Back, Close, backdrop and escape ask the parent; `open` then animates it.
 * Mounted at the first open, then kept below the screen, shut to touches and screen readers.
 * Reduced motion (G-09): open/close become a 120 ms fade; a drag still follows the finger, a release
 * to open is instant and a release to closed fades out. RTL (G-08): vertical, so the same both ways.
 */
import { useIsFocused } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useEffectEvent, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import { GestureDetector, ScrollView, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { control, radius, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { useMotionPreference } from '@/motion/motionPreference';
import { spatialDefault, timingReducedFade } from '@/motion/springs';

import { backdropOpacity, bottomInsetOverlap, isHidden, MAX_HEIGHT, SKIRT_HEIGHT } from './bottomSheetMath';
import { moveA11yFocus } from './moveA11yFocus';
import { useBackToClose } from './useBackToClose';
import { useSheetDrag } from './useSheetDrag';

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void; // must set `open` to false; called once per open, however it was closed
  accessibilityLabel: string;
  title?: string;
  footer?: ReactNode; // pinned under the scrolling body (e.g. Reset / Apply)
  children: ReactNode;
  testID?: string;
};

/** The testIDs of a sheet's parts, derived from its own testID. */
export function sheetPartIds(testID: string) {
  return { backdrop: `${testID}-backdrop`, panel: `${testID}-panel`, handle: `${testID}-handle`, body: `${testID}-body`, close: `${testID}-close` };
}

/** The one shadow the design allows (DESIGN §3), on the one surface that floats over the screen. */
const PANEL_ELEVATION = 12;

/** "activate" is a screen reader's double tap (Android: ACTION_CLICK), so the backdrop can be used without a finger tap. */
const BACKDROP_ACTIONS: readonly AccessibilityActionInfo[] = [{ name: 'activate' }];

export function BottomSheet({ open, onClose, accessibilityLabel, title, footer, children, testID = 'bottom-sheet' }: BottomSheetProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const ids = sheetPartIds(testID);
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useMotionPreference();
  // The tab bar stays usable under an open sheet, so the screen can lose focus with the sheet open.
  const focused = useIsFocused();

  // Nothing until the first open, then kept (adjusting state during render: redone before drawing).
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  // Pad for the navigation bar only if this area reaches it (not when a tab bar below already does).
  const [areaBottom, setAreaBottom] = useState<number | null>(null);
  const paddingBottom = areaBottom === null ? insets.bottom : bottomInsetOverlap(insets.bottom, frame.y + frame.height, areaBottom);

  const y = useSharedValue(windowHeight); // below the screen until the sheet is measured
  const height = useSharedValue(0);
  const wantOpen = useSharedValue(false);
  const fade = useSharedValue(1);

  const areaRef = useRef<ComponentRef<typeof View>>(null);
  const titleRef = useRef<ComponentRef<typeof View>>(null);
  const closeSent = useRef(false);

  // Every way of closing ends here; only the first call per open reaches the parent.
  const requestClose = () => {
    if (closeSent.current) return;
    closeSent.current = true;
    onClose();
  };

  // Screen readers start on the title, which also says what just opened.
  const onOpened = () => {
    if (title && titleRef.current) moveA11yFocus(titleRef.current);
    else AccessibilityInfo.announceForAccessibility(accessibilityLabel);
  };

  // Moves the sheet to open or closed; `velocity` (px/s) carries a throw into the spring. `fromDrag`:
  // the person chose, so a finished close is reported (a prop change needs no report).
  const settle = (toOpen: boolean, velocity: number, fromDrag: boolean) => {
    'worklet';
    wantOpen.set(toOpen);
    const h = height.get();
    if (h <= 0) return; // not measured yet: placeHeight starts the opening
    const opened = (done?: boolean) => {
      'worklet';
      if (done && !fromDrag) scheduleOnRN(onOpened);
    };
    const closed = (done?: boolean) => {
      'worklet';
      if (done && fromDrag) scheduleOnRN(requestClose);
    };
    if (reduceMotion && toOpen) {
      if (isHidden(y.get(), h)) fade.set(0);
      cancelAnimation(y);
      y.set(0);
      fade.set(withTiming(1, timingReducedFade, opened));
    } else if (reduceMotion) {
      fade.set(withTiming(0, timingReducedFade, (done) => {
        if (!done) return;
        y.set(h); // park it out of sight, then undo the fade for the next open
        fade.set(1);
        closed(done);
      }));
    } else {
      fade.set(1);
      // Below closed there is nothing to see, so a closing spring stops the moment it arrives.
      y.set(withSpring(toOpen ? 0 : h, { ...spatialDefault, velocity, overshootClamping: !toOpen }, toOpen ? opened : closed));
    }
  };

  const placeHeight = (next: number) => {
    'worklet';
    const before = height.get();
    if (next === before) return;
    height.set(next);
    if (!wantOpen.get()) {
      cancelAnimation(y);
      y.set(next); // closed means "exactly its own height down"
    } else if (before <= 0) {
      y.set(next);
      settle(true, 0, false); // first measurement of a sheet that is opening
    }
  };

  // Only a change of `open` moves the sheet; a re-render with the same value must not restart it.
  // Effect events read this render's props without being dependencies (and without a lint override,
  // which would also make the React Compiler skip this component).
  const onOpenChange = useEffectEvent((isOpen: boolean) => {
    if (isOpen) closeSent.current = false;
    scheduleOnUI(settle, isOpen, 0, false);
  });
  useEffect(() => onOpenChange(open), [open]);

  // Android back closes the sheet first: only while it is open and its screen is the one showing.
  useBackToClose(open && focused, requestClose);

  const { headerPan, bodyPan, scrollRef } = useSheetDrag({ y, height, fade, wantOpen, settle }, ids);

  const backdropTap = useTapGesture({
    testID: ids.backdrop,
    onActivate: () => scheduleOnRN(requestClose),
  });

  const onBackdropAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate') requestClose();
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity(y.get(), height.get(), fade.get()) }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: y.get() }] }));

  return (
    <View
      ref={areaRef}
      testID={testID}
      style={styles.area}
      onLayout={() => areaRef.current?.measureInWindow((_x, top, _w, h) => setAreaBottom(top + h))}
      pointerEvents={open ? 'box-none' : 'none'}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!open}
    >
      {mounted ? (
        <>
          <GestureDetector gesture={backdropTap}>
            <Animated.View
              testID={ids.backdrop}
              style={[styles.backdrop, backdropStyle]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('sheet.dismiss', { name: accessibilityLabel })}
              accessibilityActions={BACKDROP_ACTIONS}
              onAccessibilityAction={onBackdropAction}
            />
          </GestureDetector>
          <Animated.View
            testID={ids.panel}
            style={[styles.panel, { paddingBottom }, panelStyle]}
            onLayout={(e) => scheduleOnUI(placeHeight, e.nativeEvent.layout.height)}
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onAccessibilityEscape={requestClose}
          >
            <View style={styles.skirt} pointerEvents="none" />
            <GestureDetector gesture={headerPan}>
              <View style={styles.header}>
                <View style={styles.grip} />
                <View style={styles.titleRow}>
                  <View ref={titleRef} style={styles.title} accessible={Boolean(title)} accessibilityRole="header">
                    {title ? <Text variant="heading">{title}</Text> : null}
                  </View>
                  <PressableScale onPress={requestClose} accessibilityLabel={t('sheet.close')} testID={ids.close} style={styles.close}>
                    <X size={size.icon} color={c.textPrimary} strokeWidth={size.iconStroke} />
                  </PressableScale>
                </View>
              </View>
            </GestureDetector>
            <GestureDetector gesture={bodyPan}>
              {/* Waits for the body drag to fail before it scrolls (see useSheetDrag). */}
              <ScrollView ref={scrollRef} requireToFail={bodyPan} scrollEventThrottle={16} style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false} overScrollMode="never">
                {children}
              </ScrollView>
            </GestureDetector>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  area: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
  panel: { maxHeight: MAX_HEIGHT, backgroundColor: c.bgSurface, borderTopStartRadius: radius.sheet, borderTopEndRadius: radius.sheet, elevation: PANEL_ELEVATION },
  // Hangs below the sheet, so neither a pull above open nor a hard throw's bounce shows a gap at the bottom.
  skirt: { position: 'absolute', top: '100%', start: 0, end: 0, height: SKIRT_HEIGHT, backgroundColor: c.bgSurface },
  header: { paddingTop: space.xs, paddingHorizontal: space.md },
  grip: { alignSelf: 'center', width: control.gripWidth, height: control.gripHeight, borderRadius: radius.pill, backgroundColor: c.lineStrong },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: size.touch, gap: space.xs },
  title: { flex: 1 },
  close: { alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: space.md, paddingBottom: space.md },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: size.hairline, borderTopColor: c.lineHairline },
}));
