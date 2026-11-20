/**
 * The English / Arabic switch (G-08), meant for the pine Home header.
 *
 * Switching language restarts the JS app (ADR-005, ADR-031), which would look like a hard jump. So a
 * press does four things in a fixed order:
 *   1. buzz, so the press is felt at once;
 *   2. commit a cart deletion still waiting for undo (after the restart it would be final anyway, and
 *      the undo bar cannot survive it);
 *   3. fade a pine veil over the whole screen (about 150 ms, on the UI thread);
 *   4. when the fade has finished, set the native direction and reload. The new layout appears under a
 *      screen that is already pine, not as a flash of the old language.
 *
 * The veil lives in a transparent `Modal`, not in an absolutely positioned view: a Modal is its own
 * window on Android, so it also covers the tab bar, the status bar and the navigation bar, which a
 * view inside this header never could. It is mounted only while switching, so it costs nothing the
 * rest of the time.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { radius } from '@/design/tokens';
import { FONT_FAMILY } from '@/design/typography';
import { switchLanguage } from '@/i18n/direction';
import type { Lang } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { timingExit, timingReducedFade } from '@/motion/springs';
import { cartActions } from '@/state/cart.store';
import { testIds } from '@/testIds';

/** Visible ring around the label. The pressable box stays 48 x 48 (accessibility floor). */
const RING = 36;

/**
 * What the button shows: the name of the language it switches TO, in that language's own script.
 * These are fixed names, not translated copy (the same word whichever language the app is in), so
 * they are not in the dictionary.
 */
const SHORT_LABEL: Readonly<Record<Lang, string>> = { en: 'EN', ar: 'ع' };

export const langVeilTestId = `${testIds.langToggle}-veil`;

type VeilProps = { onCovered: () => void };

/** Fades from clear to solid pine, then reports back to the JS thread once, when it is solid. */
function Veil({ onCovered }: VeilProps) {
  const styles = useStyles();
  const reduceMotion = useMotionPreference();
  const opacity = useSharedValue(0);
  const veilStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  // Start once when the veil mounts. The values it reads are the ones from that first render: the
  // veil lives for a fraction of a second, so a later change in either must not restart it.
  useEffect(() => {
    opacity.set(
      withTiming(1, reduceMotion ? timingReducedFade : timingExit, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onCovered);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Animated.View testID={langVeilTestId} style={[styles.veil, veilStyle]} />;
}

export function LanguageToggle() {
  const styles = useStyles();
  const { t, lang } = useT();
  const [switching, setSwitching] = useState(false);
  // A second tap can arrive before React re-renders with `switching` set; the ref closes that gap.
  const busy = useRef(false);
  const next: Lang = lang === 'ar' ? 'en' : 'ar';

  const onPress = () => {
    if (busy.current) return;
    busy.current = true;
    haptics.tap();
    cartActions.commitRemoval();
    setSwitching(true);
  };

  const onCovered = () => {
    switchLanguage(next).catch(() => {
      // The reload did not start: give the screen back instead of leaving a pine wall.
      busy.current = false;
      setSwitching(false);
    });
  };

  return (
    <>
      <PressableScale
        testID={testIds.langToggle}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('lang.toggle')}
        accessibilityHint={t('lang.toggleHint')}
        style={styles.box}
      >
        <View style={styles.ring}>
          {/* The label is in the language it names, so it uses that language's font. */}
          <Text
            variant="label"
            tone="onBrand"
            align="center"
            maxFontSizeMultiplier={1.2}
            style={{ fontFamily: FONT_FAMILY[next].semibold }}
          >
            {SHORT_LABEL[next]}
          </Text>
        </View>
      </PressableScale>
      {switching ? (
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          // Android back must not dismiss the veil halfway through a switch.
          onRequestClose={() => undefined}
        >
          <Veil onCovered={onCovered} />
        </Modal>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  box: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.textOnBrandMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `scrim` is the brand pine in the light scheme, the colour of the Home header the user just tapped.
  veil: { flex: 1, backgroundColor: c.scrim },
}));
