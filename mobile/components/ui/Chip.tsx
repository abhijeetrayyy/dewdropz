import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { C, F, R } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

// Filter/category pill. v4's chip was a white card with a shadow, which meant
// a horizontal row of them looked like a row of floating buttons. v5's resting
// state is a ruled outline on paper — flat, quiet, and it lets the *selected*
// chip be the only filled thing in the row, which is the entire job.

type Props = {
  label: string;
  selected?: boolean;
  tone?: "ink" | "meadow";
  /** Trailing count, e.g. "All · 24". Set in mono so it reads as data. */
  count?: number | string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, tone = "ink", count, onPress, style }: Props) {
  const on = !!selected;
  const fill = tone === "meadow" ? C.forest : C.ink;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        if (!onPress) return;
        haptics.select();
        onPress();
      }}
      style={[s.chip, on ? { backgroundColor: fill, borderColor: fill } : s.off, style]}
    >
      <Text style={[s.label, on && s.labelOn]}>{label}</Text>
      {count !== undefined ? (
        <View style={[s.count, on && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Text style={[s.countT, on && { color: C.paper }]}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: R.chip,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderWidth: 1,
  },
  off: { backgroundColor: "transparent", borderColor: C.ruleMed },
  label: { fontFamily: F.bodyMedium, fontSize: 14, color: C.ink, letterSpacing: -0.1 },
  labelOn: { fontFamily: F.bodyBold, color: C.paper },
  count: { backgroundColor: C.cream, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  countT: { fontFamily: F.monoBold, fontSize: 10, color: C.textMid },
});
