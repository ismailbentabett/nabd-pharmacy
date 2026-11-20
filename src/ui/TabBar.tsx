/**
 * The bottom tab bar: Home, Category, Cart, Account. A custom bar for expo-router's JS tabs, so we own
 * its motion and its accessibility.
 *
 * The selected-tab pill slides between tabs on a spring, on the UI thread (F-02): `position` is a
 * shared value and the pill only reads it inside `useAnimatedStyle`. The tab width is measured once
 * by `onLayout` (a layout event, not a per-frame update). Reduced motion moves the pill instantly.
 *
 * The pill starts moving in the press handler itself, before navigation, so it answers the finger
 * on the next frame even when the screen it opens is slow to mount (F-03). The effect on
 * `state.index` still runs for navigation that is not a tap (a link, Android back); by then the
 * spring is already heading to that index, and re-targeting it keeps its velocity.
 *
 * RTL: the row is a normal flex row, so React Native mirrors the tab order for Arabic. The pill is
 * pinned to `start` and translated by `dir * distance`, because transforms do not mirror (G-08).
 *
 * The bar reads the cart count through a selector (`useCartCount`), so adding to the cart
 * re-renders the bar and its badge. No grid or list row subscribes to the count, so the grid never
 * re-renders for it (F-05).
 */
import { CircleUser, House, LayoutGrid, ShoppingBag, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useDirection } from '@/i18n/direction';
import type { MessageKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { useMotionPreference } from '@/motion/motionPreference';
import { spatialDefault } from '@/motion/springs';
import { useCartCount } from '@/state/cart.store';
import { testIds, type TabRouteName } from '@/testIds';

import { CartBadge } from './CartBadge';

/** The pill behind the active icon (Material 3 navigation bar proportions). */
export const INDICATOR_WIDTH = 64;
export const INDICATOR_HEIGHT = 32;

const TAB_META: Readonly<Record<TabRouteName, { icon: LucideIcon; label: MessageKey }>> = {
  index: { icon: House, label: 'tab.home' },
  category: { icon: LayoutGrid, label: 'tab.category' },
  cart: { icon: ShoppingBag, label: 'tab.cart' },
  account: { icon: CircleUser, label: 'tab.account' },
};

const TAB_NAMES: ReadonlySet<string> = new Set(Object.keys(TAB_META));

function isTabRoute(name: string): name is TabRouteName {
  return TAB_NAMES.has(name);
}

/** Where the pill sits for a (fractional) tab position: centred under that tab's icon. */
export function indicatorOffset(position: number, tabWidth: number): number {
  'worklet';
  return position * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2;
}

export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const styles = useStyles();
  const colors = useColors();
  const { t, tn } = useT();
  const { dir } = useDirection();
  const reduceMotion = useMotionPreference();
  const cartCount = useCartCount();

  const position = useSharedValue(state.index);
  const tabWidth = useSharedValue(0);

  const moveIndicatorTo = (index: number) => {
    position.set(reduceMotion ? index : withSpring(index, spatialDefault));
  };

  useEffect(() => {
    position.set(reduceMotion ? state.index : withSpring(state.index, spatialDefault));
  }, [state.index, reduceMotion, position]);

  const onRowLayout = (event: LayoutChangeEvent) => {
    tabWidth.set(event.nativeEvent.layout.width / Math.max(state.routes.length, 1));
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const width = tabWidth.get();
    return {
      // Hidden until the row has been measured, so the pill never flashes at the wrong spot.
      opacity: width > 0 ? 1 : 0,
      transform: [{ translateX: dir * indicatorOffset(position.get(), width) }],
    };
  });

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View testID={testIds.tabRow} accessibilityRole="tablist" style={styles.row} onLayout={onRowLayout}>
        <Animated.View testID={testIds.tabIndicator} style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
        {state.routes.map((route, index) => {
          if (!isTabRoute(route.name)) return null;
          const meta = TAB_META[route.name];
          const Icon = meta.icon;
          const focused = state.index === index;
          const label = t(meta.label);
          // The cart tab's whole label is one plural entry ("Cart, 2 items"), so each language puts
          // the count where its grammar wants it instead of us gluing two strings together.
          const a11yLabel = route.name === 'cart' ? tn('a11y.cartTab', cartCount) : label;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (focused || event.defaultPrevented) return;
            haptics.tap();
            moveIndicatorTo(index);
            navigateToTab(route.key);
          };
          const onLongPress = () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <PressableScale
              key={route.key}
              testID={testIds.tab[route.name]}
              accessibilityRole="tab"
              accessibilityLabel={a11yLabel}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              onLongPress={onLongPress}
              shrinkOnPress={false}
              style={styles.tab}
            >
              <View style={styles.iconBox}>
                {/* The badge is positioned against the icon, not the 64-wide pill box, so it sits
                    on the bag's top-end corner at any pill size. */}
                <View style={styles.iconAnchor}>
                  <Icon
                    size={size.icon}
                    strokeWidth={size.iconStroke}
                    color={focused ? colors.textPrimary : colors.textMuted}
                  />
                  {route.name === 'cart' ? <CartBadge count={cartCount} /> : null}
                </View>
              </View>
              <Text
                variant="label"
                weight={focused ? 'semibold' : 'medium'}
                tone={focused ? 'primary' : 'muted'}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    backgroundColor: c.bgSurface,
    borderTopWidth: size.hairline,
    borderTopColor: c.lineHairline,
  },
  row: { flexDirection: 'row' },
  indicator: {
    position: 'absolute',
    top: space.sm,
    start: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: c.bgSunken,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: space.xs,
    gap: space.xxs,
  },
  iconBox: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAnchor: { width: size.icon, height: size.icon },
}));
