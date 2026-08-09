import { forwardRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/Button";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Mono } from "@/components/ui/Type";
import { C, F, R, S } from "@/lib/theme";

// Generic measurement chart (measured flat, cm). The catalogue has no
// per-product measurement columns yet, so this is a shared reference table
// rather than per-product data — worth knowing before anyone trusts it as
// exact for a specific piece.
const ROWS = [
  { size: "S", chest: 98, length: 68, sleeve: 61 },
  { size: "M", chest: 104, length: 70, sleeve: 63 },
  { size: "L", chest: 110, length: 72, sleeve: 65 },
  { size: "XL", chest: 116, length: 74, sleeve: 67 },
];

type Props = { currentSize?: string; onPickSize: (size: string) => void; onClose: () => void };

export const SizeGuideSheet = forwardRef<BottomSheetModal, Props>(({ currentSize, onPickSize, onClose }, ref) => {
  return (
    <Sheet ref={ref} snapPoints={["70%"]} eyebrow="Measured flat, in cm" title="Size guide" onClose={onClose}>
      {/* A real table: mono column heads, ruled rows, numerals in mono so the
          columns line up optically. v4 set the measurements in Archivo, which
          has proportional figures — the columns visibly wandered. */}
      <View style={s.head}>
        <Mono color={C.textMuted} style={{ flex: 1.2 }}>
          SIZE
        </Mono>
        <Mono color={C.textMuted} style={s.col}>
          CHEST
        </Mono>
        <Mono color={C.textMuted} style={s.col}>
          LENGTH
        </Mono>
        <Mono color={C.textMuted} style={s.col}>
          SLEEVE
        </Mono>
      </View>
      <Rule weight="ink" />

      {ROWS.map((r, i) => {
        const active = r.size === currentSize;
        return (
          <View key={r.size}>
            {i > 0 ? <Rule weight="hair" /> : null}
            <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => onPickSize(r.size)}>
              <View style={{ flex: 1.2, flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={[s.size, active && s.sizeOn]}>{r.size}</Text>
                {active ? (
                  <View style={s.yours}>
                    <Text style={s.yoursT}>YOURS</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.cell, active && s.cellOn]}>{r.chest}</Text>
              <Text style={[s.cell, active && s.cellOn]}>{r.length}</Text>
              <Text style={[s.cell, active && s.cellOn]}>{r.sleeve}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <Rule weight="soft" />

      <View style={s.note}>
        <Icon name="info" size={18} color={C.meadow} />
        <Body color={C.textMid} style={{ flex: 1 }}>
          Runs true to size. Between two? Size up — everything here is cut for a relaxed fit.
        </Body>
      </View>

      <Button
        title={currentSize ? `Keep size ${currentSize}` : "Close"}
        variant="dark"
        onPress={() => (currentSize ? onPickSize(currentSize) : onClose())}
        style={{ marginTop: S.lg, width: "100%" }}
      />
      <Mono color={C.textFaint} style={{ textAlign: "center", marginTop: S.md }}>
        FREE SIZE EXCHANGE WITHIN 7 DAYS
      </Mono>
    </Sheet>
  );
});

SizeGuideSheet.displayName = "SizeGuideSheet";

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", paddingBottom: 10 },
  col: { flex: 1, textAlign: "right" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: S.md },
  size: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },
  sizeOn: { color: C.meadowDeep },
  yours: { backgroundColor: C.meadow12, borderRadius: R.tag, paddingHorizontal: 5, paddingVertical: 2 },
  yoursT: { fontFamily: F.monoBold, fontSize: 8, letterSpacing: 0.8, color: C.meadowDeep },
  cell: { flex: 1, fontFamily: F.mono, fontSize: 13, color: C.textMid, textAlign: "right" },
  cellOn: { fontFamily: F.monoBold, color: C.ink },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: S.lg },
});
