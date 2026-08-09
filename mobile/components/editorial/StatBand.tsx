import { StyleSheet, View, ViewStyle } from "react-native";
import { Display2, Mono } from "@/components/ui/Type";
import { C, S } from "@/lib/theme";

// A 2×2 grid of big numerals with mono labels under them, divided by rules.
// Used on About ("12,000+ trekkers geared up") and in the order-detail summary.
//
// The numerals are Bricolage 800 rather than mono: mono numerals are for data
// you scan in a column, display numerals are for data you're meant to feel.

export type Stat = { value: string; label: string };

type Props = { stats: Stat[]; tone?: "default" | "onDark"; style?: ViewStyle };

export function StatBand({ stats, tone = "default", style }: Props) {
  const onDark = tone === "onDark";
  const line = onDark ? "rgba(255,255,255,0.16)" : C.ruleSoft;

  return (
    <View style={[s.grid, style]}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={[
            s.cell,
            // Interior rules only — no border on the outer edges of the grid,
            // which is what makes it read as a table rather than four boxes.
            i % 2 === 0 && { borderRightWidth: 1, borderRightColor: line },
            i < stats.length - 2 && { borderBottomWidth: 1, borderBottomColor: line },
          ]}
        >
          <Display2 color={onDark ? C.paper : C.ink}>{stat.value}</Display2>
          <Mono color={onDark ? "rgba(255,255,255,0.6)" : C.textMuted} style={{ marginTop: 8 }}>
            {stat.label.toUpperCase()}
          </Mono>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", paddingVertical: S.lg, paddingRight: S.md },
});
