/**
 * Favourites: a zustand store of product ids, saved to MMKV, same shape of code as the cart store.
 *
 * - A grid tile subscribes with `useIsFavorite(id)`, a boolean selector. Toggling one heart
 *   re-renders that tile and the product page showing the same id, never the other 999 tiles (F-05).
 *   That one store is also why the grid heart and the product-page heart can never disagree.
 * - `ids` is newest first, so a favourites list reads like history without a separate timestamp.
 * - Signed in to Supabase, every toggle is also mirrored to `public.favorites` through `remote`.
 *   The local store stays the source of truth for the UI: the heart flips on the tap, the network
 *   call follows, and a failed call is logged by the remote, not rolled back in the user's face.
 * - The list has an owner, saved next to it: the user id it belongs to, or nobody (favourites added
 *   while signed out). `claimFor` wipes a list owned by someone else, so user A's hearts never
 *   survive into a signed-out phone or into user B's account, even across an app restart.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

import { findProduct } from '@/core/catalog';

export interface FavoritesState {
  /** Newest first. */
  readonly ids: readonly string[];
  readonly byId: Readonly<Record<string, true>>;
}

export const EMPTY_FAVORITES: FavoritesState = { ids: [], byId: {} };

/** The two MMKV methods the store uses. Tests pass an in-memory stand-in. */
export interface FavoritesStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

/** Where toggles are mirrored when a user is signed in (Supabase). Fire and forget. */
export interface FavoritesRemote {
  add(id: string): void;
  remove(id: string): void;
}

export const FAVORITES_STORAGE_KEY = 'favorites.v1';
/** Who the saved list belongs to: a user id, or '' for nobody (signed out). */
export const FAVORITES_OWNER_KEY = 'favorites.owner.v1';

/** Build a state from ids, dropping duplicates and ids the catalog does not know. */
export function favoritesFromIds(ids: readonly unknown[]): FavoritesState {
  const kept: string[] = [];
  const byId: Record<string, true> = {};
  for (const id of ids) {
    if (typeof id !== 'string' || byId[id] || findProduct(id) === undefined) continue;
    kept.push(id);
    byId[id] = true;
  }
  return kept.length === 0 ? EMPTY_FAVORITES : { ids: kept, byId };
}

/** Read saved favourites. Bad JSON or a wrong shape gives an empty list, never a crash. */
export function restoreFavorites(saved: string | undefined): FavoritesState {
  if (saved === undefined) return EMPTY_FAVORITES;
  try {
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? favoritesFromIds(parsed) : EMPTY_FAVORITES;
  } catch {
    return EMPTY_FAVORITES;
  }
}

export function toggleIn(state: FavoritesState, id: string): FavoritesState {
  if (state.byId[id]) {
    const { [id]: _removed, ...rest } = state.byId;
    return { ids: state.ids.filter((x) => x !== id), byId: rest };
  }
  if (findProduct(id) === undefined) return state;
  return { ids: [id, ...state.ids], byId: { ...state.byId, [id]: true } };
}

/**
 * Union of what this device has and what the server has. Local order first (it is what the user
 * just saw), then server-only ids. Returns the ids the server is missing so the caller can push them.
 */
export function mergeFavorites(
  local: FavoritesState,
  serverIds: readonly string[],
): { state: FavoritesState; missingOnServer: string[] } {
  const server = new Set(serverIds);
  const state = favoritesFromIds([...local.ids, ...serverIds]);
  return { state, missingOnServer: local.ids.filter((id) => !server.has(id)) };
}

export interface FavoriteActions {
  /** Flip one id. Returns the new value (true = now a favourite). */
  toggle(id: string): boolean;
  set(id: string, on: boolean): void;
  /** Merge the signed-in user's server list into this device's, and push what the server lacks. */
  mergeServer(serverIds: readonly string[]): void;
  setRemote(remote: FavoritesRemote | null): void;
  clear(): void;
  /**
   * Make `userId` (null = signed out) the owner of the list. A list owned by another user is wiped
   * first. A list owned by nobody is kept, so hearts added before signing in join the account.
   */
  claimFor(userId: string | null): void;
}

export interface Favorites {
  useFavorites: UseBoundStore<StoreApi<FavoritesState>>;
  actions: FavoriteActions;
}

export function createFavorites(storage: FavoritesStorage): Favorites {
  const useFavorites = create<FavoritesState>()(() =>
    restoreFavorites(storage.getString(FAVORITES_STORAGE_KEY)),
  );
  let remote: FavoritesRemote | null = null;

  useFavorites.subscribe((state, prev) => {
    if (state.ids !== prev.ids) storage.set(FAVORITES_STORAGE_KEY, JSON.stringify(state.ids));
  });

  const set = (id: string, on: boolean) => {
    const state = useFavorites.getState();
    if (Boolean(state.byId[id]) === on) return;
    const next = toggleIn(state, id);
    if (next === state) return;
    useFavorites.setState(next, true);
    if (on) remote?.add(id);
    else remote?.remove(id);
  };

  const actions: FavoriteActions = {
    toggle(id) {
      const on = !useFavorites.getState().byId[id];
      set(id, on);
      return Boolean(useFavorites.getState().byId[id]);
    },
    set,
    mergeServer(serverIds) {
      const { state, missingOnServer } = mergeFavorites(useFavorites.getState(), serverIds);
      useFavorites.setState(state, true);
      for (const id of missingOnServer) remote?.add(id);
    },
    setRemote(next) {
      remote = next;
    },
    clear() {
      useFavorites.setState(EMPTY_FAVORITES, true);
    },
    claimFor(userId) {
      const owner = storage.getString(FAVORITES_OWNER_KEY) || null;
      if (owner === userId) return;
      if (owner !== null) actions.clear();
      storage.set(FAVORITES_OWNER_KEY, userId ?? '');
    },
  };

  return { useFavorites, actions };
}

const appFavorites = createFavorites(createMMKV({ id: 'favorites' }));

export const favoriteActions = appFavorites.actions;
export const getFavoritesState = () => appFavorites.useFavorites.getState();

/** One tile's heart. A boolean selector: only the tiles whose answer changes re-render. */
export function useIsFavorite(id: string): boolean {
  return appFavorites.useFavorites((s) => s.byId[id] === true);
}

export function useFavoriteIds(): readonly string[] {
  return appFavorites.useFavorites((s) => s.ids);
}

export function useFavoriteCount(): number {
  return appFavorites.useFavorites((s) => s.ids.length);
}
