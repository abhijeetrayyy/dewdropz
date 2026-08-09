import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCard } from "@/components/ProductCard";
import { ProductReviews } from "@/components/ProductReviews";
import { SizeGuideSheet } from "@/components/product/SizeGuideSheet";
import { Accordion } from "@/components/ui/Accordion";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { OverlayHeader } from "@/components/editorial/OverlayHeader";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { PullQuote } from "@/components/editorial/PullQuote";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display1, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { useProductQuery, useProductRatingQuery, useProductsQuery, useRecentlyViewedQuery } from "@/lib/queries";
import { getRelatedProducts } from "@/lib/data";
import { pushRecentlyViewed } from "@/lib/recentlyViewed";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, F, R, S, SHADOW_BAR } from "@/lib/theme";

const GENERIC_CARE = "Care varies by material — check the product label. When in doubt, cold wash and air dry.";
const SHIPPING_COPY =
  "Free shipping on orders over ₹2,000, flat ₹150 below that. Dispatched from Dehradun within two working days. 7-day returns on unused items with tags. COD available across India.";

// Product detail. The commerce screen, so it earns the most structure:
//
//   gallery (full bleed, glass controls)
//   ── identity: collection · rating · name · price
//   ── description
//   ── size, with the guide one tap away
//   ── the claim (a pull quote, not a beige "why you'll wear it" card)
//   ── specifications as a leader-dotted table
//   ── care / shipping disclosure
//   ── related · recently viewed · reviews
//   sticky buy bar
//
// v4 put the price in Bricolage at 26px next to a strikethrough and a tag,
// three type styles on one baseline. Here the price is mono — it's a number
// you compare, and mono numerals are what a spec sheet uses for exactly that.

