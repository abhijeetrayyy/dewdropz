import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { MONTHS } from "@/lib/trails";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

// "When are you free?" — the first question anyone asks a trail guide, and the
// one this data answers exactly, because every trail carries its own
// `bestMonths`.
//
// Distinct from MonthStrip, which shows ONE trail's season as a read-only
// twelve-cell bar. This is the inverse: pick a month, see which trails are
// walkable. Same underlying field, opposite direction.
//
// Defaults to the current month, because the overwhelmingly common case is
// someone wondering what they can do now — and a guide that opens on "all 8
// trails" has answered nothing.
export function MonthFilter({
  value,
  counts,
  onChange,
}: {
  /** Selected month, or null for "any time of year". */
  value: string | null;
  /** Trails walkable per month, so a dead month can say so before it's tapped. */
  counts: Record<string, number>;
  onChange: (month: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
    >
      <TouchableOpacity
        style={[s.chip, value === null && s.chipOn]}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
        accessibilityLabel="Any time of year"
        onPress={() => {
          haptics.select();
          onChange(null);
        }}
      >
        <Text style={[s.t, value === null && s.tOn]}>Any month</Text>
      </TouchableOpacity>

      {MONTHS.map((m) => {
        const on = value === m;
        const n = counts[m] ?? 0;
        return (
          <TouchableOpacity
            key={m}
            style={[s.chip, on && s.chipOn, n === 0 && !on && s.chipEmpty]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${m}, ${n} ${n === 1 ? "trail" : "trails"}`}
            onPress={() => {
              haptics.select();
              onChange(on ? null : m);
            }}
          >
            <Text style={[s.t, on && s.tOn, n === 0 && !on && s.tEmpty]}>{m}</Text>
            {/* The count is the useful part: it turns the strip into a
                calendar of how busy the range is, month by month. */}
            <Text style={[s.n, on && s.nOn, n === 0 && !on && s.tEmpty]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { gap: 7, paddingHorizontal: S.gutter, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.ruleMed,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipOn: { backgroundColor: C.forest, borderColor: C.forest },
  chipEmpty: { borderColor: C.ruleHair },
  t: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  tOn: { color: C.paper },
  tEmpty: { color: C.textFaint },
  n: { fontFamily: F.monoBold, fontSize: 10, color: C.textMuted },
  nOn: { color: "rgba(251,247,239,0.75)" },
});
