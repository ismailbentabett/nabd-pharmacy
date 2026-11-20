/**
 * The Supabase client, or `null` when the build has no Supabase keys.
 *
 * Keys come from EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example). The anon
 * key is public by design: Row Level Security in supabase/migrations is the security boundary.
 * Without the keys the app runs on the offline fake backend, so a fresh clone works with no account.
 *
 * Sessions persist in MMKV (synchronous, already in the app for the cart), and token refresh runs
 * only while the app is in the foreground, as Supabase recommends for React Native.
 */
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Reads the build-time keys. Both must be present and the URL must be https. */
export function readSupabaseConfig(env: {
  url: string | undefined;
  anonKey: string | undefined;
}): SupabaseConfig | null {
  const url = env.url?.trim() ?? '';
  const anonKey = env.anonKey?.trim() ?? '';
  if (url === '' || anonKey === '') return null;
  if (!/^https:\/\/[^\s/]+/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/.test(url)) {
    return null;
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

/** The three methods supabase-js needs, backed by a synchronous MMKV store. */
export function mmkvAuthStorage(store: {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
}): SupportedStorage {
  return {
    getItem: (key) => store.getString(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.remove(key);
    },
  };
}

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  // Read each variable by its full name: Expo inlines `process.env.EXPO_PUBLIC_*` at build time
  // only for direct member access.
  const config = readSupabaseConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (config === null) {
    client = null;
    return client;
  }
  client = createClient(config.url, config.anonKey, {
    auth: {
      storage: mmkvAuthStorage(createMMKV({ id: 'auth' })),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  const supabase = client;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}
