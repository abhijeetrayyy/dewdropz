import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Heart } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCard } from "@/components/ProductCard";
import { ProductReviews } from "@/components/ProductReviews";
import { Accordion } from "@/components/ui/Accordion";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { useProductQuery, useProductsQuery, useRecentlyViewedQuery } from "@/lib/queries";
import { getRelatedProducts } from "@/lib/data";
import { pushRecentlyViewed } from "@/lib/recentlyViewed";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, F, R } from "@/lib/theme";

// The real `products` table has no per-product materials/care columns — the
// per-product specifics already live in `description` (shown above this
// accordion). This copy is genuinely universal store policy, not fabricated
// per-product detail, so it's honest to keep as a shared fallback.
const GENERIC_CARE = "Care varies by material — check the product label. When in doubt, cold wash and air dry.";
const SHIPPING_COPY = "Free shipping on orders over ₹2,000. 7‑day returns on unused items with tags. COD available.";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: p, isLoading, isError } = useProductQuery(slug);
  const { data: allProducts = [] } = useProductsQuery();
  const { data: recentlyViewed = [] } = useRecentlyViewedQuery(slug);
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartStore();
  const { has, toggle } = useWishlistStore();

  useEffect(() => {
    if (!p?.variants?.length || size) return;
    // Prefer the first in-stock variant so a shopper doesn't land on the
    // product page already staring at a disabled "Out of Stock" button when
    // another size is actually available — only fall back to variants[0]
    // (the original always-pick-first behavior) if every size is sold out.
    const firstInStock = p.variants.find((v) => v.inventory_quantity === null || v.inventory_quantity === undefined || v.inventory_quantity > 0);
    setSize((firstInStock ?? p.variants[0]).name);
  }, [p, size]);

  useEffect(() => {
    if (slug) pushRecentlyViewed(slug);
  }, [slug]);

  if (isLoading) {
    return (
      <View style={s.root}>
        <Skeleton height={400} radius={0} />
        <View style={{ padding: 24, gap: 12 }}>
          <Skeleton height={12} width="40%" />
          <Skeleton height={28} width="70%" />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="60%" />
        </View>
      </View>
    );
  }

  if (isError || !p) {
    return (
      <View style={s.root}>
        <EmptyState title="Product not found" body="This item may have been removed or the link is out of date." />
      </View>
    );
  }

  const variant = p.variants?.find((v) => v.name === size);
  const fp = p.price + (variant?.price_adjustment ?? 0);
  const saved = has(p.slug);
  const related = getRelatedProducts(allProducts as any, p.slug, 6);
  const discountPct = p.compare_at_price ? Math.round((1 - fp / p.compare_at_price) * 100) : undefined;

  const stockQty = variant ? variant.inventory_quantity : p.inventory_quantity;
  const trackedStock = stockQty !== null && stockQty !== undefined;
  const inStock = !trackedStock || stockQty! > 0;
  const lowStock = trackedStock && stockQty! > 0 && p.low_stock_threshold && stockQty! <= p.low_stock_threshold;

  function handleAdd() {
    if (!inStock) return;
    haptics.tap();
    addItem({ productId: p!.id, slug: p!.slug, name: p!.name, price: fp, image: p!.images?.[0] ?? "", size }, quantity);
    toast.success("Added to cart");
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <ProductGallery images={p.images ?? []} discountPct={discountPct} />

        <View style={s.info}>
          {p.collection && <Text style={s.cll}>{p.collection.name.toUpperCase()}</Text>}
          <View style={s.nr}>
            <Text style={s.n}>{p.name}</Text>
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                toggle(p.slug);
              }}
              style={s.hb}
            >
              <Heart size={20} strokeWidth={2} color={saved ? C.forest : C.mid} fill={saved ? C.forest : "transparent"} />
            </TouchableOpacity>
          </View>

          <View style={s.pr}>
            <Text style={s.price}>{formatPrice(fp)}</Text>
            {p.compare_at_price ? <Text style={s.st}>{formatPrice(p.compare_at_price)}</Text> : null}
          </View>

          {lowStock ? <Text style={s.lowStock}>Only {stockQty} left in stock</Text> : null}

          {p.highlights && p.highlights.length > 0 && (
            <View style={s.highlights}>
              {p.highlights.map((h, i) => (
                <View key={i} style={s.highlightRow}>
                  <View style={s.highlightDot} />
                  <Text style={s.highlightT}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.desc}>{p.description || p.short_description}</Text>

          {p.variants && p.variants.length > 0 && (
            <View style={s.sz}>
              <Text style={s.szl}>Size</Text>
              <View style={s.szr}>
                {p.variants.map((v) => {
                  const active = size === v.name;
                  const oos = v.inventory_quantity !== null && v.inventory_quantity !== undefined && v.inventory_quantity <= 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      disabled={oos}
                      onPress={() => {
                        haptics.select();
                        setSize(v.name);
                      }}
                      style={[s.szb, active && s.szba, oos && s.szbDisabled]}
                    >
                      <Text style={[s.szt, active && s.szta, oos && s.sztDisabled]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={s.qty}>
            <Text style={s.szl}>Quantity</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => { haptics.select(); setQuantity((q) => Math.max(1, q - 1)); }}>
                <Text style={s.qtyBtnT}>−</Text>
              </TouchableOpacity>
              <Text style={s.qtyV}>{quantity}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => { haptics.select(); setQuantity((q) => q + 1); }}>
                <Text style={s.qtyBtnT}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.acc}>
            {p.attributes && p.attributes.length > 0 && (
              <Accordion title="Specifications" defaultOpen>
                {p.attributes.map((a, i) => (
                  <View key={i} style={s.specRow}>
                    <Text style={s.specK}>{a.attribute?.name}</Text>
                    <Text style={s.specV}>{a.value?.value ?? a.text_value}</Text>
                  </View>
                ))}
              </Accordion>
            )}
            <Accordion title="Care">
              <Text style={s.ab}>{p.care_instructions || GENERIC_CARE}</Text>
            </Accordion>
            <Accordion title="Shipping & Returns">
              <Text style={s.ab}>{SHIPPING_COPY}</Text>
            </Accordion>
            {p.collection && "tagline" in (p.collection as any) && (p.collection as any).tagline ? (
              <Accordion title="Field Testing" bordered={false}>
                <Text style={s.ab}>{(p.collection as any).tagline}</Text>
              </Accordion>
            ) : null}
          </View>

          {related.length > 0 && (
            <View style={s.rail}>
              <Text style={s.sl}>You Might Also Like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {related.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).springify().damping(18)} style={{ width: 150 }}>
                    <ProductCard productId={r.id} slug={r.slug} name={r.name} price={r.price} imageUri={r.images?.[0] ?? ""} collectionLabel={r.collection?.name} />
                  </Animated.View>
                ))}
              </ScrollView>
            </View>
          )}

          {recentlyViewed.length > 0 && (
            <View style={s.rail}>
              <Text style={s.sl}>Recently Viewed</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {recentlyViewed.map((r) => (
                  <View key={r.id} style={{ width: 150 }}>
                    <ProductCard productId={r.id} slug={r.slug} name={r.name} price={r.price} imageUri={r.images?.[0] ?? ""} collectionLabel={r.collection?.name} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <ProductReviews productId={p.id} />
        </View>
      </ScrollView>

      <View style={s.bar}>
        <TouchableOpacity style={[s.add, !inStock && s.addDisabled]} activeOpacity={0.92} disabled={!inStock} onPress={handleAdd}>
          <Text style={s.addT}>{!inStock ? "Out of Stock" : `Add to Cart — ${formatPrice(fp * quantity)}`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  info: { paddingHorizontal: 24, paddingTop: 28 },
  cll: { fontFamily: F.mono, fontSize: 9, letterSpacing: 3, color: C.forest, marginBottom: 8 },
  nr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  n: { fontFamily: F.display, fontSize: 28, lineHeight: 32, color: C.text, flex: 1, marginRight: 16 },
  hb: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.surface, borderWidth: 1, borderColor: C.rule, alignItems: "center", justifyContent: "center" },
  pr: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 16 },
  price: { fontFamily: F.display, fontSize: 26, color: C.forest },
  st: { fontFamily: F.body, fontSize: 15, color: C.light, textDecorationLine: "line-through" },
  lowStock: { fontFamily: F.bodyBold, fontSize: 12, color: C.clay, marginTop: 8 },
  highlights: { marginTop: 16, gap: 8 },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  highlightDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.forest },
  highlightT: { fontFamily: F.body, fontSize: 13, color: C.mid },
  desc: { fontFamily: F.body, fontSize: 14, lineHeight: 23, color: C.mid, marginTop: 16 },
  sz: { marginTop: 28 },
  szl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 12 },
  szr: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  szb: { paddingHorizontal: 22, paddingVertical: 13, borderWidth: 1.5, borderColor: C.rule, borderRadius: R.md },
  szba: { borderColor: C.forest, backgroundColor: C.forest + "14" },
  szbDisabled: { opacity: 0.4 },
  szt: { fontFamily: F.bodyBold, fontSize: 14, color: C.text },
  szta: { color: C.forest },
  sztDisabled: { textDecorationLine: "line-through" },
  qty: { marginTop: 24 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  qtyBtn: { width: 38, height: 38, borderWidth: 1.5, borderColor: C.rule, borderRadius: R.md, alignItems: "center", justifyContent: "center" },
  qtyBtnT: { fontFamily: F.display, fontSize: 18, color: C.text },
  qtyV: { fontFamily: F.body, fontSize: 16, color: C.text, minWidth: 20, textAlign: "center" },
  acc: { marginTop: 36, borderTopWidth: 1, borderTopColor: C.rule },
  ab: { fontFamily: F.body, fontSize: 13, lineHeight: 21, color: C.mid, marginTop: 12 },
  specRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  specK: { fontFamily: F.body, fontSize: 12, color: C.light, textTransform: "uppercase" },
  specV: { fontFamily: F.body, fontSize: 13, color: C.text },
  rail: { marginTop: 40 },
  sl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 16 },
  bar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.rule, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 36 },
  add: { backgroundColor: C.forest, borderRadius: R.md, paddingVertical: 17, alignItems: "center" },
  addDisabled: { backgroundColor: C.light },
  addT: { fontFamily: F.bodyBold, fontSize: 14, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "700" },
});
