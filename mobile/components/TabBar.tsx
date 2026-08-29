import { useEffect } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { C, F, M, S } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

// ─────────────────────────────────────────────────────────────────────────────
// The tab bar, floating.
// ─────────────────────────────────────────────────────────────────────────────
// v6 was an opaque paper strip pinned edge-to-edge with a hairline above it —
// correct, legible, and the single element that most made the app read as a
// template. Content ran into it and stopped; nothing passed behind anything.
//
// This floats a dark pill above the content instead, so the page continues
// underneath and the bar reads as an object resting on the app rather than a
// wall at the bottom of it. Three things make that work:
//
//   1. The container is taken OUT of layout flow (`position: absolute`) so the
//      page genuinely runs underneath rather than stopping short of the bar.
//      That means the navigator no longer insets screens for it, so every tab
//      screen pads itself by `useTabBarSpace()` — the one contract this file
//      exports. Get that wrong on a screen and its last row hides behind the
//      pill, which is the cost of the effect and the reason the hook exists
//      rather than a copied magic number.
//   2. `pointerEvents: box-none` on the container, so the transparent margin
//      either side of the pill doesn't eat taps meant for content beneath it.
//   3. Ink, not glass. iOS could blur here, but Android's BlurView needs a
//      `blurTarget` ref pointing at a wrapper around the scrolling content —
//      a per-screen architectural change for a material that would then differ
//      between platforms anyway. A solid ink pill is the same object on both,
//      and it holds the white glyphs at any scroll position over any
//      photograph. The blur is a subtle addition on iOS only, under the ink.
// ─────────────────────────────────────────────────────────────────────────────

/** Pill height: icon + label + dot + vertical padding. */
const PILL_H = 62;
/** Air between the pill and the safe-area edge. */
const PILL_GAP = 10;

/**
 * Vertical space a tab screen must reserve at the bottom of its scroll content
 * so the last row clears the floating bar.
 *
 * Every tab screen adds this to its `contentContainerStyle.paddingBottom`, and
 * anything pinned to the bottom of a tab screen (the cart's summary bar) offsets
 * itself by it.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return PILL_H + PILL_GAP + Math.max(insets.bottom, 10);
}

// Rent replaces Pack in the bar. Renting is the second-largest commerce
// surface in the business — its own inventory, availability and lifecycle —
// and it was a row buried in the account list, while the pack (a destination
// you visit with intent, once, at the end) held a permanent fifth of the bar.
// The pack moved to the masthead with its badge, where every commerce app on a
// phone keeps it.
const ICON: Record<string, string> = {
  index: "home",
  shop: "storefront",
  rent: "camping",
  design: "draw",
  account: "person",
};
const LABEL: Record<string, string> = {
  index: "Home",
  shop: "Shop",
  rent: "Rent",
  design: "Studio",
  account: "You",
};

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[s.container, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={s.pill}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, s.pillFill]} />

        {/* ICON is the guest list, not just a lookup.
            `href: null` on a Tabs.Screen removes a route from expo-router's
            OWN bar — it does nothing here, because this custom bar renders
            `state.routes` directly, and the pack duly appeared as a sixth tab
            after it was supposed to have left. Rendering only the routes this
            bar has an identity for keeps the two in step: to remove a tab,
            remove it from ICON and LABEL. */}
        {state.routes
          .map((route, index) => ({ route, index }))
          .filter(({ route }) => route.name in ICON)
          .map(({ route, index }) => {
          const focused = state.index === index;
          const badge = 0;

          return (
            <Tab
              key={route.key}
              name={route.name}
              focused={focused}
              badge={badge}
              onPress={() => {
                if (!focused) haptics.select();
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tab({
  name,
  focused,
  badge,
  onPress,
}: {
  name: string;
  focused: boolean;
  badge: number;
  onPress: () => void;
}) {
  // The active tab lifts and brightens; the inactive ones sit back. Springing
  // the lift rather than fading it is what makes the row feel physical.
  const lift = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    lift.value = focused
      ? withSpring(1, { damping: 15, stiffness: 180 })
      : withTiming(0, { duration: M.fast });
  }, [focused, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * lift.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ scale: 0.4 + 0.6 * lift.value }],
  }));

  return (
    <TouchableOpacity
      style={s.tab}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={LABEL[name] ?? name}
      onPress={onPress}
    >
      <Animated.View style={[s.iconWrap, iconStyle]}>
        <Icon
          name={ICON[name] ?? "home"}
          size={22}
          color={focused ? C.paper : "rgba(251,247,239,0.5)"}
          filled={focused}
        />
        <Badge count={badge} />
      </Animated.View>
      {/* Clamped, like Apple's own tab bar, which stops scaling its labels and
          relayouts rather than growing the bar. PILL_H is a fixed 62 and
          `useTabBarSpace()` publishes it to all five tab screens as their
          bottom padding — a pill that grew to fit 26px labels would both eat
          the screen and silently invalidate every one of those reservations.
          The label is the redundant channel here: the icon, the active dot and
          the destination's own masthead all still scale. */}
      <Text style={[s.label, focused && s.labelActive]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {(LABEL[name] ?? name).toUpperCase()}
      </Text>
      <Animated.View style={[s.dot, dotStyle]} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // Transparent and in-flow: this is what the navigator measures to inset
  // screens, so it must keep real height.
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: S.md,
    paddingTop: S.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 26,
    overflow: "hidden",
    paddingVertical: 11,
    paddingHorizontal: 4,
    // Lifted off the page. On Android `elevation` is what actually casts the
    // shadow; the iOS shadow* props are ignored there and vice versa, so both
    // are set.
    shadowColor: "#0A0F0C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 12,
  },
  // Under the blur on iOS, alone on Android — and that difference is why the
  // alpha can't be shared. On iOS the BlurView beneath diffuses whatever the
  // remaining 6% lets through, so it reads as depth. Android has no blur under
  // it (see IconButton for why expo-blur's Android path needs a BlurTargetView),
  // so the same 6% renders the background SHARP: on Home the marquee's
  // "MONSOON WINDOW · OPEN NOW" and the topographic contours ghost straight
  // through the bar, which reads as a rendering fault rather than as glass.
  // Opaque on Android is the honest translation of the same intent.
  pillFill: {
    backgroundColor: Platform.OS === "ios" ? "rgba(16,21,18,0.94)" : C.ink,
  },

  tab: { flex: 1, alignItems: "center", gap: 3 },
  iconWrap: {},
  label: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 1, color: "rgba(251,247,239,0.5)" },
  labelActive: { fontFamily: F.monoBold, color: C.paper },
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: C.sage, marginTop: 1 },
});
