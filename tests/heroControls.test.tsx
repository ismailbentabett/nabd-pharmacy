/**
 * The hero's finger controls and the tile's hidden switch (useHeroTransition; P-01, F-04).
 *
 * The back gestures drive four worklets: grab (a finger lands), drag (it moves the transition),
 * release (it lifts after dragging, with its speed) and letGo (it lifts, dragged or not). Here they
 * are called directly, as the gestures call them on the UI thread. Which way each gesture closes,
 * in each language, is in productChrome.test.tsx.
 *
 * The hook runs with a tile hand-off whose rect is already measured, so it takes the flight path
 * (springs, gallery reset, tile hiding). Reanimated's mock ends a spring at once; to look at a close
 * that is still running, `holdCloses` keeps the close spring's callback until the test calls it,
 * with `true` (it landed) or `false` (a finger cancelled it).
 */
import { act, renderHook } from '@testing-library/react-native';
import type { View } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import type { Rect } from '@/motion/hero/heroMath';
import { registerHeroSource, resetHeroRegistryForTest } from '@/motion/hero/registry';
import { useHeroTransition } from '@/motion/hero/useHeroTransition';

import { keepSharedValues } from './helpers/sharedValues';

const WIDTH = 400;
const ID = 'p-hero';
const TILE: Rect = { x: 16, y: 320, width: 170, height: 170 };

type Finish = (finished?: boolean) => void;

let holdCloses = false;
let held: Finish[] = [];
let reaction: { prepare: () => unknown; react: (prepared: unknown, previous: unknown) => void } | null = null;
let previous: unknown = null;

