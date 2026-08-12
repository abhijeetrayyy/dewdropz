import { StyleSheet, View, ViewStyle } from "react-native";
import { Rule } from "./Rule";
import { Body, Mono } from "@/components/ui/Type";
import { C, F, S } from "@/lib/theme";

// Key/value rows with a dotted leader between them — the spec-sheet look.
// Replaces v4's `specKRow`, which set the key in uppercase Archivo and the
// value in regular Archivo with nothing tying the two ends of the row
// together, so wide rows read as two unrelated columns.
//
//   MATERIAL ································ Merino-cotton, 180gsm
//   WEIGHT   ································ 340g
//
// Used on Product (specifications), Order detail (totals), Sustainability.

export type SpecRow = { key: string; value: string; emphasis?: boolean };

type Props = { rows: SpecRow[]; tone?: "default" | "onDark"; style?: ViewStyle };

export function SpecTable({ rows, tone = "default", style }: Props) {
  const onDark = tone === "onDark";

  return (
    <View style={style}>
      {rows.map((row, i) => (
        <View key={`${row.key}-${i}`}>
          {i > 0 ? <Rule weight="hair" style={onDark ? { opacity: 0.3 } : undefined} /> : null}
          <View style={s.row}>
            <Mono color={onDark ? "rgba(255,255,255,0.55)" : C.textMuted}>{row.key.toUpperCase()}</Mono>
            {/* The leader: a hairline that fills whatever space the two labels
                don't, so the eye can track across the row without a rule
                under every line. */}
            <View style={[s.leader, onDark && { backgroundColor: "rgba(255,255,255,0.18)" }]} />
            <Body
              color={onDark ? C.paper : C.ink}
              style={[s.value, row.emphasis && { fontFamily: F.bodyBold }]}
            >
              {row.value}
            </Body>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: 13 },
  leader: { flex: 1, height: 1, backgroundColor: C.ruleSoft, minWidth: 16 },
  value: { flexShrink: 1, textAlign: "right" },
});
