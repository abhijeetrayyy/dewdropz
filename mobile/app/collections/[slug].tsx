import { useMemo, useState } from "react";
import { useWindowDimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { StatusBar } from "expo-status-bar";
import { Img as Image } from "@/components/ui/Img";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductCard } from "@/components/ProductCard";
import { IconButton } from "@/components/ui/IconButton";
import { OverlayHeader } from "@/components/editorial/OverlayHeader";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Topography } from "@/components/editorial/Topography";
import { Body, Display3, Mono, Serif } from "@/components/ui/Type";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { formatPrice, pickVariant } from "@/lib/utils";
import { COLLECTION_CONDITIONS } from "@/lib/editorial";
import { useCartStore } from "@/stores/cart";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { shareLink } from "@/lib/support";
import { C, F, S } from "@/lib/theme";


// A collection is a curated argument, not a filtered list, so the screen leads
// with the plate and the tagline before it shows a single price. The "take the
// whole kit" block sits above the grid rather than beside it — it's the one
// action this screen exists to offer that Shop can't.
export default function CollectionScreen() {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const HERO_H = Math.round(SCREEN_H * 0.46);
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const {
    data: collections = [],
    isLoading: colsLoading,
    isError: colsError,
    refetch: refetchCols,
  } = useCollectionsQuery();
  const {
    data: allProducts = [],
    isLoading: prodLoading,
    isError: prodError,
    refetch: refetchProds,
  } = useProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetchCols, refetchProds]);
  const addItem = useCartStore((st) => st.addItem);
  const [sortByPrice, setSortByPrice] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const c: any = collections.find((x: any) => x.slug === slug) ?? null;
  const products = useMemo(() => {
    const list = allProducts.filter((p: any) => p.collection?.slug === slug);
    if (!sortByPrice) return list;
    return [...list].sort((a: any, b: any) => a.price - b.price);
  }, [allProducts, slug, sortByPrice]);

  const loading = colsLoading || prodLoading;
  const error = colsError || prodError;
  const minPrice = products.length ? Math.min(...products.map((p: any) => p.price)) : 0;
  const kitTotal = products.reduce((sum: number, p: any) => sum + p.price, 0);
  const conditions = slug ? COLLECTION_CONDITIONS[slug] : undefined;

  function addWholeKit() {
    haptics.tap();
    for (const p of products as any[]) {
      const variant = pickVariant(p.variants);
      addItem({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        image: p.images?.[0] ?? "",
        size: variant?.name,
        variantId: variant?.id ?? null,
      });
    }
    toast.success(`Added ${products.length} pieces to pack`);
  }

  return (
    <View style={s.root}>
      <StatusBar style={c && !scrolled ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > HERO_H - 110;
          if (past !== scrolled) setScrolled(past);
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {loading ? (
          <View style={{ paddingTop: insets.top + 64, paddingHorizontal: S.gutter }}>
            <SkeletonProductGrid count={4} />
          </View>
        ) : error ? (
          <View style={{ paddingTop: insets.top + 64, paddingHorizontal: S.gutter }}>
            <ErrorState
              message="Couldn't load this collection."
              onRetry={() => {
                refetchCols();
                refetchProds();
              }}
            />
          </View>
        ) : !c ? (
          <View style={{ paddingTop: insets.top + 64, paddingHorizontal: S.gutter }}>
            <EmptyState
              eyebrow="Not found"
              title="No such collection."
              body="It may have been renamed or unpublished."
              ctaLabel="See all collections"
              ctaHref="/collections"
            />
          </View>
        ) : (
          <>
            {/* ── Plate ─────────────────────────────────────────────────── */}
            <View style={[s.hero, { height: HERO_H }]}>
              {c.image_url ? (
                <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={260} alt="" />
              ) : null}
              <LinearGradient
                colors={["rgba(12,18,15,0.55)", "rgba(12,18,15,0.15)", "rgba(12,18,15,0.9)"]}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.heroBody}>
                <Mono color="rgba(255,255,255,0.7)">COLLECTION</Mono>
                <Serif color={C.paper} style={{ marginTop: 6 }}>
                  {c.name}
                </Serif>
                {c.tagline ? (
                  <Body color="rgba(255,255,255,0.85)" style={{ marginTop: 10, maxWidth: 320 }}>
                    {c.tagline}
                  </Body>
                ) : null}
              </View>
            </View>

            <View style={{ paddingHorizontal: S.gutter }}>
              <View style={s.stateRow}>
                <Mono color={C.textMuted}>
                  {products.length} {products.length === 1 ? "PIECE" : "PIECES"}
                  {minPrice ? ` · FROM ${formatPrice(minPrice)}` : ""}
                </Mono>
                <TouchableOpacity
                  style={s.sortBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.select();
                    setSortByPrice((v) => !v);
                  }}
                >
                  <Icon name="swap_vert" size={16} color={C.ink} />
                  <Text style={s.sortBtnT}>{sortByPrice ? "Price" : "Featured"}</Text>
                </TouchableOpacity>
              </View>
              <Rule weight="ink" />

              {products.length > 1 ? (
                <>
                  <TouchableOpacity activeOpacity={0.85} style={s.kit} onPress={addWholeKit}>
                    <View style={{ flex: 1 }}>
                      <Mono color={C.forest}>THE COMPLETE KIT</Mono>
                      <Display3 style={{ marginTop: 6 }}>Take all {products.length}.</Display3>
                      {/* Stated as a plain total. This line used to promise
                          "about ₹X less than buying them one at a time" off a
                          hardcoded 10% — a saving nothing in the cart or at
                          checkout ever applied, so the basket contradicted the
                          claim the moment it was tapped. */}
                      <Body color={C.textMid} style={{ marginTop: 6 }}>
                        {formatPrice(kitTotal)} for the set — every piece built for the same weather.
                      </Body>
                    </View>
                    <View style={s.kitGo}>
                      <Icon name="add" size={22} color={C.paper} />
                    </View>
                  </TouchableOpacity>
                  <Rule weight="soft" />
                </>
              ) : null}

              {/* Field conditions — the data that makes a collection an
                  argument rather than a mood board. It has lived in
                  lib/constants.ts since launch and has never been rendered
                  on mobile until now. */}
              {conditions ? (
                <View style={s.conditions}>
                  <Topography
                    width={SCREEN_W - S.gutter * 2}
                    height={260}
                    color={C.forest}
                    opacity={0.07}
                    seed={3.3}
                    originX={0.85}
                    originY={0.25}
                  />
                  <SectionHead eyebrow="Field conditions" title="What it was built for." size="d3" />
                  <SpecTable rows={conditions} style={{ marginTop: S.md }} />
                </View>
              ) : null}

              <View style={{ marginTop: S.block }}>
                {products.length === 0 ? (
                  <EmptyState
                    eyebrow="Restocking"
                    title="More pieces on the way."
                    body="This collection is being restocked — check back soon."
                    ctaLabel="Browse everything"
                    ctaHref="/(tabs)/shop"
                  />
                ) : (
                  <>
                    <SectionHead eyebrow="In this collection" title="Every piece." size="d3" />
                    <View style={s.grid}>
                      {products.map((p: any, i: number) => (
                        <Animated.View
                          key={p.id}
                          entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(380)}
                          style={s.cell}
                        >
                          <ProductCard
                            productId={p.id}
                            slug={p.slug}
                            name={p.name}
                            price={p.price}
                            imageUri={p.images?.[0] ?? ""}
                            compareAtPrice={p.compare_at_price}
                            createdAt={p.created_at}
                            tag={
                              p.inventory_quantity != null && p.inventory_quantity <= 3
                                ? { label: `${p.inventory_quantity} LEFT`, tone: "scarcity" }
                                : undefined
                            }
                            variants={p.variants}
                            showQuickAdd
                          />
                        </Animated.View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <OverlayHeader
        scrolled={scrolled || !c}
        title={c?.name}
        onBack={() => goBack("/collections")}
        renderRight={(tone) =>
          c ? (
            <IconButton
              name="ios_share"
              tone={tone}
              accessibilityLabel={`Share ${c.name}`}
              onPress={() => shareLink(c.name, `/collections/${c.slug}`)}
            />
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  hero: { justifyContent: "flex-end", backgroundColor: C.ink },
  heroBody: { padding: S.gutter, paddingBottom: S.xl },
  stateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: S.md },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  sortBtnT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  kit: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.lg },
  kitGo: { width: 46, height: 46, borderRadius: 999, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  conditions: { marginTop: S.block, paddingVertical: S.lg, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl, marginTop: S.xl },
  cell: { width: "48%" },
});
