import { forwardRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Rule } from "@/components/editorial/Rule";
import { Button } from "@/components/Button";
import { Eyebrow, Title } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

export type PriceBucket = "all" | "under-1500" | "1500-3000" | "over-3000";
export type SortKey = "newest" | "price-asc" | "price-desc";

export type ShopFilters = {
  price: PriceBucket;
  inStockOnly: boolean;
  sort: SortKey;
};

const PRICE_BUCKETS: { key: PriceBucket; label: string }[] = [
  { key: "all", label: "Any price" },
  { key: "under-1500", label: "Under ₹1,500" },
  { key: "1500-3000", label: "₹1,500 – ₹3,000" },
  { key: "over-3000", label: "Over ₹3,000" },
];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

type Props = { filters: ShopFilters; onChange: (f: ShopFilters) => void; onClear: () => void; resultCount: number };

// Real store filters (price, stock, sort) — the design mock's altitude/weight/
// conditions axes don't exist on this catalogue.
//
// The sheet header (eyebrow, title, close, rule) now comes from `Sheet` itself,
// so this file only describes the controls. Sections are separated by rules
// and mono eyebrows, matching every other section head in the app.
export const FilterSheet = forwardRef<BottomSheetModal, Props>(({ filters, onChange, onClear, resultCount }, ref) => {
  const set = (patch: Partial<ShopFilters>) => {
    haptics.select();
    onChange({ ...filters, ...patch });
  };

  const dismiss = () => (ref as any)?.current?.dismiss();

  return (
    <Sheet ref={ref} snapPoints={["74%"]} eyebrow="Refine" title="Filter & sort" onClose={dismiss}>
      <Section eyebrow="Price">
        <View style={s.row}>
          {PRICE_BUCKETS.map((b) => (
            <Chip key={b.key} label={b.label} selected={filters.price === b.key} onPress={() => set({ price: b.key })} />
          ))}
        </View>
      </Section>

      <Section eyebrow="Sort by">
        <View style={s.row}>
          {SORTS.map((o) => (
            <Chip key={o.key} label={o.label} selected={filters.sort === o.key} onPress={() => set({ sort: o.key })} />
          ))}
        </View>
      </Section>

      <Rule weight="soft" />
      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Title>In stock only</Title>
          <Text style={s.toggleSub}>Hide pieces we&apos;re currently out of</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityState={{ checked: filters.inStockOnly }}
          onPress={() => set({ inStockOnly: !filters.inStockOnly })}
          style={[s.toggle, filters.inStockOnly && s.toggleOn]}
        >
          <View style={s.knob} />
        </TouchableOpacity>
      </View>
      <Rule weight="soft" />

      <View style={s.actions}>
        <Button title="Reset" variant="quiet" onPress={onClear} style={{ flex: 1 }} />
        <Button title={`Show ${resultCount}`} variant="dark" onPress={dismiss} style={{ flex: 1.4 }} />
      </View>
    </Sheet>
  );
});

FilterSheet.displayName = "FilterSheet";

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: S.xl }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Rule weight="soft" style={{ marginTop: 9, marginBottom: S.md }} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.lg },
  toggleSub: { fontFamily: F.body, fontSize: 13, color: C.textMuted, marginTop: 3 },
  toggle: { width: 48, height: 28, borderRadius: 999, backgroundColor: C.disabledBg, padding: 3, justifyContent: "center" },
  toggleOn: { backgroundColor: C.forest, alignItems: "flex-end" },
  knob: { width: 22, height: 22, borderRadius: 999, backgroundColor: C.white },
  actions: { flexDirection: "row", gap: S.sm, marginTop: S.xl },
});
