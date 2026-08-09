import { StyleSheet, Text, View } from "react-native";
import { C, F } from "@/lib/theme";

// Checkout's 1-2-3 step tracker (screens 17/18: Delivery / Payment / done).
type Step = { label: string };
export function StepIndicator({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <View style={s.row}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={step.label} style={s.stepGroup}>
            <View style={[s.dot, done && s.dotDone, active && s.dotActive]}>
              {done ? (
                <Text style={s.checkT}>✓</Text>
              ) : (
                <Text style={[s.dotT, active && s.dotTActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[s.label, (active || done) && s.labelOn]}>{step.label}</Text>
            {i < steps.length - 1 && <View style={[s.line, (done || active) && i < current && s.lineDone]} />}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepGroup: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  dot: { width: 26, height: 26, borderRadius: 999, backgroundColor: C.sand, alignItems: "center", justifyContent: "center" },
  dotActive: { backgroundColor: C.meadow },
  dotDone: { backgroundColor: C.meadow12 },
  dotT: { fontFamily: F.bodyBold, fontSize: 13, color: C.textFaint },
  dotTActive: { color: C.white },
  checkT: { fontSize: 13, fontWeight: "700", color: C.meadowDeep },
  label: { fontFamily: F.bodyMedium, fontSize: 13, color: C.textFaint },
  labelOn: { fontFamily: F.bodyBold, color: C.ink },
  line: { flex: 1, height: 2, backgroundColor: C.sand },
  lineDone: { backgroundColor: C.meadow },
});
