import { useMemo, useRef, useState, useEffect } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Search, X, SlidersHorizontal } from "lucide-react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductCard } from "@/components/ProductCard";
import { Header } from "@/components/Header";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { haptics } from "@/lib/haptics";
import { C, F, R } from "@/lib/theme";

type SortKey = "newest" | "price-asc" | "price-desc";
type PriceBucket = "all" | "under-1500" | "1500-3000" | "over-3000";

const PRICE_BUCKETS: { key: PriceBucket; label: string }[] = [
  { key: "all", label: "Any price" },
  { key: "under-1500", label: "Under ₹1,500" },
  { key: "1500-3000", label: "₹1,500 – ₹3,000" },
  { key: "over-3000", label: "Over ₹3,000" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
];

export default function ShopScreen() {
  const { data: products = [], isLoading, isError, refetch } = useProductsQuery();
  const { data: collections = [] } = useCollectionsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [collectionSlug, setCollectionSlug] = useState<string | null>(null);
  const [priceBucket, setPriceBucket] = useState<PriceBucket>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  // Debounce search input so filtering doesn't re-run the whole list on
  // every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const sheetRef = useRef<BottomSheetModal>(null);

  const filtered = useMemo(() => {
    let list = products.filter((p: any) => {
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
      if (collectionSlug && p.collection?.slug !== collectionSlug) return false;
      if (priceBucket === "under-1500" && p.price >= 150000) return false;
      if (priceBucket === "1500-3000" && (p.price < 150000 || p.price > 300000)) return false;
      if (priceBucket === "over-3000" && p.price <= 300000) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a: any, b: any) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a: any, b: any) => b.price - a.price);
    return list;
  }, [products, search, collectionSlug, priceBucket, sort]);

  const activeFilterCount = (collectionSlug ? 1 : 0) + (priceBucket !== "all" ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  function clearFilters() {
    haptics.select();
    setCollectionSlug(null);
    setPriceBucket("all");
    setSort("newest");
    setSearchInput("");
  }

  return (
    <View style={s.root}>
      <Header />
      <ScrollView
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
      >
        <View style={s.h}>
          <Text style={s.hT}>Catalogue</Text>
          <Text style={s.hS}>Equipment for the miles that turn into stories.</Text>
        </View>

        <View style={s.fb}>
          <View style={s.sr}>
            <Search size={16} strokeWidth={1.5} color={C.light} />
            <TextInput placeholder="Search gear..." placeholderTextColor={C.light} value={searchInput} onChangeText={setSearchInput} style={s.si} />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => setSearchInput("")}>
                <X size={16} strokeWidth={1.5} color={C.light} />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.filterRow}>
            <TouchableOpacity style={s.filterBtn} onPress={() => sheetRef.current?.present()} activeOpacity={0.8}>
              <SlidersHorizontal size={14} strokeWidth={1.5} color={C.text} />
              <Text style={s.filterBtnT}>Filter & Sort</Text>
              {activeFilterCount > 0 && (
                <View style={s.filterCount}>
                  <Text style={s.filterCountT}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={s.cnt}>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {isError ? (
          <ErrorState message="Couldn't load the catalogue." onRetry={() => refetch()} />
        ) : isLoading ? (
          <SkeletonProductGrid count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No gear matches your search" ctaLabel="Clear all filters" onPress={clearFilters} />
        ) : (
          <View style={s.grid}>
            {filtered.map((p: any, i: number) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).springify().damping(18)} style={{ width: "48%", marginBottom: 24 }}>
                <ProductCard productId={p.id} slug={p.slug} name={p.name} price={p.price} imageUri={p.images?.[0] ?? ""} collectionLabel={p.collection?.name} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <Sheet ref={sheetRef} snapPoints={["65%"]}>
        <Text style={s.sheetTitle}>Filter & Sort</Text>

        <Text style={s.sheetLabel}>Collection</Text>
        <View style={s.chips}>
          <TouchableOpacity onPress={() => { haptics.select(); setCollectionSlug(null); }} style={[s.chip, !collectionSlug && s.chipA]}>
            <Text style={[s.chipT, !collectionSlug && s.chipTA]}>All</Text>
          </TouchableOpacity>
          {collections.map((c: any) => (
            <TouchableOpacity key={c.id} onPress={() => { haptics.select(); setCollectionSlug(c.slug); }} style={[s.chip, collectionSlug === c.slug && s.chipA]}>
              <Text style={[s.chipT, collectionSlug === c.slug && s.chipTA]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sheetLabel}>Price</Text>
        <View style={s.chips}>
          {PRICE_BUCKETS.map((b) => (
            <TouchableOpacity key={b.key} onPress={() => { haptics.select(); setPriceBucket(b.key); }} style={[s.chip, priceBucket === b.key && s.chipA]}>
              <Text style={[s.chipT, priceBucket === b.key && s.chipTA]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sheetLabel}>Sort By</Text>
        <View style={s.chips}>
          {SORTS.map((o) => (
            <TouchableOpacity key={o.key} onPress={() => { haptics.select(); setSort(o.key); }} style={[s.chip, sort === o.key && s.chipA]}>
              <Text style={[s.chipT, sort === o.key && s.chipTA]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.sheetActions}>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={s.clearT}>Clear all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.applyBtn} onPress={() => sheetRef.current?.dismiss()}>
            <Text style={s.applyBtnT}>Show {filtered.length} results</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  h: { paddingHorizontal: 24, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: C.rule, marginBottom: 20 },
  hT: { fontFamily: F.display, fontSize: 38, lineHeight: 42, color: C.text },
  hS: { fontFamily: F.body, fontSize: 14, color: C.mid, marginTop: 8 },
  fb: { paddingHorizontal: 24, marginBottom: 20 },
  sr: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.rule, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  si: { flex: 1, fontFamily: F.body, fontSize: 15, color: C.text },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.rule, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  filterBtnT: { fontFamily: F.bodyBold, fontSize: 12, color: C.text },
  filterCount: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.forest, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  filterCountT: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  cnt: { fontFamily: F.body, fontSize: 12, color: C.light },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 24 },
  sheetTitle: { fontFamily: F.display, fontSize: 22, color: C.text, marginBottom: 20 },
  sheetLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.forest, marginTop: 20, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: C.rule },
  chipA: { borderColor: C.forest, backgroundColor: C.forest + "14" },
  chipT: { fontFamily: F.body, fontSize: 12, color: C.mid },
  chipTA: { color: C.forest, fontWeight: "600" },
  sheetActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 32 },
  clearT: { fontFamily: F.bodyBold, fontSize: 13, color: C.clay },
  applyBtn: { backgroundColor: C.forest, borderRadius: R.md, paddingHorizontal: 22, paddingVertical: 14 },
  applyBtnT: { fontFamily: F.bodyBold, fontSize: 12, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "700" },
});
