/**
 * The stale-draft bug, end to end with the real filter sheet inside the Category screen (C-03, H-03).
 *
 * What went wrong before: with the sheet open, picking a category on Home changed the screen's
 * filters under it, but the sheet kept its old draft, so Apply silently dropped the new category.
 * Now a new category from Home closes the sheet (the person has moved on), and the next open starts
 * from what the grid shows. Both sides of the fix are also tested alone: the param in
 * categoryScreen.test.tsx, the draft re-seed in filterSortSheet.test.tsx.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CATEGORIES } from '@/core/catalog';
import { CategoryScreen } from '@/features/category/CategoryScreen';
import { resetProductOpenLatchForTest } from '@/motion/hero/openProduct';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { fakeApi as api } from '@/state/api';
import { cartActions } from '@/state/cart.store';
import { testIds } from '@/testIds';

import { renderScreen, settle } from './helpers/category';
import { pressNative } from './helpers/render';
import { paramStore } from './helpers/routeParams';
import { keepSharedValues } from './helpers/sharedValues';

jest.mock('@/state/api', () => {
  const fake = jest.requireActual('@/core/api/fakeApi').createFakeApi({ delayMs: [5, 5], chaos: 0 });
  return { api: fake, fakeApi: fake };
});
jest.mock('expo-router', () => jest.requireActual<typeof import('./helpers/routeParams')>('./helpers/routeParams').expoRouterMock);

const vitamins = CATEGORIES.find((category) => category.id === 'vitamins');
if (!vitamins) throw new Error('The catalogue has no vitamins');

/**
 * The whole screen plus the real sheet, opened twice. On the dev machine (Windows, Node under Jest)
 * the run took 5.3 s, just over Jest's default 5 s; most of it was the two sheet renders over the grid.
 */
const FULL_FLOW_TIMEOUT_MS = 20_000;

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  resetProductOpenLatchForTest();
  keepSharedValues();
  paramStore.params = {};
  api.debug.forceFailure = false;
  cartActions.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function choose(role: 'button' | 'checkbox', name: string) {
  await fireEvent(screen.getByRole(role, { name }), 'buttonPress', { nativeEvent: {} });
}

function sheetIsClosed(): boolean {
  return screen.getByTestId(testIds.filterSheet, { includeHiddenElements: true }).props.pointerEvents === 'none';
}

describe('Category: a category from Home while the filter sheet is open', () => {
  it('closes the sheet, and the next Apply keeps the new category instead of the old draft', async () => {
    await renderScreen(
      <GestureHandlerRootView>
        <CategoryScreen />
      </GestureHandlerRootView>,
    );
    await screen.findByTestId(testIds.productTile(0));

    await pressNative(testIds.filterButton);
    expect(sheetIsClosed()).toBe(false);
    await choose('button', 'Top rated'); // an edit that is never applied

    await act(async () => paramStore.set({ category: 'vitamins' }));
    expect(sheetIsClosed()).toBe(true);
    expect(screen.getByRole('header', { name: vitamins.en })).toBeTruthy();

    await pressNative(testIds.filterButton);
    // The new draft is what the grid shows: Vitamins on, and the unapplied sort gone.
    expect(screen.getByRole('checkbox', { name: vitamins.en, checked: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Relevance', selected: true })).toBeTruthy();

    await pressNative(testIds.sheetApply);
    expect(sheetIsClosed()).toBe(true);
    expect(screen.getByRole('header', { name: vitamins.en })).toBeTruthy();
    expect(screen.getByTestId(testIds.filterButton).props.accessibilityLabel).toBe('Filter & sort, 1 filter on');
    await settle();
  }, FULL_FLOW_TIMEOUT_MS);
});
