/**
 * The two finger-driven ways back from the product page (P-01, F-04, G-08; ADR-046). Both drive the same
 * `progress` as the Back button, so a swipe can catch the opening transition mid-flight, scrub it
 * either way and let go: it continues with the finger's speed (useHeroTransition: grab, drag,
 * release, letGo).
 *
 * - Back swipe: on the page body below the gallery (description, details), a horizontal drag
 *   towards the reading END closes the page: right in English, left in Arabic. Every horizontal
 *   number is multiplied by `dir`, so Arabic mirrors exactly. A drag towards the start fails at
 *   once, and so does a drag that moves 10 pt vertically first: that one is the page scrolling.
 *   Not a 24 pt edge strip: Android's own gesture navigation owns the screen edges and turns an
 *   edge swipe into the system Back, which arrives as the hardware Back key and runs the same
 *   hero close (useHeroLifecycle.ts). The gallery itself is left to its pager.
 * - Pull-down: on the gallery, only while the page is scrolled to the top (`pullEnabled`), so
 *   dragging down a scrolled page still scrolls it. Up never activates it, sideways belongs to the
 *   gallery pager. This is the scrub that works the same in both languages.
 *
 * When the finger takes the transition differs. The pull-down grabs on touch-down (`onBegin`): a
 * finger on the flying image catches it, as in iOS. The body swipe grabs only once it activates:
 * that area is mostly touched to scroll or tap, and a grab on touch-down would freeze a running
 * open or close until the pan failed, then restart it from zero speed.
 * The 10 pt activation slop is subtracted from the translation (`onActivate`), so the image does
 * not jump by 10 pt when the drag takes over.
 */
import { usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { useDirection } from '@/i18n/direction';
import { toLogicalX } from '@/motion/gestureMath';
import { testIds } from '@/testIds';

import { backProgress, pullProgress } from './heroMath';
import type { HeroGestureControls } from './useHeroTransition';

/** Finger travel before a back gesture takes over from taps, the scroll and the gallery. */
const ACTIVATE_PX = 10;

export function useHeroBackGestures(controls: HeroGestureControls, width: number) {
  const { dir } = useDirection();
  const { caught, swipeEnabled, pullEnabled, grab, drag, release, letGo } = controls;
  const activation = useSharedValue({ x: 0, y: 0 });

  const swipePan = usePanGesture({
    enabled: swipeEnabled,
    testID: testIds.productSwipeBack,
    // One number = one side: activate towards the end edge, fail towards the start edge.
    activeOffsetX: ACTIVATE_PX * dir,
    failOffsetX: -ACTIVATE_PX * dir,
    // The same 10 pt vertically fails it, so whichever axis the finger takes first wins.
    failOffsetY: [-ACTIVATE_PX, ACTIVATE_PX],
    // Not on `onBegin`: a scroll or a tap on the body must never stop a running transition.
    onActivate: (e) => {
      grab();
      activation.set({ x: e.translationX, y: e.translationY });
    },
    onUpdate: (e) => {
      const tx = e.translationX - activation.get().x;
      const ty = e.translationY - activation.get().y;
      drag(backProgress(tx, width, dir, caught.get().progress), tx, ty);
    },
    onDeactivate: (e) => {
      release(toLogicalX(e.velocityX, dir), e.velocityX, e.velocityY);
    },
    onFinalize: () => {
      letGo();
    },
  });

  const pullPan = usePanGesture({
    enabled: pullEnabled,
    testID: testIds.productPullBack,
    activeOffsetY: ACTIVATE_PX,
    failOffsetY: -ACTIVATE_PX,
    failOffsetX: [-ACTIVATE_PX, ACTIVATE_PX],
    onBegin: () => {
      grab();
    },
    onActivate: (e) => {
      activation.set({ x: e.translationX, y: e.translationY });
    },
    onUpdate: (e) => {
      const tx = e.translationX - activation.get().x;
      const ty = e.translationY - activation.get().y;
      drag(pullProgress(ty, width, caught.get().progress), tx, ty);
    },
    onDeactivate: (e) => {
      release(e.velocityY, e.velocityX, e.velocityY);
    },
    onFinalize: () => {
      letGo();
    },
  });

  return { swipePan, pullPan };
}
