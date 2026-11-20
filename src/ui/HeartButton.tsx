/**
 * The favourite heart on a grid tile and in the product header (L-01's live-change scenario, built).
 *
 * - State comes from one store (`useIsFavorite(id)`), so the tile and the product page can never
 *   disagree: tapping either one flips the same boolean, and both hearts re-render from it.
 * - The pop is played when `on` changes, not on the tap, so a heart that turns on because the
 *   *other* screen was tapped (or because sign-in merged the server's list) pops too.
 *   Turning off gets no pop: celebrating an un-save would be the wrong signal (same rule as the badge).
 * - Transform and opacity only, on the UI thread (F-02). A ring behind the glyph swells and fades
 *   once, for a beat of "it stuck" without a particle system.
 * - Reduced motion: no scale, a short opacity dip of the glyph instead (G-09).
 * - TalkBack hears a checkbox ("Save Omega 3 to favourites, checked"), and the 48 dp box comes from
 *   PressableScale even though the drawn disc is smaller.
 */
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Heart } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { PressableScale } from "@/design/PressableScale";
import { makeStyles, useColors } from "@/design/theme";
import { radius, size } from "@/design/tokens";
import { useT } from "@/i18n/useT";
import { haptics } from "@/motion/haptics";
import { useMotionPreference } from "@/motion/motionPreference";
import {
  spatialFast,
  timingMicro,
  timingReducedFade,
  timingStandard,
} from "@/motion/springs";
import { favoriteActions, useIsFavorite } from "@/state/favorites.store";

/** How far the glyph swells on a save before it springs back. */
export const HEART_POP_SCALE = 1.3;
/** How far the ring grows (relative to the disc) while it fades out. */
export const HEART_RING_SCALE = 1.6;
/** The opacity the reduced-motion variant dips to instead of scaling. */
export const HEART_DIP_OPACITY = 0.4;

const GLYPH = 18;

export type HeartButtonProps = {
  productId: string;
  /** Product name in the current language, for the accessibility label. */
  name: string;
  /** "disc" sits on a picture (surface disc + hairline); "plain" sits in a header row next to other discs. */
  variant?: "disc" | "plain";
  /** Drawn disc diameter; the touch box stays at least 48 dp. */
  discSize?: number;
  testID?: string;
};

export function HeartButton({
  productId,
  name,
  variant = "disc",
  discSize = 32,
  testID,
}: HeartButtonProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const reduceMotion = useMotionPreference();
  const on = useIsFavorite(productId);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const ring = useSharedValue(0);
  const previous = useRef(on);

  useEffect(() => {
    const before = previous.current;
    previous.current = on;
    if (!on || before) return;
    if (reduceMotion) {
      opacity.set(
        withSequence(
          withTiming(HEART_DIP_OPACITY, timingReducedFade),
          withTiming(1, timingReducedFade),
        ),
      );
      return;
    }
    scale.set(
      withSequence(
        withTiming(HEART_POP_SCALE, timingMicro),
        withSpring(1, spatialFast),
      ),
    );
    // 0 → 1 drives both the ring's growth and its fade; it is invisible at both ends.
    ring.set(0);
    ring.set(withTiming(1, timingStandard));
  }, [on, reduceMotion, scale, opacity, ring]);

  const glyphStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  const ringStyle = useAnimatedStyle(() => {
    const p = ring.get();
    return {
      opacity: p > 0 && p < 1 ? 0.5 * (1 - p) : 0,
      transform: [{ scale: 1 + (HEART_RING_SCALE - 1) * p }],
    };
  });

  const handlePress = () => {
    const nowOn = favoriteActions.toggle(productId);
    if (nowOn) haptics.confirm();
    else haptics.tap();
  };

  const disc = {
    width: discSize,
    height: discSize,
    borderRadius: discSize / 2,
  };

  return (
    <PressableScale
      onPress={handlePress}
      accessibilityLabel={t("a11y.favorite", { name })}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      testID={testID}
      style={styles.touch}
      shrinkOnPress={false}
    >
      <View
        style={[styles.disc, variant === "disc" && styles.discFilled, disc]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, disc, { borderColor: c.danger }, ringStyle]}
        />
        <Animated.View style={glyphStyle}>
          <Heart
            size={GLYPH}
            strokeWidth={size.iconStroke}
            color={on ? c.danger : c.textPrimary}
            fill={on ? c.danger : "transparent"}
          />
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  touch: { alignItems: "center", justifyContent: "center" },
  disc: { alignItems: "center", justifyContent: "center" },
  discFilled: {
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    borderRadius: radius.pill,
  },
  ring: { position: "absolute", borderWidth: 2 },
}));
