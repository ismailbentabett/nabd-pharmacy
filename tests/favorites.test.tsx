/**
 * Favourites: the pure helpers, the store (persistence + remote mirroring), and the heart that
 * stays in sync between a grid tile and the product page (the L-01 live-change scenario).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';

import { getCatalog } from '@/core/catalog';
import {
  createFavorites,
  EMPTY_FAVORITES,
  favoriteActions,
  FAVORITES_STORAGE_KEY,
  favoritesFromIds,
  getFavoritesState,
  mergeFavorites,
  restoreFavorites,
  toggleIn,
  type FavoritesRemote,
  type FavoritesStorage,
} from '@/state/favorites.store';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { HEART_POP_SCALE, HeartButton } from '@/ui/HeartButton';

import { renderWithProviders } from './helpers/render';

const [a, b, c] = getCatalog().products.map((p) => p.id);
const A = a!;
const B = b!;
const C = c!;

function memoryStorage(initial?: string): FavoritesStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(FAVORITES_STORAGE_KEY, initial);
  return { map, getString: (k) => map.get(k), set: (k, v) => void map.set(k, v) };
}

function spyRemote(): FavoritesRemote & { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  return { added, removed, add: (id) => void added.push(id), remove: (id) => void removed.push(id) };
}

describe('favourites helpers', () => {
  it('drops duplicates, non-strings and unknown ids, keeping first-seen order', () => {
    const s = favoritesFromIds([B, A, B, 42, 'not-a-product', A]);
    expect(s.ids).toEqual([B, A]);
    expect(s.byId).toEqual({ [A]: true, [B]: true });
  });

  it('restores an empty list from nothing, bad JSON or the wrong shape', () => {
    expect(restoreFavorites(undefined)).toBe(EMPTY_FAVORITES);
    expect(restoreFavorites('{oops')).toBe(EMPTY_FAVORITES);
    expect(restoreFavorites('{"ids":[]}')).toBe(EMPTY_FAVORITES);
    expect(restoreFavorites(JSON.stringify([A])).ids).toEqual([A]);
  });

  it('toggles newest first, and ignores an id the catalog does not know', () => {
    const one = toggleIn(EMPTY_FAVORITES, A);
    const two = toggleIn(one, B);
    expect(two.ids).toEqual([B, A]);
    expect(toggleIn(two, A).ids).toEqual([B]);
    expect(toggleIn(two, 'nope')).toBe(two);
  });

  it('merges local first, then server-only ids, and reports what the server lacks', () => {
    const local = favoritesFromIds([A, B]);
    const { state, missingOnServer } = mergeFavorites(local, [C, A]);
    expect(state.ids).toEqual([A, B, C]);
    expect(missingOnServer).toEqual([B]);
  });
});

describe('favourites store', () => {
  it('starts from what was saved and saves every change', () => {
    const storage = memoryStorage(JSON.stringify([A]));
    const { useFavorites, actions } = createFavorites(storage);
    expect(useFavorites.getState().ids).toEqual([A]);
    expect(actions.toggle(B)).toBe(true);
    expect(JSON.parse(storage.map.get(FAVORITES_STORAGE_KEY)!)).toEqual([B, A]);
    expect(actions.toggle(A)).toBe(false);
    expect(JSON.parse(storage.map.get(FAVORITES_STORAGE_KEY)!)).toEqual([B]);
  });

  it('mirrors real changes to the remote, and nothing for a no-op', () => {
    const { actions } = createFavorites(memoryStorage());
    const remote = spyRemote();
    actions.setRemote(remote);
    actions.set(A, true);
    actions.set(A, true);
    actions.set(B, false);
    actions.toggle(A);
    expect(remote.added).toEqual([A]);
    expect(remote.removed).toEqual([A]);
  });

  it('merging the server list pushes only the local-only ids', () => {
    const { useFavorites, actions } = createFavorites(memoryStorage(JSON.stringify([A, B])));
    const remote = spyRemote();
    actions.setRemote(remote);
    actions.mergeServer([B, C]);
    expect(useFavorites.getState().ids).toEqual([A, B, C]);
    expect(remote.added).toEqual([A]);
  });

  it('clear empties the list without telling the remote (sign-out keeps the server copy)', () => {
    const { useFavorites, actions } = createFavorites(memoryStorage(JSON.stringify([A])));
    const remote = spyRemote();
    actions.setRemote(remote);
    actions.clear();
    expect(useFavorites.getState()).toBe(EMPTY_FAVORITES);
    expect(remote.removed).toEqual([]);
  });
});

describe('HeartButton', () => {
  beforeEach(() => {
    resetMotionPreferenceForTest();
    resetHapticsForTest();
  });
  afterEach(async () => {
    await act(() => favoriteActions.clear());
    jest.restoreAllMocks();
  });

  it('two hearts for the same product stay in sync (grid tile and product page)', async () => {
    await renderWithProviders(
      <>
        <HeartButton productId={A} name="Tile" testID="tile-heart" />
        <HeartButton productId={A} name="Page" testID="page-heart" />
      </>,
    );
    expect(screen.getByTestId('tile-heart').props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(screen.getByTestId('tile-heart'));
    expect(getFavoritesState().byId[A]).toBe(true);
    expect(screen.getByTestId('page-heart').props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(screen.getByTestId('page-heart'));
    expect(screen.getByTestId('tile-heart').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('is a labelled checkbox', async () => {
    await renderWithProviders(<HeartButton productId={B} name="Omega 3" testID="heart" />);
    const heart = screen.getByTestId('heart');
    expect(heart.props.accessibilityRole).toBe('checkbox');
    expect(heart.props.accessibilityLabel).toContain('Omega 3');
  });

  it('pops when it turns on, even from the other heart, and not when it turns off', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await renderWithProviders(
      <>
        <HeartButton productId={C} name="Tile" testID="tile-heart" />
        <HeartButton productId={C} name="Page" testID="page-heart" />
      </>,
    );
    const pops = () => timing.mock.calls.filter(([to]) => to === HEART_POP_SCALE).length;
    await fireEvent.press(screen.getByTestId('page-heart'));
    expect(pops()).toBe(2);
    await fireEvent.press(screen.getByTestId('tile-heart'));
    expect(pops()).toBe(2);
  });
});
