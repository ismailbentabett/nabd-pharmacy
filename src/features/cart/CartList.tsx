/**
 * The cart lines (K-01). A plain ScrollView, not a virtualised list: a cart holds a handful of
 * lines, and Reanimated layout animations need every row mounted (they are banned inside FlashList).
 *
 * How it works (walkthrough):
 * - Each line sits in an Animated.View keyed by product id, carrying three layout animations from
 *   ./cartMotion that run on the UI thread, outside React:
 *   - entering: fade in and rise 12 dp. On the cart's first mount the rows stagger by STAGGER_MS
 *     (at most STAGGER_MAX_ITEMS deep); a line added or restored later just enters.
 *   - exiting: fade out with a slight shrink while the row leaves.
 *   - layout: the rows below spring from their old position to their new one, so the gap closes
 *     (and opens again on undo) smoothly, with the app's spatialDefault spring.
 * - "First mount" needs no flag: the store keeps the ids array identical until a line is added,
 *   removed or restored, so `ids === initialIds` is true exactly while the first rows mount.
 *
 * - The list owns `openRowId`, the id of the row touched last, so only one row is open at a time.
 *
 * Reduced motion (G-09): rows cross-fade in and out (timingReducedFade) and the gap closes at once.
 */
import { useState } from 'react';
import { Platform } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import { makeStyles } from '@/design/theme';
import { layout, space } from '@/design/tokens';
import { useMotionPreference } from '@/motion/motionPreference';
import { STAGGER_MAX_ITEMS } from '@/motion/springs';
import { UNDO_BAR_MAX_HEIGHT } from '@/ui/UndoBar';

import { enterNow, exitCollapse, reducedEnter, reducedExit, springToNewFrame, STAGGERED_ENTERING, webEnter, webExit, webLayout } from './cartMotion';

const WEB = Platform.OS === 'web';
import { CartRow } from './CartRow';

/**
 * Room under the last row so it can scroll clear of the undo bar that floats above the totals. Sized
 * for the bar's tallest case: a long product name wraps the message to two lines.
 */
const UNDO_ROOM = UNDO_BAR_MAX_HEIGHT + 2 * space.sm;

export function CartList({ ids }: { ids: readonly string[] }) {
  const styles = useStyles();
  const reduceMotion = useMotionPreference();
  const [initialIds] = useState(ids);
  const firstMount = ids === initialIds;
  // The row touched last. Each row closes itself when another one is touched (useSwipeToDelete).
  const openRowId = useSharedValue('');

  const enteringFor = (index: number) => {
    if (reduceMotion) return reducedEnter;
    if (WEB) return webEnter;
    if (!firstMount) return enterNow;
    return STAGGERED_ENTERING[Math.min(index, STAGGER_MAX_ITEMS - 1)] ?? enterNow;
  };

  return (
    <Animated.ScrollView contentContainerStyle={styles.content}>
      {ids.map((id, index) => (
        <Animated.View
          key={id}
          entering={enteringFor(index)}
          exiting={reduceMotion ? reducedExit : WEB ? webExit : exitCollapse}
          layout={reduceMotion ? undefined : WEB ? webLayout : springToNewFrame}
        >
          <CartRow id={id} openRowId={openRowId} />
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.xs,
    paddingBottom: UNDO_ROOM,
    rowGap: space.sm,
  },
}));
