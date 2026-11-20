/**
 * Whether TalkBack / VoiceOver is running, kept current while the app is open. The banner carousel
 * stops autoplay while it is on: a slide that changes by itself would change the text under the
 * user's focus.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        if (mounted) setEnabled(on);
      })
      // Unknown means "assume off": the worst case is autoplay for a user who did not need it paused.
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
