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
      <Text style={s.t}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -3,
    right: -11,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: C.marigold,
    borderWidth: 1.5,
    borderColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  t: { fontFamily: F.monoBold, fontSize: 9, color: C.ink, letterSpacing: 0 },
});
