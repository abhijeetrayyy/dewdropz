import { useMemo, useState } from "react";
import { useWindowDimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductCard } from "@/components/ProductCard";
import { IconButton } from "@/components/ui/IconButton";
import { OverlayHeader } from "@/components/editorial/OverlayHeader";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Body, Mono, Serif } from "@/components/ui/Type";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { PromoStrip } from "@/components/shop/PromoStrip";
import { useCategoriesQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { shareLink } from "@/lib/support";
import { C, F, R, S } from "@/lib/theme";


// A category landing page. New on mobile — the taxonomy has existed since
// migration 004 and the phone had no route into it, so "Layers & Shells" was a
// row in a table nobody could reach.
//
// Shorter hero than a collection's: a category is a utility grouping ("I need a
// shell"), not an editorial argument, so it states what it is and gets out of
// the way. The sibling rail at the bottom keeps a dead end from being a dead
// end when a category is empty.
export default function CategoryScreen() {
  const { height: SCREEN_H } = useWindowDimensions();
  const HERO_H = Math.round(SCREEN_H * 0.34);
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const {
    data: categories = [],
    isLoading: catsLoading,
    isError: catsError,
    refetch: refetchCats,
  } = useCategoriesQuery();
  const {
    data: products = [],
    isLoading: prodLoading,
    isError: prodError,
    refetch: refetchProds,
  } = useProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetchCats, refetchProds]);
  const [sortByPrice, setSortByPrice] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const category = categories.find((c) => c.slug === slug) ?? null;

  const inCategory = useMemo(() => {
    if (!category) return [];
    // Same match the web shop uses (ShopContent.tsx) — the junction table, not
    // a denormalised column, because a product legitimately sits in several.
    const list = (products as any[]).filter((p) =>
      (p.categories ?? []).some((link: any) => link.category_id === category.id),
    );
    return sortByPrice ? [...list].sort((a, b) => a.price - b.price) : list;
  }, [products, category, sortByPrice]);

  const siblings = useMemo(
    () => categories.filter((c) => c.slug !== slug),
    [categories, slug],
  );

  const loading = catsLoading || prodLoading;
  const error = catsError || prodError;
  const minPrice = inCategory.length ? Math.min(...inCategory.map((p: any) => p.price)) : 0;

  return (
    <View style={s.root}>
      <StatusBar style={category && !scrolled ? "light" : "dark"} />
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
              message="Couldn't load this category."
              onRetry={() => {
                refetchCats();
                refetchProds();
              }}
            />
          </View>
        ) : !category ? (
          <View style={{ paddingTop: insets.top + 64, paddingHorizontal: S.gutter }}>
            <EmptyState
              eyebrow="Not found"
              title="No such category."
              body="It may have been renamed or archived."
              ctaLabel="Back to the gear room"
              ctaHref="/(tabs)/shop"
            />
          </View>
        ) : (
          <>
            {/* ── Plate ─────────────────────────────────────────────────── */}
            <View style={[s.hero, { height: HERO_H }]}>
              {category.image_url ? (
                <Image
                  source={{ uri: category.image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={260}
                  alt=""
                />
              ) : null}
              <LinearGradient
                colors={["rgba(12,18,15,0.5)", "rgba(12,18,15,0.15)", "rgba(12,18,15,0.9)"]}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.heroBody}>
                <Mono color="rgba(255,255,255,0.7)">CATEGORY</Mono>
                <Serif color={C.paper} style={{ marginTop: 6 }}>
                  {category.name}
                </Serif>
                {category.description ? (
                  <Body color="rgba(255,255,255,0.85)" style={{ marginTop: 8, maxWidth: 320 }}>
                    {category.description}
                  </Body>
                ) : null}
              </View>
            </View>

            <View style={{ paddingTop: S.md }}>
              <PromoStrip />
            </View>

            <View style={{ paddingHorizontal: S.gutter }}>
              <View style={s.stateRow}>
                {/* No "0 PIECES" — the empty state directly below already says
                    so, at length, and a zero count reads as a failed load. */}
                <Mono color={C.textMuted}>
                  {inCategory.length > 0
                    ? `${inCategory.length} ${inCategory.length === 1 ? "PIECE" : "PIECES"}${
                        minPrice ? ` · FROM ${formatPrice(minPrice)}` : ""
                      }`
                    : "RESTOCKING"}
                </Mono>
                {inCategory.length > 1 ? (
                  <TouchableOpacity
                    style={s.sortBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    onPress={() => {
                      haptics.select();
                      setSortByPrice((v) => !v);
                    }}
                  >
                    <Icon name="swap_vert" size={16} color={C.ink} />
                    <Text style={s.sortBtnT}>{sortByPrice ? "Price" : "Featured"}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Rule weight="ink" />

              {inCategory.length === 0 ? (
                <EmptyState
                  eyebrow="Nothing here yet"
                  title="This shelf is still being stocked."
                  body="Nothing is filed under this category right now — the rest of the catalogue is still worth a look."
                  ctaLabel="Browse everything"
                  ctaHref="/(tabs)/shop"
                />
              ) : (
                <View style={s.grid}>
                  {inCategory.map((p: any, i: number) => (
                    <Animated.View
                      key={p.id}
                      entering={FadeInDown.delay(Math.min(i, 6) * 45).duration(380)}
                      style={s.cell}
                    >
                      <ProductCard
                        productId={p.id}
                        slug={p.slug}
                        name={p.name}
                        price={p.price}
                        imageUri={p.images?.[0] ?? ""}
                        meta={p.collection?.name}
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
              )}
            </View>

            {/* ── Siblings ──────────────────────────────────────────────── */}
            {siblings.length > 0 ? (
              <View style={{ marginTop: S.section }}>
                <SectionHead
                  eyebrow="Keep packing"
                  title="The rest of the kit."
                  size="d3"
                  style={{ paddingHorizontal: S.gutter }}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.sibRail}
                >
                  {siblings.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      onPress={() => {
                        haptics.tap();
                        router.replace(`/category/${c.slug}`);
                      }}
                      style={s.sib}
                    >
                      {c.image_url ? (
                        <Image
                          source={{ uri: c.image_url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={200}
                          alt=""
                        />
                      ) : null}
                      <LinearGradient
                        colors={["rgba(12,18,15,0.05)", "rgba(12,18,15,0.8)"]}
                        locations={[0.35, 1]}
                        style={StyleSheet.absoluteFill}
                      />
                      <Text style={s.sibT} numberOfLines={2}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <OverlayHeader
        scrolled={scrolled || !category}
        title={category?.name}
        onBack={() => router.back()}
        renderRight={(tone) =>
          category ? (
            <IconButton
              name="ios_share"
              tone={tone}
              accessibilityLabel={`Share ${category.name}`}
              onPress={() => shareLink(category.name, `/shop?category=${category.slug}`)}
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
  heroBody: { padding: S.gutter, paddingBottom: S.lg },
  stateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: S.md },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  sortBtnT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl, marginTop: S.xl },
  cell: { width: "48%" },
  sibRail: { gap: S.sm, paddingHorizontal: S.gutter, paddingTop: S.lg },
  sib: {
    width: 130,
    aspectRatio: 4 / 5,
    borderRadius: R.card,
    overflow: "hidden",
    backgroundColor: C.sand,
    justifyContent: "flex-end",
    padding: 10,
  },
  sibT: { fontFamily: F.displayRegular, fontSize: 15, lineHeight: 18, color: C.paper },
});
