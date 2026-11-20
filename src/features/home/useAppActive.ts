/**
 * Whether the app is in the foreground, kept current while it runs. The banner carousel stops its
 * autoplay timer in the background: Android holds JS timers while the app is away and fires an
 * overdue one on the first frame back, which would turn the banner the moment Home reappears.
 * Stopping the timer means coming back always starts a full turn.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useAppActive(): boolean {
  // Home mounts while the app is open: start as active, then follow the system's changes.
  const [active, setActive] = useState(true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  return active;
}
