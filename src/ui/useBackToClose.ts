/**
 * Android's back button closes an overlay before it leaves the screen: while `active`, a back press
 * calls `onBack` and goes no further. Pass "open and its screen is the one showing" as `active`, so
 * an overlay left open on another tab never swallows that tab's back press.
 */
import { useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';

export function useBackToClose(active: boolean, onBack: () => void) {
  // An effect event reads the latest `onBack` without subscribing again on every render.
  const handle = useEffectEvent(() => {
    onBack();
    return true;
  });
  useEffect(() => {
    if (!active) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handle());
    return () => subscription.remove();
  }, [active]);
}
