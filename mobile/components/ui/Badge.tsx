import { StyleSheet, Text, View } from "react-native";
import { C, F } from "@/lib/theme";

// Count badge on the Pack tab. Marigold is reserved for exactly this class of
// mark — badges, scarcity flags, stars — and is never a button fill, which is
// what keeps ember unambiguous as "this is the buy action".
//
// The paper ring around it matters: without it the badge merges into a dark
// icon behind it at small sizes.
export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={s.badge}>
      {/* The one place a scaling clamp is the right call rather than a dodge.
          This badge is pinned to the corner of a tab icon: it cannot grow
          without covering the icon it annotates, so letting 9px run to ~28px
          would break the thing it is describing. It is also not the
          authoritative number — the Pack screen is, at full scale — so
          clamping the glance and leaving the destination unclamped keeps the
          count readable without turning the tab bar into a lost cause. */}
      <Text style={s.t} maxFontSizeMultiplier={1.6}>
        {count > 9 ? "9+" : count}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -3,
    right: -11,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 999,
    backgroundColor: C.clay,
    borderWidth: 1.5,
    borderColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  t: { fontFamily: F.monoBold, fontSize: 9, color: C.ink, letterSpacing: 0 },
});
