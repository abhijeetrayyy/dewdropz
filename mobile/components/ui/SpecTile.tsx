import { StyleSheet, Text, View } from "react-native";
import { C, F, R, SHADOW } from "@/lib/theme";
import { Icon } from "./Icon";

// The 4-across spec row on Product (altitude / weight / waterproofing / build).
export function SpecTile({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={s.tile}>
      <Icon name={icon} size={20} color={C.textMid} />
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tile: { flex: 1, alignItems: "center", gap: 3, backgroundColor: C.surface, borderRadius: R.chip, paddingVertical: 10, paddingHorizontal: 4, ...SHADOW, shadowOpacity: 0.05 },
  value: { fontFamily: F.bodyBold, fontSize: 13, color: C.ink },
});
