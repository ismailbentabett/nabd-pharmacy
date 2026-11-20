/**
 * When each back gesture takes the hero transition (useHeroBackGestures; P-01, F-04).
 *
 * The body swipe must not stop a running open or close on touch-down: that area is mostly touched
 * to scroll, and a grab there froze the hero until the pan failed, then restarted it from zero
 * speed. It grabs only once it activates. The pull-down on the image still grabs on touch-down,
 * so a finger can catch the flying image.
 *
 * Gesture Handler's hook is replaced by one that hands back its config, so the test can call the
 * callbacks in the order a device sends them (begin, maybe activate, finalize). The transition is
 * the real one, set up as in heroControls.test.tsx: a measured tile hand-off, and a close spring
 * whose callback the test keeps until it lets it land.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { View } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import type { Rect } from '@/motion/hero/heroMath';
import { registerHeroSource, resetHeroRegistryForTest } from '@/motion/hero/registry';
import { useHeroBackGestures } from '@/motion/hero/useHeroBackGestures';
import { useHeroTransition } from '@/motion/hero/useHeroTransition';
import { testIds } from '@/testIds';

import { keepSharedValues } from './helpers/sharedValues';

type PanEvent = { translationX: number; translationY: number; velocityX: number; velocityY: number };
type PanConfig = Partial<Record<'onBegin' | 'onActivate' | 'onUpdate' | 'onFinalize', (e: PanEvent) => void>> & {
  onDeactivate?: (e: PanEvent, didSucceed: boolean) => void;
  testID?: string;
};

const mockPans: Record<string, PanConfig> = {};
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual<object>('react-native-gesture-handler'),
  usePanGesture: (config: PanConfig) => {
    if (config.testID !== undefined) mockPans[config.testID] = config;
    return config;
  },
}));

const WIDTH = 400;
const ID = 'p-back-gestures';
const TILE: Rect = { x: 16, y: 320, width: 170, height: 170 };
const STILL: PanEvent = { translationX: 0, translationY: 0, velocityX: 0, velocityY: 0 };

type Finish = (finished?: boolean) => void;
let held: Finish[] = [];
// Spied before the render: the worklets keep the function they saw when the hook first ran.
let cancel: jest.SpyInstance;

beforeEach(() => {
  resetHeroRegistryForTest();
  keepSharedValues();
  held = [];
  cancel = jest.spyOn(Reanimated, 'cancelAnimation');
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((toValue, _config, callback) => {
    if (toValue === 0 && callback) held.push(callback); // the close keeps running until the test lands it
    else callback?.(true);
    return toValue;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** An open page whose close has started and is still flying. */
async function renderClosingPage() {
  registerHeroSource(ID, {
    uri: 'tile.jpg',
    ref: {} as Reanimated.AnimatedRef<View>,
    rect: Reanimated.makeMutable<Rect | null>(TILE),
    hidden: Reanimated.makeMutable(0),
  });
  const onClosed = jest.fn();
  const hook = await renderHook(() => {
    const hero = useHeroTransition({
      productId: ID,
      width: WIDTH,
      reduceMotion: false,
      resetGallery: () => {},
      onInteractiveChange: () => {},
      onClosed,
    });
    useHeroBackGestures(hero.controls, WIDTH);
    return hero;
  });
  hook.result.current.markImageReady();
  await flush();
  await act(async () => {
    hook.result.current.requestClose();
  });
  await flush();
  expect(held).toHaveLength(1);
  cancel.mockClear(); // only what happens after the close started counts
  const pan = (id: string) => {
    const config = mockPans[id];
    if (config === undefined) throw new Error(`No pan gesture with testID ${id}`);
    return config;
  };
  return { ...hook, onClosed, cancel, swipe: pan(testIds.productSwipeBack), pull: pan(testIds.productPullBack) };
}

describe('a touch on the page body while the hero flies (F-04)', () => {
  it('does not stop the close: a pan that only begins and fails leaves the spring running', async () => {
    const { swipe, cancel, onClosed, unmount } = await renderClosingPage();
    await act(async () => {
      swipe.onBegin?.(STILL);
      swipe.onFinalize?.(STILL); // the finger scrolled or lifted: the pan never activated
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(held).toHaveLength(1); // no restart from zero speed either

    held[0]?.(true);
    await flush();
    expect(onClosed).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('a body swipe takes the transition when it activates, and its release carries on', async () => {
    const { swipe, cancel, onClosed, unmount } = await renderClosingPage();
    await act(async () => {
      swipe.onBegin?.(STILL);
    });
    expect(cancel).not.toHaveBeenCalled();

    await act(async () => {
      swipe.onActivate?.({ ...STILL, translationX: 10 });
    });
    // Progress and the two carry offsets stop where they are.
    expect(cancel).toHaveBeenCalledTimes(3);
    held[0]?.(false); // what cancelAnimation does on a device

    await act(async () => {
      swipe.onUpdate?.({ ...STILL, translationX: 300 });
      swipe.onDeactivate?.({ ...STILL, translationX: 300, velocityX: 800 }, true);
      swipe.onFinalize?.(STILL);
    });
    expect(held).toHaveLength(2);
    held[1]?.(true);
    await flush();
    expect(onClosed).toHaveBeenCalledTimes(1);
    await unmount();
  });
});

describe('a touch on the flying image', () => {
  it('the pull-down still catches it on touch-down', async () => {
    const { pull, cancel, unmount } = await renderClosingPage();
    await act(async () => {
      pull.onBegin?.(STILL);
    });
    expect(cancel).toHaveBeenCalledTimes(3);

    await act(async () => {
      pull.onFinalize?.(STILL); // lifted without dragging: the close carries on
    });
    expect(held).toHaveLength(2);
    await unmount();
  });
});