beforeEach(() => {
  resetHeroRegistryForTest();
  keepSharedValues();
  holdCloses = false;
  held = [];
  reaction = null;
  previous = null;
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((toValue, _config, callback) => {
    if (holdCloses && toValue === 0 && callback) held.push(callback);
    else callback?.(true);
    return toValue;
  });
  // A no-op in Reanimated's mock: kept here so the test can run it, as a frame would.
  jest.spyOn(Reanimated, 'useAnimatedReaction').mockImplementation((prepare, react) => {
    reaction = { prepare, react: react as (prepared: unknown, previous: unknown) => void };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Lets worklets scheduled for the UI thread, and their calls back to JS, run. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

/** One frame of the tile-hiding reaction. */
function frame() {
  if (reaction === null) throw new Error('The hero registered no reaction');
  const prepared = reaction.prepare();
  reaction.react(prepared, previous);
  previous = prepared;
}

async function renderOpenHero() {
  const hidden = Reanimated.makeMutable(0);
  registerHeroSource(ID, {
    uri: 'tile.jpg',
    ref: {} as Reanimated.AnimatedRef<View>,
    rect: Reanimated.makeMutable<Rect | null>(TILE),
    hidden,
  });
  const onClosed = jest.fn();
  const onInteractiveChange = jest.fn();
  const resetGallery = jest.fn();
  const hook = await renderHook(() =>
    useHeroTransition({ productId: ID, width: WIDTH, reduceMotion: false, resetGallery, onInteractiveChange, onClosed }),
  );
  frame();
  expect(hidden.get()).toBe(0); // not open yet: the tile still shows
  hook.result.current.markImageReady();
  await flush();
  expect(onInteractiveChange.mock.calls).toEqual([[true]]);
  const controls = () => hook.result.current.controls;
  return { ...hook, controls, hidden, onClosed, onInteractiveChange, resetGallery };
}

describe('grab, drag, release (F-04)', () => {
  it('a drag past half and a release close the page: one pop, tile shown, then nothing more', async () => {
    const { controls, result, hidden, onClosed, onInteractiveChange, resetGallery, unmount } = await renderOpenHero();
    frame();
    expect(hidden.get()).toBe(1);

    await act(async () => {
      controls().grab();
      controls().drag(0.3, 120, 40);
      controls().release(0, 0, 0);
      controls().letGo();
    });
    await flush();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onInteractiveChange.mock.calls).toEqual([[true], [false]]);
    expect(resetGallery).toHaveBeenCalledTimes(1);
    expect(hidden.get()).toBe(0);

    // Landed: no Back, finger or key can start a second close or a second pop.
    await act(async () => {
      result.current.requestClose();
      controls().grab();
      controls().drag(0.1, 200, 0);
      controls().release(0, 0, 0);
    });
    await flush();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(controls().swipeEnabled.get()).toBe(false);
    await unmount();
  });

  it('a release above half springs back open: no close, and the chrome comes back', async () => {
    const { controls, onClosed, onInteractiveChange, resetGallery, unmount } = await renderOpenHero();
    await act(async () => {
      controls().grab();
      controls().drag(0.8, 40, 0);
      controls().release(0, 0, 0);
      controls().letGo();
    });
    await flush();
    expect(onClosed).not.toHaveBeenCalled();
    expect(resetGallery).not.toHaveBeenCalled();
    expect(onInteractiveChange.mock.calls).toEqual([[true], [false], [true]]);
    await unmount();
  });

  it('the finger speed decides: a flick closes from a short drag, a flick back keeps it open', async () => {
    const flick = await renderOpenHero();
    await act(async () => {
      flick.controls().grab();
      flick.controls().drag(0.9, 20, 0);
      flick.controls().release(2000, 2000, 0);
    });
    await flush();
    expect(flick.onClosed).toHaveBeenCalledTimes(1);
    await flick.unmount();

    const back = await renderOpenHero();
    await act(async () => {
      back.controls().grab();
      back.controls().drag(0.4, 240, 0);
      back.controls().release(-2000, -2000, 0);
    });
    await flush();
    expect(back.onClosed).not.toHaveBeenCalled();
    await back.unmount();
  });
});

describe('fingers that never drag', () => {
  it('a tap on the page at rest leaves it open and the chrome alone; a stray lift does nothing', async () => {
    const { controls, onClosed, onInteractiveChange, unmount } = await renderOpenHero();
    const springs = jest.mocked(Reanimated.withSpring).mock.calls.length;
    await act(async () => {
      controls().letGo(); // Gesture Handler finalizes gestures that never began, too
    });
    expect(jest.mocked(Reanimated.withSpring).mock.calls.length).toBe(springs);

    await act(async () => {
      controls().grab();
      controls().letGo();
    });
    await flush();
    expect(onClosed).not.toHaveBeenCalled();
    expect(onInteractiveChange.mock.calls).toEqual([[true]]);
    await unmount();
  });

  it('two fingers on a closing page: it waits for the last one, then carries on closing', async () => {
    const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
    const { controls, result, onClosed, onInteractiveChange, unmount } = await renderOpenHero();
    holdCloses = true;
    await act(async () => {
      result.current.requestClose();
    });
    await flush();
    expect(held).toHaveLength(1);
    expect(onInteractiveChange.mock.calls).toEqual([[true], [false]]);

    await act(async () => {
      controls().grab();
      controls().grab();
    });
    // Only the first finger stops the springs (progress and the two carry offsets).
    expect(cancel).toHaveBeenCalledTimes(3);
    held[0]?.(false); // what cancelAnimation does on a device

    await act(async () => {
      controls().letGo();
    });
    expect(held).toHaveLength(1); // one finger still down: nothing moves yet
    await act(async () => {
      controls().letGo();
    });
    expect(held).toHaveLength(2); // the last lift continues the close

    held[1]?.(true);
    await flush();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onInteractiveChange.mock.calls).toEqual([[true], [false]]);
    await unmount();
  });
});

describe("the tile's hidden switch (P-01)", () => {
  it('stays hidden while the close flies, and shows in the frame the hero lands', async () => {
    const { result, hidden, onClosed, unmount } = await renderOpenHero();
    frame();
    expect(hidden.get()).toBe(1);

    holdCloses = true;
    await act(async () => {
      result.current.requestClose();
    });
    await flush();
    frame();
    expect(hidden.get()).toBe(1);
    expect(onClosed).not.toHaveBeenCalled();

    held[0]?.(true);
    expect(hidden.get()).toBe(0);
    await flush();
    expect(onClosed).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('shows again if the page goes away without landing (the cart icon)', async () => {
    const { hidden, unmount } = await renderOpenHero();
    frame();
    expect(hidden.get()).toBe(1);
    await unmount();
    expect(hidden.get()).toBe(0);
  });
});
