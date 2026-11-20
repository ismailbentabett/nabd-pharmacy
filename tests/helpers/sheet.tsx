/**
 * A bottom sheet under test, shared by bottomSheet.test.tsx and bottomSheetDrag.test.tsx.
 *
 * Reanimated's Jest mock finishes every animation at once and calls its callback straight away, so
 * the tests check which animation starts and where it ends, not the frames in between. A worklet
 * keeps the functions it was created with, so `spyOnMotion` goes in before the render. Animated
 * styles are read only when the component renders, so a test re-renders to see them.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { haptics } from '@/motion/haptics';
import { BottomSheet, sheetPartIds } from '@/ui/BottomSheet';
import { DRAG_SLOP } from '@/ui/bottomSheetMath';

import { METRICS } from './category';
import { renderWithProviders } from './render';

export const SHEET = 'test-sheet';
export const ids = sheetPartIds(SHEET);
export const SHEET_HEIGHT = 500;

export function spyOnMotion() {
  return {
    withSpring: jest.spyOn(Reanimated, 'withSpring'),
    withTiming: jest.spyOn(Reanimated, 'withTiming'),
    cancelAnimation: jest.spyOn(Reanimated, 'cancelAnimation'),
    confirm: jest.spyOn(haptics, 'confirm'),
  };
}

export function Sheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <BottomSheet open={open} onClose={onClose} title="Filters" accessibilityLabel="Filters" testID={SHEET}>
          <Text>Body</Text>
        </BottomSheet>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Let work handed to the UI runtime (scheduleOnUI) and back to React (scheduleOnRN) run. */
export async function flushFrames() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

/** The sheet only moves once it knows its height, which arrives with its first layout. */
export async function measure() {
  await fireEvent(screen.getByTestId(ids.panel, { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: SHEET_HEIGHT } },
  });
  await flushFrames();
}

/** Opens a sheet, lets it settle, and renders once more so its animated styles are current. */
export async function renderOpenSheet(onClose: () => void) {
  const result = await renderWithProviders(<Sheet open onClose={onClose} />);
  await measure();
  await result.rerender(<Sheet open onClose={onClose} />);
  return result;
}

export function backdropOpacityOnScreen(): unknown {
  return StyleSheet.flatten(screen.getByTestId(ids.backdrop, { includeHiddenElements: true }).props.style).opacity;
}

/** Drags the handle (or the body) by `distance` px after the slop and lets go at `velocity` px/s. */
export function drag(distance: number, velocity: number, part: 'handle' | 'body' = 'handle') {
  const pan = createGestureController(ids[part]);
  pan.begin({ translationY: 0 });
  pan.activate({ translationY: DRAG_SLOP });
  pan.update({ translationY: DRAG_SLOP + distance, velocityY: velocity });
  pan.end({ translationY: DRAG_SLOP + distance, velocityY: velocity });
}
