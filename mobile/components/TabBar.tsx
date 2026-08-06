import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Home, Search, ShoppingBag, Heart, User, LucideIcon } from "lucide-react-native";
import { C, F } from "@/lib/theme";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { haptics } from "@/lib/haptics";

const ICONS: Record<string, LucideIcon> = { index: Home, shop: Search, cart: ShoppingBag, wishlist: Heart, account: User };
const LABELS: Record<string, string> = { index: "Home", shop: "Shop", cart: "Cart", wishlist: "Saved", account: "Account" };

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(focused ? 1.16 : 1, { damping: 10, stiffness: 200 });
  }, [focused, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Icon size={22} strokeWidth={focused ? 2.25 : 1.75} color={focused ? C.forest : C.light} fill={focused && Icon === Heart ? C.forest : "transparent"} />
    </Animated.View>
  );
}

// expo-router's <Tabs tabBar={...}> forwards @react-navigation/bottom-tabs'
// standard tabBar render-prop shape; that package isn't a direct dependency
// here (only nested under expo-router), so this types just the slice used.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount());
  const wishlistCount = useWishlistStore((s) => s.count());

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + 10 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name] ?? Home;
        const label = LABELS[route.name] ?? route.name;
        const badge = route.name === "cart" ? cartCount : route.name === "wishlist" ? wishlistCount : 0;

        return (
          <TouchableOpacity
            key={route.key}
            style={s.tab}
            activeOpacity={0.6}
            onPress={() => {
              if (!focused) haptics.select();
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            {focused && <View style={s.activeDot} />}
            <View>
              <TabIcon Icon={Icon} focused={focused} />
              {badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeT}>{badge > 99 ? "99+" : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 14,
    paddingHorizontal: 8,
    backgroundColor: C.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.rule,
  },
  tab: { alignItems: "center", gap: 5, paddingHorizontal: 12, minWidth: 56 },
  activeDot: { position: "absolute", top: -14, width: 4, height: 4, borderRadius: 2, backgroundColor: C.forest },
  label: { fontFamily: F.bodyBold, fontSize: 10, color: C.light },
  labelActive: { color: C.forest },
  badge: {
    position: "absolute", top: -5, right: -9, minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: C.forest, alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  badgeT: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
