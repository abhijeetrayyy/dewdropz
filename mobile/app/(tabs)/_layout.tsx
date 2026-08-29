import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

// A real persistent tab navigator (expo-router's <Tabs>, wrapping
// @react-navigation/bottom-tabs) replaces the old hand-copied `<BottomNav/>`
// overlay that every screen used to render for itself — active-tab state,
// safe-area handling, and screen transitions are now the navigator's job,
// not five separate manual placements.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The bar floats over the content (see components/TabBar.tsx), so the
        // scene must fill the whole window rather than being inset above it.
        tabBarStyle: { position: "absolute", borderTopWidth: 0, backgroundColor: "transparent" },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="rent" />
      <Tabs.Screen name="design" />
      {/* Still a tab ROUTE — it keeps its URL and its state — but `href: null`
          takes it out of the bar. The pack is reached from the masthead icon,
          which carries the count. */}
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
