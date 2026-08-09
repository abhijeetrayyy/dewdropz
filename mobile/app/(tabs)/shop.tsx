import { useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ProductCard } from "@/components/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Rule } from "@/components/editorial/Rule";
import { Display1, Eyebrow, Lede, Mono, Serif } from "@/components/ui/Type";
import { FilterSheet, ShopFilters } from "@/components/shop/FilterSheet";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

const DEFAULT_FILTERS: ShopFilters = { price: "all", inStockOnly: false, sort: "newest" };

const SORT_LABEL: Record<ShopFilters["sort"], string> = {
  newest: "Newest",
  "price-asc": "Price ↑",
  "price-desc": "Price ↓",
};

// The catalogue. Three structural changes from v4:
//
//   • The filter row is STICKY. v4 scrolled it away, so filtering a long grid
//     meant scrolling back to the top to change your mind.
//   • The result count and active sort are stated in mono above the grid, so
//     the current state of the list is always legible — v4 hid the active
//     filter count inside a badge on a floating pill.
//   • An editorial break sits after the first six products: a full-bleed
//     collection block that interrupts the grid rhythm. A 40-item uniform
//     grid is the single most template-looking thing a shop app can do.

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { data: products = [], isLoading, isError, refetch } = useProductsQuery();
  const { data: collections = [] } = useCollectionsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const [collectionSlug, setCollectionSlug] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);
  const sheetRef = useRef<BottomSheetModal>(null);

  const filtered = useMemo(() => {
    let list = (products as any[]).filter((p) => {
      if (collectionSlug && p.collection?.slug !== collectionSlug) return false;
      if (filters.price === "under-1500" && p.price >= 150000) return false;
      if (filters.price === "1500-3000" && (p.price < 150000 || p.price > 300000)) return false;
      if (filters.price === "over-3000" && p.price <= 300000) return false;
      if (filters.inStockOnly && p.inventory_quantity != null && p.inventory_quantity <= 0) return false;
      return true;
    });
    if (filters.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (filters.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, collectionSlug, filters]);

  const activeFilterCount =
    (filters.price !== "all" ? 1 : 0) + (filters.inStockOnly ? 1 : 0) + (filters.sort !== "newest" ? 1 : 0);

  // The break slots in after six cards, and only when there's enough grid
  // after it to be worth interrupting — otherwise it reads as a footer.
  const showBreak = filtered.length > 8;
  const head = showBreak ? filtered.slice(0, 6) : filtered;
  const tail = showBreak ? filtered.slice(6) : [];
  const breakCollection: any = collections.find((c: any) => c.slug !== collectionSlug) ?? collections[0];

  function clearFilters() {
    haptics.select();
    setFilters(DEFAULT_FILTERS);
    setCollectionSlug(null);
  }

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.block }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* 0 — masthead block */}
        <View style={[s.head, { paddingTop: insets.top + 14 }]}>
          <View style={s.headRow}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Everything we make</Eyebrow>
              <Display1 style={{ marginTop: 8 }}>The gear room</Display1>
            </View>
            <TouchableOpacity onPress={() => router.push("/search")} hitSlop={12} accessibilityLabel="Search">
              <Icon name="search" size={23} color={C.ink} />
            </TouchableOpacity>
          </View>
          <Lede style={{ marginTop: 10 }}>
            Small-batch layers, packs and headwear — every piece field-tested before it was listed.
          </Lede>
        </View>

        {/* 1 — sticky filter rail */}
        <View style={s.stickyWrap}>
          <Rule weight="ink" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRail}
          >
            <Chip
              label="All"
              count={products.length}
              selected={!collectionSlug}
              onPress={() => setCollectionSlug(null)}
            />
            {(collections as any[]).map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={collectionSlug === c.slug}
                onPress={() => setCollectionSlug(collectionSlug === c.slug ? null : c.slug)}
              />
            ))}
          </ScrollView>
          <Rule weight="soft" />
        </View>

        {/* 2 — state line + grid */}
        <View style={{ paddingHorizontal: S.gutter }}>
          <View style={s.stateRow}>
            <Mono color={C.textMuted}>
              {filtered.length} {filtered.length === 1 ? "PIECE" : "PIECES"}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} FILTER${activeFilterCount > 1 ? "S" : ""}` : ""}
            </Mono>
            <TouchableOpacity
              style={s.sortBtn}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                sheetRef.current?.present();
              }}
            >
              <Icon name="tune" size={16} color={C.ink} />
              <Text style={s.sortBtnT}>{SORT_LABEL[filters.sort]}</Text>
              {activeFilterCount > 0 ? <View style={s.sortDot} /> : null}
            </TouchableOpacity>
          </View>

          {isError ? (
            <ErrorState message="Couldn't load the catalogue." onRetry={() => refetch()} />
          ) : isLoading ? (
            <View style={{ marginTop: S.lg }}>
              <SkeletonProductGrid count={6} />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              eyebrow="No matches"
              title="Nothing fits those filters."
              body="Try widening the price range, or clear everything and start again."
              ctaLabel="Clear all filters"
              onPress={clearFilters}
            />
          ) : (
            <View style={s.grid}>
              {head.map((p: any, i: number) => (
                <Animated.View
                  key={p.id}
                  entering={FadeInDown.delay(Math.min(i, 6) * 45).springify().damping(18)}
                  style={s.cell}
                >
                  <ProductCard
                    productId={p.id}
                    slug={p.slug}
                    name={p.name}
                    price={p.price}
                    imageUri={p.images?.[0] ?? ""}
                    meta={p.collection?.name}
                    tag={
                      p.inventory_quantity != null && p.inventory_quantity <= 3
                        ? { label: `${p.inventory_quantity} LEFT`, tone: "scarcity" }
                        : undefined
                    }
                    compareAtPrice={p.compare_at_price}
                    createdAt={p.created_at}
                    showQuickAdd
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        {/* 3 — editorial break */}
        {showBreak && breakCollection ? (
          <TouchableOpacity
            activeOpacity={0.94}
            onPress={() => {
              haptics.tap();
              router.push(`/collections/${breakCollection.slug}`);
            }}
            style={s.break}
          >
            {breakCollection.image_url ? (
              <Image source={{ uri: breakCollection.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" alt="" />
            ) : null}
            <LinearGradient colors={["rgba(12,18,15,0.15)", "rgba(12,18,15,0.8)"]} style={StyleSheet.absoluteFill} />
            <View style={s.breakBody}>
              <Mono color="rgba(255,255,255,0.7)">THE COLLECTION</Mono>
              <Serif color={C.paper} style={{ marginTop: 4 }}>
                {breakCollection.name}
              </Serif>
              <View style={s.breakLink}>
                <Text style={s.breakLinkT}>See the kit</Text>
                <Icon name="arrow_forward" size={16} color={C.paper} />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* 4 — remainder of the grid */}
        {tail.length > 0 ? (
          <View style={{ paddingHorizontal: S.gutter }}>
            <View style={s.grid}>
              {tail.map((p: any) => (
                <View key={p.id} style={s.cell}>
                  <ProductCard
                    productId={p.id}
                    slug={p.slug}
                    name={p.name}
                    price={p.price}
                    imageUri={p.images?.[0] ?? ""}
                    meta={p.collection?.name}
                    tag={
                      p.inventory_quantity != null && p.inventory_quantity <= 3
                        ? { label: `${p.inventory_quantity} LEFT`, tone: "scarcity" }
                        : undefined
                    }
                    compareAtPrice={p.compare_at_price}
                    createdAt={p.created_at}
                    showQuickAdd
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <FilterSheet
        ref={sheetRef}
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        resultCount={filtered.length}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  head: { paddingHorizontal: S.gutter, paddingBottom: S.lg },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md },

  // Opaque paper background is load-bearing: without it the grid scrolls
  // visibly *through* the sticky rail.
  stickyWrap: { backgroundColor: C.paper },
  chipRail: { gap: 8, paddingHorizontal: S.gutter, paddingVertical: 12 },

  stateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: S.md },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  sortBtnT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  sortDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.ember },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl },
  cell: { width: "48%" },

  break: { height: 220, marginTop: S.block, justifyContent: "flex-end", backgroundColor: C.ink },
  breakBody: { padding: S.gutter },
  breakLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.md },
  breakLinkT: { fontFamily: F.bodySemiBold, fontSize: 14, color: C.paper },
});
