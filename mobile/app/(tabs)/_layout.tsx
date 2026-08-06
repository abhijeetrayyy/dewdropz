import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

// A real persistent tab navigator (expo-router's <Tabs>, wrapping
// @react-navigation/bottom-tabs) replaces the old hand-copied `<BottomNav/>`
// overlay that every screen used to render for itself — active-tab state,
// safe-area handling, and screen transitions are now the navigator's job,
// not five separate manual placements.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="wishlist" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
