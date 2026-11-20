/**
 * Supabase client config and session storage. `getSupabase()` itself needs the native MMKV module
 * and real keys; what can go wrong without them (bad env, storage contract) is tested here.
 */
import { mmkvAuthStorage, readSupabaseConfig } from '@/core/supabase/client';

describe('readSupabaseConfig', () => {
  const key = 'anon-key';

  it('is null unless both values are set', () => {
    expect(readSupabaseConfig({ url: undefined, anonKey: undefined })).toBeNull();
    expect(readSupabaseConfig({ url: 'https://abc.supabase.co', anonKey: '' })).toBeNull();
    expect(readSupabaseConfig({ url: '  ', anonKey: key })).toBeNull();
  });

  it('accepts https and strips trailing slashes and spaces', () => {
    expect(readSupabaseConfig({ url: ' https://abc.supabase.co// ', anonKey: ` ${key} ` })).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: key,
    });
  });

  it('accepts plain http only for a local stack (localhost, 127.0.0.1, the Android emulator host)', () => {
    for (const url of ['http://localhost:54321', 'http://127.0.0.1:54321', 'http://10.0.2.2:54321']) {
      expect(readSupabaseConfig({ url, anonKey: key })?.url).toBe(url);
    }
    expect(readSupabaseConfig({ url: 'http://abc.supabase.co', anonKey: key })).toBeNull();
    expect(readSupabaseConfig({ url: 'abc.supabase.co', anonKey: key })).toBeNull();
  });
});

describe('mmkvAuthStorage', () => {
  it('maps get/set/remove onto the store, with null for a missing key', async () => {
    const map = new Map<string, string>();
    const storage = mmkvAuthStorage({
      getString: (k) => map.get(k),
      set: (k, v) => void map.set(k, v),
      remove: (k) => map.delete(k),
    });
    expect(await storage.getItem('s')).toBeNull();
    await storage.setItem('s', 'token');
    expect(await storage.getItem('s')).toBe('token');
    await storage.removeItem('s');
    expect(map.has('s')).toBe(false);
  });
});
