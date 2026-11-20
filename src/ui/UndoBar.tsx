/**
 * A short-lived bar with one action, used for "Removed from cart · Undo" (K-02).
 *
 * How it works (walkthrough):
 * - `visible` drives it. Showing springs it up from 24 dp below while it fades in; hiding fades it
 *   down quickly (timingExit). Both run on the UI thread from one shared value, `shown`.
 * - The content stays mounted until the hide animation finishes (`present`), then unmounts: one JS
 *   call through `scheduleOnRN`. Mounting the content inside an always-mounted polite live region is
 *   what makes TalkBack read the message without stealing focus.
 * - A new `eventKey` while the bar is up (a second deletion) restarts the countdown, so it gets its
 *   own full window, and replays the show from half-hidden, so the eye sees the message change.
 *
 * Timing and screen readers (WCAG 2.2.1): with TalkBack or VoiceOver on, the bar does not dismiss by
 * itself; it stays until the action is used or a newer event replaces it, like Android's own
 * Snackbar does when touch exploration is on. Otherwise it waits `durationMs`, or longer if the user
 * set Android's "Time to take action" (`getRecommendedTimeoutMillis`).
 *
 * Reduced motion (G-09): no movement, only a 120 ms fade in and out.
 */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { MAX_FONT_SCALE, typeStyle } from '@/design/typography';
import { useMotionPreference } from '@/motion/motionPreference';
import { spatialDefault, timingExit, timingReducedFade } from '@/motion/springs';

/** The undo window from docs/CART_SPEC.md. */
export const DEFAULT_UNDO_MS = 5000;
/** One 48 dp action plus a little air: lists reserve this much room so nothing hides behind the bar. */
export const UNDO_BAR_HEIGHT = size.touch + 2 * space.xxs;
/**
 * The tallest the bar gets: a message that wraps to its two lines, in Arabic (the taller line height),
 * at the largest font scale we allow. Lists that must clear the bar reserve this.
 */
export const UNDO_BAR_MAX_HEIGHT = Math.max(
  UNDO_BAR_HEIGHT,
  2 * (typeStyle('ar', 'body').lineHeight ?? 0) * MAX_FONT_SCALE + 2 * space.xxs,
);
/** Where the bar rises from when it appears. */
const HIDE_OFFSET = 24;
/** Where a replay starts: half-faded and half-way down, then the show spring runs again. */
const REPLAY_FROM = 0.5;

export type UndoBarProps = {
  visible: boolean;
  message: string;
  actionLabel: string;
  /** What TalkBack adds after the action's label, e.g. "Puts the item back in your cart". */
  actionHint?: string;
  onAction: () => void;
  /** Called once when the window runs out without the action being used. */
  onTimeout: () => void;
  durationMs?: number;
  /** Changes when a newer event replaces the one on show, so the countdown starts again. */
  eventKey?: string;
  /** The action button gets `${testID}-action`. */
  testID?: string;
};

/** How long to wait before dismissing, or null for "never by itself" (screen reader on). */
async function resolveTimeout(base: number): Promise<number | null> {
  const screenReader = await AccessibilityInfo.isScreenReaderEnabled().catch(() => false);
  if (screenReader) return null;
  const recommended: unknown = await AccessibilityInfo.getRecommendedTimeoutMillis(base).catch(() => base);
  return typeof recommended === 'number' && recommended > base ? recommended : base;
}

export function UndoBar({
  visible,
  message,
  actionLabel,
  actionHint,
  onAction,
  onTimeout,
  durationMs = DEFAULT_UNDO_MS,
  eventKey,
  testID,
}: UndoBarProps) {
  const styles = useStyles();
  const reduceMotion = useMotionPreference();
  const shown = useSharedValue(0);
  const [present, setPresent] = useState(visible);
  // Mount the content in the same render that shows it, so the show animation has something to move.
  if (visible && !present) setPresent(true);

  // The event the bar is showing now; undefined while hidden. Read and written only in the effect.
  const shownKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (visible) {
      const replay = shownKey.current !== undefined && shownKey.current !== eventKey;
      shownKey.current = eventKey;
      if (replay) shown.set(REPLAY_FROM);
      shown.set(reduceMotion ? withTiming(1, timingReducedFade) : withSpring(1, spatialDefault));
      return;
    }
    shownKey.current = undefined;
    shown.set(
      withTiming(0, reduceMotion ? timingReducedFade : timingExit, (finished) => {
        // Not finished means a newer event showed the bar again mid-hide: keep it mounted.
        if (finished) scheduleOnRN(setPresent, false);
      }),
    );
  }, [visible, eventKey, reduceMotion, shown]);

  const timeout = useEffectEvent(() => onTimeout());

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void resolveTimeout(durationMs).then((ms) => {
      if (cancelled || ms === null) return;
      timer = setTimeout(() => timeout(), ms);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [visible, eventKey, durationMs]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - shown.get()) * HIDE_OFFSET }],
  }));

  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={visible ? styles.live : styles.inert}>
      {present ? (
        <Animated.View style={[styles.bar, barStyle]}>
          <Text variant="body" tone="onBrand" numberOfLines={2} style={styles.message}>
            {message}
          </Text>
          <PressableScale
            onPress={onAction}
            accessibilityLabel={actionLabel}
            accessibilityHint={actionHint}
            testID={testID ? `${testID}-action` : undefined}
            style={styles.action}
          >
            <View style={styles.pill}>
              <Text variant="label" weight="semibold" tone="onAccent" numberOfLines={1}>
                {actionLabel}
              </Text>
            </View>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  live: { pointerEvents: 'box-none' },
  // Fading out: touches pass through to the list underneath.
  inert: { pointerEvents: 'none' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
    minHeight: UNDO_BAR_HEIGHT,
    paddingStart: space.md,
    paddingEnd: space.xxs,
    paddingVertical: space.xxs,
    borderRadius: radius.button,
    // The palette's dark ink (pine in light mode, black in dark): the bar reads as "on top of" the page.
    backgroundColor: c.scrim,
  },
  message: { flex: 1 },
  action: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxs },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
}));
