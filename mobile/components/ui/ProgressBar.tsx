import { View } from "react-native";
import { C } from "@/lib/theme";

// Track + fill bar — pack readiness, field-report fit/warmth/dry meters.
export function ProgressBar({ pct, height = 8, trackColor = C.sand, fillColor = C.meadow }: { pct: number; height?: number; trackColor?: string; fillColor?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: trackColor, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", borderRadius: 999, backgroundColor: fillColor }} />
    </View>
  );
}
