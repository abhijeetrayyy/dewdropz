import { StyleSheet, View, ViewStyle } from "react-native";
import { Micro, Mono } from "@/components/ui/Type";
import { MONTHS } from "@/lib/trails";
import { C, R } from "@/lib/theme";

// Twelve cells, the good ones filled. Season is the single most consequential
// call on any of these trails — the same route is a snow climb in January and
// a meadow walk in September — and a strip communicates that in one glance
// where a sentence needs reading.
//
// Colour alone can't carry it (and shouldn't have to): the in-season cells
// also get the bolder mono cut and full-opacity ink, and every cell carries an
// accessibility label spelling out the month and whether it's in season.
export function MonthStrip({ months, style }: { months: string[]; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Micro color={C.textMuted} style={{ marginBottom: 7 }}>
        WHEN TO GO
      </Micro>
      <View style={s.row} accessibilityRole="summary" accessibilityLabel={`Best months: ${months.join(", ")}`}>
        {MONTHS.map((m) => {
          const good = months.includes(m);
          return (
            <View
              key={m}
              style={[s.cell, good ? s.cellOn : s.cellOff]}
              accessibilityLabel={`${m}${good ? ", in season" : ", out of season"}`}
            >
              <Mono color={good ? C.paper : C.textFaint} style={good ? s.onText : undefined}>
                {m[0]}
              </Mono>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 3 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: R.tag },
  cellOn: { backgroundColor: C.forest },
  cellOff: { backgroundColor: C.cream },
  onText: { fontWeight: "700" },
});
