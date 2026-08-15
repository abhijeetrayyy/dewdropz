import { useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductCard } from "@/components/ProductCard";
import { useTabBarSpace } from "@/components/TabBar";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Display1, Eyebrow, Lede, Mono } from "@/components/ui/Type";
import { CategoryTiles } from "@/components/shop/CategoryTiles";
import { CollectionBanner } from "@/components/shop/CollectionBanner";
import { PromoStrip } from "@/components/shop/PromoStrip";
import { FilterSheet, ShopFilters } from "@/components/shop/FilterSheet";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCategoriesQuery, useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

const DEFAULT_FILTERS: ShopFilters = { price: "all", inStockOnly: false, sort: "newest" };

const SORT_LABEL: Record<ShopFilters["sort"], string> = {
  newest: "Newest",
  "price-asc": "Price ↑",
  "price-desc": "Price ↓",
};

/** Cards shown before the first merchandising break, and between later ones. */
const LEAD_CHUNK = 4;
const TAIL_CHUNK = 6;
/** Below this the grid is too short to be worth interrupting at all. */
const MIN_FOR_BREAK = 6;

// The catalogue, merchandised rather than listed.
//
// v5 was a masthead, a chip rail, and one uniform grid with a single collection
// break bolted into the middle. That is a fine *list* and a poor *shop*: it
// offered exactly one way in (scroll), never surfaced the category taxonomy that
// has existed since migration 004, and gave a first-time visitor nothing to
// answer "can I trust this store" with.
//
// The structure now, top to bottom:
//   masthead + search
//   reassurance strip        — COD / returns / free shipping, the questions that stall a first order
//   shop by category         — the packer's axis, and the only entry to /category/[slug]
//   sticky collection chips  — the brand's editorial axis, still sticky so filtering a long grid works
//   state line + sort
//   grid, interrupted twice  — a photographic plate, then a gradient strip
//   entry-price rail         — "start here", the cheapest way in
//
// Every block below the chips disappears when it has nothing real to show, so a
// three-product catalogue reads as a small shop rather than a broken big one.
export default function ShopScreen() {
  const tabSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const { data: products = [], isLoading, isError, refetch } = useProductsQuery();
  const { data: collections = [] } = useCollectionsQuery();
  const { data: categories = [] } = useCategoriesQuery();
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

  // Category counts come off the taxonomy junction, the same match the web shop
  // uses. Empty today (nothing is categorised yet), which is why the tiles hide
  // the count rather than printing a zero.
  const categoryCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of products as any[]) {
      for (const link of p.categories ?? []) {
        acc[link.category_id] = (acc[link.category_id] ?? 0) + 1;
      }
    }
    return acc;
  }, [products]);

  const perCollection = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of products as any[]) {
      const slug = p.collection?.slug;
      if (slug) acc[slug] = (acc[slug] ?? 0) + 1;
    }
    return acc;
  }, [products]);

  const activeFilterCount =
    (filters.price !== "all" ? 1 : 0) + (filters.inStockOnly ? 1 : 0) + (filters.sort !== "newest" ? 1 : 0);

  // Merchandising breaks are pulled from collections the shopper is NOT already
  // filtered into — interrupting a Silent Altitude grid to advertise Silent
  // Altitude is noise.
  const breakCollections = useMemo(
    () => (collections as any[]).filter((c) => c.slug !== collectionSlug),
    [collections, collectionSlug],
  );

  // The grid is split into runs with a break between them. Below MIN_FOR_BREAK
  // there is no interruption at all: a break above three products reads as a
  // footer, not a rhythm.
  const runs = useMemo(() => {
    if (filtered.length < MIN_FOR_BREAK) return [filtered];
    const out = [filtered.slice(0, LEAD_CHUNK)];
    let i = LEAD_CHUNK;
    while (i < filtered.length) {
      out.push(filtered.slice(i, i + TAIL_CHUNK));
      i += TAIL_CHUNK;
    }
    return out;
  }, [filtered]);

  // Cheapest few, as a "start here" rail. Only meaningful once the catalogue is
  // big enough that price is a real filter rather than the whole shop.
  const entryPrice = useMemo(() => {
    if (products.length < 8) return [];
    return [...(products as any[])].sort((a, b) => a.price - b.price).slice(0, 6);
  }, [products]);

  function clearFilters() {
    haptics.select();
    setFilters(DEFAULT_FILTERS);
    setCollectionSlug(null);
  }

  const showingAll = !collectionSlug && activeFilterCount === 0;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.block + tabSpace }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* 0 — masthead */}
        <View style={[s.head, { paddingTop: insets.top + 14 }]}>
          <View style={s.headRow}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Everything we make</Eyebrow>
              <Display1 style={{ marginTop: 8 }}>The gear room</Display1>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/search")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Search the catalogue"
            >
              <Icon name="search" size={23} color={C.ink} />
            </TouchableOpacity>
          </View>
          <Lede style={{ marginTop: 10 }}>
            Small-batch layers, packs and headwear — every piece field-tested before it was listed.
          </Lede>
        </View>

        {/* 1 — reassurance + the category axis */}
        <View style={{ paddingBottom: S.md }}>
          <PromoStrip />

          {categories.length > 0 && showingAll ? (
            <View style={{ paddingTop: S.block }}>
              <SectionHead
                eyebrow="Shop by category"
                title="What are you packing for?"
                size="d3"
                actionLabel="All"
                onAction={() => router.push("/collections")}
                style={{ paddingHorizontal: S.gutter }}
              />
              <CategoryTiles categories={categories} counts={categoryCounts} />
            </View>
          ) : null}
        </View>

        {/* 2 — sticky collection rail */}
        <View style={s.stickyWrap}>
          <Rule weight="ink" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRail}>
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
                count={perCollection[c.slug]}
                selected={collectionSlug === c.slug}
                onPress={() => setCollectionSlug(collectionSlug === c.slug ? null : c.slug)}
              />
            ))}
          </ScrollView>
          <Rule weight="soft" />
        </View>

        {/* 3 — state line */}
        <View style={{ paddingHorizontal: S.gutter }}>
          <View style={s.stateRow}>
            <Mono color={C.textMuted}>
              {filtered.length} {filtered.length === 1 ? "PIECE" : "PIECES"}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} FILTER${activeFilterCount > 1 ? "S" : ""}` : ""}
            </Mono>
            <TouchableOpacity
              style={s.sortBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Filter and sort — currently ${SORT_LABEL[filters.sort]}${
                activeFilterCount > 0 ? `, ${activeFilterCount} filters active` : ""
              }`}
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
        </View>

        {/* 4 — the grid, interrupted */}
        {isError ? (
          <View style={{ paddingHorizontal: S.gutter }}>
            <ErrorState message="Couldn't load the catalogue." onRetry={() => refetch()} />
          </View>
        ) : isLoading ? (
          <View style={{ paddingHorizontal: S.gutter, marginTop: S.lg }}>
            <SkeletonProductGrid count={6} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: S.gutter }}>
            <EmptyState
              eyebrow="No matches"
              title="Nothing fits those filters."
              body="Try widening the price range, or clear everything and start again."
              ctaLabel="Clear all filters"
              onPress={clearFilters}
            />
          </View>
        ) : (
          runs.map((run, runIndex) => {
            const banner = runIndex > 0 ? breakCollections[(runIndex - 1) % Math.max(1, breakCollections.length)] : null;
            return (
              <View key={runIndex}>
                {banner ? (
                  <View style={{ marginTop: S.section, marginBottom: S.block }}>
                    {/* Alternating treatments: the photographic plate leads,
                        gradient strips carry the rest. */}
                    {runIndex === 1 ? (
                      <CollectionBanner collection={banner} variant="plate" count={perCollection[banner.slug]} />
                    ) : (
                      <CollectionBanner collection={banner} variant="strip" eyebrow="Also worth a look" />
                    )}
                  </View>
                ) : null}

                <View style={{ paddingHorizontal: S.gutter }}>
                  <View style={s.grid}>
                    {run.map((p: any, i: number) => (
                      <Animated.View
                        key={p.id}
                        entering={FadeInDown.delay(Math.min(i, 5) * 45).duration(380)}
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
                          variants={p.variants}
                          showQuickAdd
                        />
                      </Animated.View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* 5 — entry price rail */}
        {entryPrice.length > 0 && showingAll ? (
          <View style={{ paddingTop: S.section }}>
            <SectionHead
              eyebrow="Start here"
              title="The easy way in."
              lede="The lightest, cheapest pieces we make — good first buys."
              size="d3"
              style={{ paddingHorizontal: S.gutter }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={s.rail}
            >
              {entryPrice.map((p: any) => (
                <ProductCard
                  key={p.id}
                  width={148}
                  productId={p.id}
                  slug={p.slug}
                  name={p.name}
                  price={p.price}
                  imageUri={p.images?.[0] ?? ""}
                  meta={p.collection?.name}
                  compareAtPrice={p.compare_at_price}
                  variants={p.variants}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* 6 — the studio, the one thing a grid can't sell */}
        {showingAll ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              haptics.tap();
              router.push("/(tabs)/design");
            }}
            style={s.studio}
          >
            <View style={{ flex: 1 }}>
              <Mono color={C.sage}>OR MAKE YOUR OWN</Mono>
              <Text style={s.studioT}>Nothing here quite right?</Text>
              <Text style={s.studioB}>
                Print your own artwork on a heavyweight blank. No minimums, nothing made until you approve it.
              </Text>
            </View>
            <View style={s.studioGo}>
              <Icon name="draw" size={20} color={C.ink} />
            </View>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Status-bar scrim. A sticky header on a tab screen pins to y=0, which on
          a notched phone is *under* the clock — the chip rail was scrolling up
          behind the time and the battery. An opaque band the height of the top
          inset keeps the status bar legible without adding a gap at rest, which
          padding the sticky block itself would. */}
      <View pointerEvents="none" style={[s.statusScrim, { height: insets.top }]} />

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
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: C.paper },
  head: { paddingHorizontal: S.gutter, paddingBottom: S.lg },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md },

  // Opaque paper background is load-bearing: without it the grid scrolls
  // visibly *through* the sticky rail.
  stickyWrap: { backgroundColor: C.paper },
  chipRail: { gap: 8, paddingHorizontal: S.gutter, paddingVertical: 12 },

  stateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: S.md },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  sortBtnT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  sortDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.forest },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl },
  cell: { width: "48%" },
  rail: { gap: S.md, paddingHorizontal: S.gutter, paddingTop: S.lg },

  studio: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    backgroundColor: C.ink,
    marginTop: S.section,
    paddingVertical: S.block,
    paddingHorizontal: S.gutter,
  },
  studioT: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: C.paper, marginTop: 8 },
  studioB: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: "rgba(255,255,255,0.7)", marginTop: 8 },
  studioGo: {
    width: 46, height: 46, borderRadius: 999,
    backgroundColor: C.paper, alignItems: "center", justifyContent: "center",
  },
});
