/**
 * The three tabs (G-01) with our own tab bar. `lazy` mounts a tab the first time it is opened and
 * then keeps it mounted, so the Category grid keeps its scroll position and filters when the user
 * switches tabs and comes back.
 */
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';

import { TabBar } from '@/ui/TabBar';

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

export default function TabsLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false, lazy: true }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="category" />
      <Tabs.Screen name="cart" />
    </Tabs>
  );
}