export default function ProductScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: p, isLoading, isPending, isError } = useProductQuery(slug);
  const { data: allProducts = [] } = useProductsQuery();
  const { data: recentlyViewed = [] } = useRecentlyViewedQuery(slug);
  const { data: rating } = useProductRatingQuery(p?.id);
  const [size, setSize] = useState("");
  const { addItem } = useCartStore();
  const { has, toggle } = useWishlistStore();
  const sizeGuideRef = useRef<BottomSheetModal>(null);
  // Two-state header: glass over the gallery, paper bar past it.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!p?.variants?.length || size) return;
    const firstInStock = p.variants.find(
      (v) => v.inventory_quantity === null || v.inventory_quantity === undefined || v.inventory_quantity > 0,
    );
    setSize((firstInStock ?? p.variants[0]).name);
  }, [p, size]);

  useEffect(() => {
    if (slug) pushRecentlyViewed(slug);
  }, [slug]);

  // `isPending` and not just `isLoading`: react-query v5 reports
  // isLoading === false for a query that is disabled or hasn't started,
  // which on a cold deep link (where `slug` lands a tick after first
  // render) dropped straight through to the "not found" branch and
  // showed a real product as missing.
  if (!slug || isLoading || isPending) {
    return (
      <View style={s.root}>
        <Skeleton height={430} radius={0} />
        <View style={{ padding: S.gutter, gap: 14 }}>
          <Skeleton height={10} width="35%" />
          <Skeleton height={34} width="75%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={14} width="90%" />
        </View>
      </View>
    );
  }

  if (isError || !p) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 20, paddingHorizontal: S.gutter }]}>
        <IconButton name="arrow_back" onPress={() => router.back()} />
        <EmptyState
          eyebrow="Not found"
          title="This piece isn't here."
          body="It may have been removed, or the link is out of date."
          ctaLabel="Back to the gear room"
          ctaHref="/(tabs)/shop"
          style={{ marginTop: S.xl }}
        />
      </View>
    );
  }

  const variant = p.variants?.find((v) => v.name === size);
  const fp = p.price + (variant?.price_adjustment ?? 0);
  const saved = has(p.slug);
  const related = getRelatedProducts(allProducts as any, p.slug, 6);
  const discountPct = p.compare_at_price ? Math.round((1 - fp / p.compare_at_price) * 100) : undefined;
  const isNew = !!p.created_at && Date.now() - new Date(p.created_at).getTime() < 21 * 86400000;

  const stockQty = variant ? variant.inventory_quantity : p.inventory_quantity;
  const trackedStock = stockQty !== null && stockQty !== undefined;
  const inStock = !trackedStock || stockQty! > 0;
  const lowStock = trackedStock && stockQty! > 0 && stockQty! <= 3;

  const specRows =
    p.attributes
      ?.map((a) => ({ key: a.attribute?.name ?? "", value: a.value?.value ?? a.text_value ?? "" }))
      .filter((r) => r.key && r.value) ?? [];

  function handleAdd() {
    if (!inStock) return;
    haptics.tap();
    addItem(
      { productId: p!.id, slug: p!.slug, name: p!.name, price: fp, image: p!.images?.[0] ?? "", size },
      1,
    );
    toast.success("Added to pack");
  }

  return (
    <View style={s.root}>
      <StatusBar style={scrolled ? "dark" : "light"} />
      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > 260;
          if (past !== scrolled) setScrolled(past);
        }}
      >
        <ProductGallery images={p.images ?? []} discountPct={discountPct} isNew={isNew} />

        <View style={s.info}>
          {/* ── Identity ─────────────────────────────────────────────────── */}
          <View style={s.topRow}>
            {p.collection ? <Eyebrow style={{ flex: 1 }}>{p.collection.name}</Eyebrow> : <View style={{ flex: 1 }} />}
            {rating && rating.count > 0 ? (
              <View style={s.ratingRow}>
                <Icon name="star" size={15} color={C.clay} filled />
                <Mono color={C.textMid}>
                  {rating.average.toFixed(1)} · {rating.count}
                </Mono>
              </View>
            ) : null}
          </View>

          <Display1 style={{ marginTop: 10 }}>{p.name}</Display1>

          <View style={s.priceRow}>
            <Text style={s.price}>{formatPrice(fp)}</Text>
            {p.compare_at_price ? <Text style={s.strike}>{formatPrice(p.compare_at_price)}</Text> : null}
            <View style={{ flex: 1 }} />
            {inStock ? (
              <View style={s.stockRow}>
                <View style={[s.stockDot, lowStock && { backgroundColor: C.clay }]} />
                <Mono color={lowStock ? C.clayDeep : C.forest}>
                  {lowStock ? `ONLY ${stockQty} LEFT` : "IN STOCK"}
                </Mono>
              </View>
            ) : (
              <Mono color={C.danger}>OUT OF STOCK</Mono>
            )}
          </View>
          <Mono color={C.textFaint} style={{ marginTop: 6 }}>
            INCL. ALL TAXES
          </Mono>

          <Rule weight="strong" style={{ marginTop: S.lg }} />

          <Body color={C.textMid} style={{ marginTop: S.lg }}>
            {p.description || p.short_description}
          </Body>

          {/* ── Size ─────────────────────────────────────────────────────── */}
          {p.variants && p.variants.length > 0 ? (
            <View style={{ marginTop: S.block }}>
              <View style={s.sizeHead}>
                <Title style={{ flex: 1 }}>Size</Title>
                <TouchableOpacity
                  style={s.guideLink}
                  onPress={() => {
                    haptics.tap();
                    sizeGuideRef.current?.present();
                  }}
                >
                  <Icon name="straighten" size={16} color={C.ink} />
                  <Text style={s.guideLinkT}>Size guide</Text>
                </TouchableOpacity>
              </View>
              <View style={s.sizeRow}>
                {p.variants.map((v) => {
                  const active = size === v.name;
                  const oos =
                    v.inventory_quantity !== null && v.inventory_quantity !== undefined && v.inventory_quantity <= 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      disabled={oos}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, disabled: oos }}
                      onPress={() => {
                        haptics.select();
                        setSize(v.name);
                      }}
                      style={[s.sizeBtn, active && s.sizeBtnOn, oos && s.sizeBtnOff]}
                    >
                      <Text style={[s.sizeT, active && s.sizeTOn, oos && s.sizeTOff]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── The claim ────────────────────────────────────────────────── */}
          {p.highlights && p.highlights.length > 0 ? (
            <PullQuote quote={p.highlights[0]} attribution="Field notes" style={{ marginTop: S.block }} />
          ) : null}

          {/* ── Specifications ───────────────────────────────────────────── */}
          {specRows.length > 0 ? (
            <View style={{ marginTop: S.block }}>
              <SectionHead eyebrow="Specifications" title="The details." size="d3" />
              <SpecTable rows={specRows} style={{ marginTop: S.sm }} />
            </View>
          ) : null}

          {/* ── Disclosure ───────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block, borderTopWidth: 1, borderTopColor: C.ruleStrong }}>
            <Accordion title="Care">
              <Body color={C.textMid} style={{ marginTop: 10 }}>
                {p.care_instructions || GENERIC_CARE}
              </Body>
            </Accordion>
            <Accordion title="Shipping & returns">
              <Body color={C.textMid} style={{ marginTop: 10 }}>
                {SHIPPING_COPY}
              </Body>
            </Accordion>
          </View>

          {/* ── Related ──────────────────────────────────────────────────── */}
          {related.length > 0 ? (
            <View style={{ marginTop: S.section }}>
              <SectionHead eyebrow="Goes with it" title="Complete the kit." size="d3" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: S.md, paddingTop: S.lg }}
              >
                {related.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).springify().damping(18)}>
                    <ProductCard
                      width={148}
                      productId={r.id}
                      slug={r.slug}
                      name={r.name}
                      price={r.price}
                      imageUri={r.images?.[0] ?? ""}
                      meta={r.collection?.name}
                    />
                  </Animated.View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {recentlyViewed.length > 0 ? (
            <View style={{ marginTop: S.section }}>
              <SectionHead eyebrow="You looked at" title="Recently viewed." size="d3" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: S.md, paddingTop: S.lg }}
              >
                {recentlyViewed.map((r) => (
                  <ProductCard
                    key={r.id}
                    width={148}
                    productId={r.id}
                    slug={r.slug}
                    name={r.name}
                    price={r.price}
                    imageUri={r.images?.[0] ?? ""}
                    meta={r.collection?.name}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <ProductReviews productId={p.id} />
        </View>
      </ScrollView>

      {/* ── Floating controls over the gallery ───────────────────────────── */}
      <OverlayHeader
        scrolled={scrolled}
        title={p.name}
        onBack={() => router.back()}
        renderRight={(tone) => (
          <>
            <IconButton
              name="favorite"
              tone={tone}
              color={saved ? C.clay : undefined}
              filled={saved}
              onPress={() => {
                haptics.tap();
                toggle(p!.slug);
                toast.show(saved ? "Removed from saved" : "Saved");
              }}
            />
            <IconButton name="ios_share" tone={tone} />
          </>
        )}
      />

      {/* ── Buy bar ──────────────────────────────────────────────────────── */}
      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        {p.is_customizable ? (
          <TouchableOpacity
            style={s.cta}
            activeOpacity={0.92}
            onPress={() => {
              haptics.tap();
              router.push(`/customize/${p.slug}`);
            }}
          >
            <Icon name="draw" size={20} color={C.white} />
            <Text style={s.ctaT}>Design yours</Text>
            <View style={s.ctaRule} />
            <Text style={s.ctaPrice}>{formatPrice(fp)}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={s.barMeta}>
              <Mono color={C.textMuted}>{size ? `SIZE ${size.toUpperCase()}` : "PRICE"}</Mono>
              <Numeric style={{ fontSize: 16, marginTop: 3 }}>{formatPrice(fp)}</Numeric>
            </View>
            <TouchableOpacity
              style={[s.cta, { flex: 1 }, !inStock && s.ctaOff]}
              activeOpacity={0.92}
              disabled={!inStock}
              onPress={handleAdd}
            >
              <Icon name="backpack" size={20} color={C.white} />
              <Text style={s.ctaT}>{inStock ? "Add to pack" : "Out of stock"}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <SizeGuideSheet
        ref={sizeGuideRef}
        currentSize={size}
        onPickSize={(v) => {
          setSize(v);
          sizeGuideRef.current?.dismiss();
        }}
        onClose={() => sizeGuideRef.current?.dismiss()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  info: { paddingHorizontal: S.gutter, paddingTop: S.xl },

  topRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 14 },
  // Mono, and the largest numeral in the app. A price is data first.
  price: { fontFamily: F.monoBold, fontSize: 22, letterSpacing: 0.2, color: C.ink },
  strike: { fontFamily: F.mono, fontSize: 13, color: C.textFaint, textDecorationLine: "line-through" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stockDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: C.forest },

  sizeHead: { flexDirection: "row", alignItems: "center", gap: S.sm },
  guideLink: { flexDirection: "row", alignItems: "center", gap: 5 },
  guideLinkT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: S.md },
  sizeBtn: {
    minWidth: 62,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.ruleMed,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBtnOn: { backgroundColor: C.ink, borderColor: C.ink },
  sizeBtnOff: { borderColor: C.ruleHair, backgroundColor: "transparent" },
  sizeT: { fontFamily: F.bodyMedium, fontSize: 15, color: C.ink },
  sizeTOn: { fontFamily: F.bodyBold, color: C.paper },
  sizeTOff: { color: C.disabled, textDecorationLine: "line-through" },

  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.ruleSoft,
    paddingHorizontal: S.gutter,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    ...SHADOW_BAR,
  },
  barMeta: { minWidth: 78 },
  cta: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: C.forest,
    borderRadius: R.pill,
    height: 54,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaOff: { backgroundColor: C.disabled },
  ctaT: { fontFamily: F.bodyBold, fontSize: 16, color: C.white, letterSpacing: -0.1 },
  ctaRule: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.3)" },
  ctaPrice: { fontFamily: F.monoBold, fontSize: 13, color: C.white },
});
