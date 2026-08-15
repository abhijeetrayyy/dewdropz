import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { C, F, R, S } from "@/lib/theme";

// The reassurance row every Indian storefront carries — COD, returns, free
// shipping — placed directly under the search/filter furniture where it answers
// the questions that otherwise stall a first order.
//
// Deliberately factual: each of these maps to something the app actually does
// (lib/constants.ts thresholds, the COD-only checkout, the 7-day returns copy on
// the product screen). Nothing here is a claim the rest of the app contradicts.
const ITEMS = [
  { icon: "local_shipping", label: `Free over ${formatPrice(FREE_SHIPPING_THRESHOLD_PAISE)}` },
  { icon: "payments", label: "Cash on delivery" },
  { icon: "restart_alt", label: "7-day returns" },
  { icon: "verified", label: "Field-tested" },
] as const;

export function PromoStrip() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
      accessibilityRole="list"
    >
      {ITEMS.map((it) => (
        <View key={it.label} style={s.chip}>
          <Icon name={it.icon} size={14} color={C.forestDeep} />
          <Text style={s.t}>{it.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { gap: 7, paddingHorizontal: S.gutter, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.forest12,
    borderRadius: R.chip,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  t: { fontFamily: F.bodyMedium, fontSize: 12, color: C.forestDeep },
});
