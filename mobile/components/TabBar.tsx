import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { C, F, M } from "@/lib/theme";
import { useCartStore } from "@/stores/cart";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

// v4 marked the active tab with a 58×30 mint pill behind the icon — a stray
// third accent color living permanently at the bottom of every screen, and the
// only rounded-rectangle in an app whose whole radius rule is "sharp or fully
// round, nothing between".
//
// v5 marks it the way a printed page marks a running head: a short ink rule
// above the icon, the icon filled, the label in mono. No color needed, and the
// rule visually rhymes with the section rules on every screen above it.

const ICON: Record<string, string> = {
  index: "home",
  shop: "storefront",
  design: "draw",
  cart: "backpack",
  account: "person",
};
const LABEL: Record<string, string> = {
  index: "Home",
  shop: "Shop",
  design: "Studio",
  cart: "Pack",
  account: "You",
};

function TabMark({ focused }: { focused: boolean }) {
  const w = useSharedValue(focused ? 16 : 0);
  useEffect(() => {
    w.value = withTiming(focused ? 16 : 0, { duration: M.base });
  }, [focused, w]);
  const style = useAnimatedStyle(() => ({ width: w.value, opacity: w.value / 16 }));
  return <Animated.View style={[s.mark, style]} />;
}

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

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const badge = route.name === "cart" ? cartCount : 0;

        return (
          <TouchableOpacity
            key={route.key}
            style={s.tab}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABEL[route.name] ?? route.name}
            onPress={() => {
              if (!focused) haptics.select();
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <TabMark focused={focused} />
            <View style={s.iconWrap}>
              <Icon
                name={ICON[route.name] ?? "home"}
                size={22}
                color={focused ? C.ink : C.textMuted}
                filled={focused}
              />
              <Badge count={badge} />
            </View>
            <Text style={[s.label, focused && s.labelActive]}>{(LABEL[route.name] ?? route.name).toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 0,
    paddingHorizontal: 4,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.ruleSoft,
  },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  // Sits flush against the bar's top rule, so the active mark reads as a
  // thickening of that rule rather than a floating dash.
  mark: { height: 2, backgroundColor: C.ink, marginBottom: 8 },
  iconWrap: { marginTop: 0 },
  label: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.1, color: C.textMuted },
  labelActive: { fontFamily: F.monoBold, color: C.ink },
});
