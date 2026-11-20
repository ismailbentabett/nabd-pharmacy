/**
 * Sign-in with an emailed 6-digit code (Supabase email OTP), and what signing in or out does to
 * the rest of the app. This file is the only writer of the session store.
 *
 * - `initAuth()` runs once at the app root (`AuthSync`). No Supabase keys → the session is
 *   `offline` and nothing else happens. Otherwise: `loading`, read the stored session, then follow
 *   `onAuthStateChange` for the life of the app.
 * - Every session change goes through `applySession`. It only acts when the user id changes, so a
 *   token refresh (same user, new token) does nothing.
 * - Signed in: favourites get a remote that mirrors each toggle to `public.favorites`, the server's
 *   list is merged into this device's, and ids the server lacks are pushed (`mergeServer` does that
 *   through the remote). Hearts added while signed out are kept and join the account.
 * - Every user change (sign-out, a different user, or a cold start whose stored session is gone)
 *   goes through `favoriteActions.claimFor`, which wipes a list saved for another user, and drops
 *   the cached order history, so the next person on this phone never sees the last one's data.
 * - Database calls never run inside the auth callback itself: supabase-js holds a lock while it
 *   notifies, and a query from inside it would wait on that lock. They are deferred one tick.
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { getSupabase } from '@/core/supabase/client';
import { favoriteActions, type FavoritesRemote } from '@/state/favorites.store';
import { ORDERS_QUERY_KEY } from '@/state/orders';
import { queryClient } from '@/state/queryClient';
import { getSession, OFFLINE_SESSION, setSession } from '@/state/session.store';

export type AuthResult = { ok: true } | { ok: false; error: string };

/** Loose on purpose: the server is the real check. This only catches typos before a round trip. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export const CODE_LENGTH = 6;

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

function report(what: string, error: { message: string } | null): void {
  if (error !== null && __DEV__) console.warn(`[auth] ${what}: ${error.message}`);
}

/** Mirrors favourite toggles to `public.favorites`. Row Level Security limits it to this user's rows. */
export function supabaseFavoritesRemote(supabase: SupabaseClient, userId: string): FavoritesRemote {
  const table = () => supabase.from('favorites');
  return {
    add(id) {
      // `ignoreDuplicates` makes this ON CONFLICT DO NOTHING: only the insert policy is needed.
      void table()
        .upsert({ user_id: userId, product_id: id }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
        .then(({ error }) => report(`add favourite ${id}`, error));
    },
    remove(id) {
      void table()
        .delete()
        .eq('user_id', userId)
        .eq('product_id', id)
        .then(({ error }) => report(`remove favourite ${id}`, error));
    },
  };
}

async function syncFavorites(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', userId);
  // Ignore a reply that arrives after the user changed (signed out, or someone else signed in).
  if (getSession().userId !== userId) return;
  if (error !== null) {
    report('load favourites', error);
    return;
  }
  favoriteActions.mergeServer((data as { product_id: string }[]).map((row) => row.product_id));
}

/** Drop every cached order history: it belonged to the user who just left. */
function forgetOrders(): void {
  queryClient.removeQueries({ queryKey: ORDERS_QUERY_KEY });
}

/** Map a Supabase session to the store and run the sign-in / sign-out side effects. */
export function applySession(supabase: SupabaseClient, session: Session | null): void {
  const prev = getSession();
  const userId = session?.user.id ?? null;

  if (userId === null) {
    favoriteActions.setRemote(null);
    // Not only after a sign-out in this run: on a cold start the saved list may be the last user's.
    favoriteActions.claimFor(null);
    if (prev.userId !== null) forgetOrders();
    if (prev.status !== 'signedOut') setSession({ status: 'signedOut', email: null, userId: null });
    return;
  }

  const email = session?.user.email ?? '';
  if (prev.status === 'signedIn' && prev.userId === userId) {
    if (prev.email !== email) setSession({ status: 'signedIn', email, userId });
    return;
  }
  favoriteActions.claimFor(userId); // another user's list is wiped; a signed-out list is kept
  forgetOrders();
  setSession({ status: 'signedIn', email, userId });
  favoriteActions.setRemote(supabaseFavoritesRemote(supabase, userId));
  setTimeout(() => void syncFavorites(supabase, userId), 0);
}

/** Start following the auth state. Returns the unsubscribe. Safe to call more than once. */
export function initAuth(): () => void {
  const supabase = getSupabase();
  if (supabase === null) {
    setSession(OFFLINE_SESSION);
    return () => undefined;
  }
  setSession({ status: 'loading', email: null, userId: null });

  void supabase.auth.getSession().then(({ data }) => applySession(supabase, data.session));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Deferred one tick: see the note at the top of the file.
    setTimeout(() => applySession(supabase, session), 0);
  });
  return () => data.subscription.unsubscribe();
}

/** Mounted once in the root layout, next to the other app-wide syncs. Draws nothing. */
export function AuthSync(): null {
  useEffect(() => initAuth(), []);
  return null;
}

function offlineResult(): AuthResult {
  return { ok: false, error: 'Supabase is not configured' };
}

export async function sendCode(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (supabase === null) return offlineResult();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  return error === null ? { ok: true } : { ok: false, error: error.message };
}

export async function verifyCode(email: string, token: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (supabase === null) return offlineResult();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
  if (error !== null) return { ok: false, error: error.message };
  // The auth event follows too; applying it now means the screen does not wait a tick for it.
  applySession(supabase, data.session);
  return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (supabase === null) return offlineResult();
  let { error } = await supabase.auth.signOut();
  if (error !== null) {
    // Global sign-out needs the network. Offline, still forget the session on this phone.
    report('sign out (global)', error);
    ({ error } = await supabase.auth.signOut({ scope: 'local' }));
  }
  applySession(supabase, null);
  return error === null ? { ok: true } : { ok: false, error: error.message };
}
