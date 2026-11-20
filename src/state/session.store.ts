/**
 * Who is signed in, as the UI needs to know it. One small zustand store, written by `useAuth`
 * (the Account feature) and read by any screen through a selector (`useSession`).
 *
 * - `offline`: this build has no Supabase keys; sign-in is off and the fake service serves data.
 * - `loading`: Supabase is configured and the stored session is still being read.
 * - `signedOut` / `signedIn`: the steady states. `email` and `userId` are set only when signed in.
 */
import { create } from 'zustand';

export type SessionStatus = 'offline' | 'loading' | 'signedOut' | 'signedIn';

export type SessionState = {
  status: SessionStatus;
  email: string | null;
  userId: string | null;
};

export const OFFLINE_SESSION: SessionState = { status: 'offline', email: null, userId: null };

const useSessionStore = create<SessionState>(() => OFFLINE_SESSION);

/** Subscribe to one slice of the session, e.g. `useSession((s) => s.status)`. */
export function useSession<T>(select: (s: SessionState) => T): T {
  return useSessionStore(select);
}

export function getSession(): SessionState {
  return useSessionStore.getState();
}

/** Replace the session (the auth layer is the only writer). */
export function setSession(next: SessionState): void {
  useSessionStore.setState(next, true);
}
