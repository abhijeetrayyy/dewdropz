import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOutLeft, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react-native";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { getCartRecommendations } from "@/lib/data";
import { FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/constants";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { C, F, R } from "@/lib/theme";

export default function CartScreen() {
  const { items, removeItem, updateQuantity, itemCount, subtotal } = useCartStore();
  const cnt = itemCount();
  const tot = subtotal();
  const rem = FREE_SHIPPING_THRESHOLD_PAISE - tot;
  const pct = Math.min(100, Math.round((tot / FREE_SHIPPING_THRESHOLD_PAISE) * 100));

  if (items.length === 0) return <Empty />;
  return <Full items={items} cnt={cnt} tot={tot} rem={rem} pct={pct} removeItem={removeItem} updateQuantity={updateQuantity} />;
}

function ProgressBar({ pct }: { pct: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 400 });
  }, [pct, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={s.pb}>
      <Animated.View style={[s.pf, style]} />
    </View>
  );
}

function Full({ items, cnt, tot, rem, pct, removeItem, updateQuantity }: any) {
  const { data: allProducts = [] } = useProductsQuery();
  const cartSlugs = items.map((i: any) => i.slug);
  const recs = getCartRecommendations(allProducts as any, cartSlugs, 6);

  return (
    <View style={s.root}>
      <Header />
      <View style={s.h}>
        <Text style={s.eb}>The Pack</Text>
        <View style={s.hr}>
          <Text style={s.t}>Your Cart</Text>
          <Text style={s.cn}>{cnt} piece{cnt !== 1 ? "s" : ""}</Text>
        </View>
        <Text style={s.sh}>Ships from Dehradun in 2 days.</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 300 }}>
        {items.map((it: any) => (
          <Animated.View key={`${it.productId}-${it.size}`} exiting={FadeOutLeft}>
            <Swipeable
              renderRightActions={() => (
                <TouchableOpacity
                  style={s.swipeDelete}
                  onPress={() => {
                    haptics.warning();
                    removeItem(it.productId, it.size);
                    toast.show("Removed from cart");
                  }}
                >
                  <Trash2 size={18} strokeWidth={2} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            >
              <View style={s.itm}>
                <TouchableOpacity onPress={() => router.push(`/product/${it.slug}`)} style={s.imw}>
                  {it.image ? (
                    <Image source={{ uri: it.image }} style={s.im} contentFit="cover" />
                  ) : (
                    <View style={s.imp}>
                      <Text style={s.impT}>DZ</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={s.ib}>
                  <View style={s.it}>
                    <TouchableOpacity onPress={() => router.push(`/product/${it.slug}`)} style={{ flex: 1 }}>
                      <Text style={s.inm} numberOfLines={2}>{it.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { haptics.tap(); removeItem(it.productId, it.size); toast.show("Removed from cart"); }}
                      hitSlop={12}
                    >
                      <Trash2 size={16} strokeWidth={1.5} color={C.light} />
                    </TouchableOpacity>
                  </View>
                  {it.size && <Text style={s.isz}>Size: {it.size}</Text>}
                  <View style={s.ibm}>
                    <View style={s.qr}>
                      <TouchableOpacity onPress={() => { haptics.select(); updateQuantity(it.productId, it.quantity - 1, it.size); }} style={s.qb}>
                        <Minus size={14} strokeWidth={1.5} color={C.text} />
                      </TouchableOpacity>
                      <Text style={s.qv}>{it.quantity}</Text>
                      <TouchableOpacity onPress={() => { haptics.select(); updateQuantity(it.productId, it.quantity + 1, it.size); }} style={s.qb}>
                        <Plus size={14} strokeWidth={1.5} color={C.text} />
                      </TouchableOpacity>
                    </View>
                    <Text style={s.ip}>{formatPrice(it.price * it.quantity)}</Text>
                  </View>
                </View>
              </View>
            </Swipeable>
          </Animated.View>
        ))}

        {recs.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={s.crossSellL}>Complete the Kit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {recs.map((r) => (
                <View key={r.id} style={{ width: 150 }}>
                  <ProductCard productId={r.id} slug={r.slug} name={r.name} price={r.price} imageUri={r.images?.[0] ?? ""} collectionLabel={r.collection?.name} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={s.sum}>
        {rem > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <ProgressBar pct={pct} />
            <Text style={s.pt}>
              Add <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{formatPrice(rem)}</Text> for free shipping
            </Text>
          </View>
        ) : (
          <View style={s.fr}>
            <Text style={s.frt}>✓ Free shipping unlocked</Text>
          </View>
        )}
        <View style={s.tr}>
          <View>
            <Text style={s.tl}>Subtotal</Text>
            <Text style={s.tv}>{formatPrice(tot)}</Text>
          </View>
          <Text style={s.tc}>{cnt} item{cnt !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity style={s.ck} onPress={() => { haptics.tap(); router.push("/checkout"); }} activeOpacity={0.9}>
          <Text style={s.ckt}>Proceed to Checkout</Text>
          <ArrowRight size={18} strokeWidth={2} color={C.forest} />
        </TouchableOpacity>
        <Text style={s.tstr}>COD available · 7‑day returns</Text>
      </View>
    </View>
  );
}

function Empty() {
  const { data: cols = [] } = useCollectionsQuery();
  return (
    <View style={s.root}>
      <Header />
      <View style={[s.emW, { paddingTop: 24 }]}>
        <Animated.View entering={FadeInDown.springify()} style={s.emC}>
          <Text style={s.eb}>The Pack</Text>
          <Text style={s.emT}>Your cart is empty.</Text>
          <Text style={s.emB}>Nothing packed yet. Go find something worth carrying uphill.</Text>
          <TouchableOpacity style={s.emBtn} onPress={() => router.push("/shop")}>
            <Text style={s.emBtnT}>Explore Gear</Text>
            <ArrowRight size={16} strokeWidth={1.5} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
        <View style={s.emCl}>
          <Text style={s.emClL}>Three conditions, three kits</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {cols.map((c: any) => (
              <TouchableOpacity key={c.id} onPress={() => router.push(`/collections/${c.slug}`)} style={s.emCa}>
                {c.image_url ? <Image source={{ uri: c.image_url }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ink + "80" }} />
                <View style={{ flex: 1, justifyContent: "flex-end", padding: 14 }}>
                  <Text style={{ fontFamily: F.display, fontSize: 16, color: "#FFFFFF" }}>{c.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 8 },
  h: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.rule },
  hr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  t: { fontFamily: F.display, fontSize: 32, color: C.text },
  cn: { fontFamily: F.body, fontSize: 13, color: C.light },
  sh: { fontFamily: F.body, fontSize: 13, color: C.mid, marginTop: 6 },
  itm: { flexDirection: "row", marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.rule, backgroundColor: C.paper },
  swipeDelete: { backgroundColor: C.clay, width: 64, alignItems: "center", justifyContent: "center", borderRadius: R.md, marginBottom: 20 },
  imw: { width: 90, height: 110, borderRadius: R.md, overflow: "hidden", backgroundColor: C.rule },
  im: { width: "100%", height: "100%" },
  imp: { flex: 1, alignItems: "center", justifyContent: "center" },
  impT: { fontFamily: F.mono, fontSize: 10, color: C.light, letterSpacing: 2 },
  ib: { flex: 1, marginLeft: 16, justifyContent: "space-between" },
  it: { flexDirection: "row", justifyContent: "space-between" },
  inm: { fontFamily: F.body, fontSize: 15, fontWeight: "500", color: C.text, lineHeight: 21 },
  isz: { fontFamily: F.body, fontSize: 12, color: C.light, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  ibm: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qr: { flexDirection: "row", alignItems: "center", gap: 12 },
  qb: { width: 32, height: 32, borderWidth: 1.5, borderColor: C.rule, borderRadius: R.sm, alignItems: "center", justifyContent: "center" },
  qv: { fontFamily: F.body, fontSize: 15, color: C.text, width: 24, textAlign: "center" },
  ip: { fontFamily: F.bodyBold, fontSize: 15, color: C.forest },
  crossSellL: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 16 },
  // A docked, edge-to-edge green footer — not a floating rounded card with
  // side margins over scrolling content, which read as an unintentional
  // stray overlay rather than a deliberate checkout panel.
  sum: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.forest,
    borderTopLeftRadius: R.md + 10, borderTopRightRadius: R.md + 10,
    paddingHorizontal: 24, paddingTop: 22, paddingBottom: 20,
  },
  pb: { height: 5, borderRadius: 3, backgroundColor: "#FFFFFF33", marginBottom: 10, overflow: "hidden" },
  pf: { height: 5, borderRadius: 3, backgroundColor: "#FFFFFF" },
  pt: { fontFamily: F.body, fontSize: 12, color: C.paper + "CC" },
  fr: { backgroundColor: "#FFFFFF1F", borderRadius: R.md, paddingVertical: 10, alignItems: "center", marginBottom: 16 },
  frt: { fontFamily: F.bodyBold, fontSize: 12, color: "#FFFFFF" },
  tr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 },
  tl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.paper + "99" },
  tv: { fontFamily: F.display, fontSize: 26, color: "#FFFFFF" },
  tc: { fontFamily: F.body, fontSize: 12, color: C.paper + "99" },
  ck: { backgroundColor: "#FFFFFF", borderRadius: R.md, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ckt: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest, letterSpacing: 0.3, fontWeight: "700" },
  tstr: { fontFamily: F.body, fontSize: 11, color: C.paper + "80", textAlign: "center", marginTop: 12 },
  emW: { flex: 1 },
  emC: { alignItems: "center", paddingHorizontal: 24, marginBottom: 40, paddingTop: 40 },
  emT: { fontFamily: F.display, fontSize: 26, color: C.text, marginTop: 8, textAlign: "center" },
  emB: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center", marginTop: 10, lineHeight: 21, maxWidth: 280 },
  emBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.forest, borderRadius: R.md, paddingHorizontal: 26, paddingVertical: 15, marginTop: 24 },
  emBtnT: { fontFamily: F.bodyBold, fontSize: 13, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "700" },
  emCl: { paddingVertical: 20 },
  emClL: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, textAlign: "center", marginBottom: 16 },
  emCa: { width: 180, height: 230, borderRadius: R.md, overflow: "hidden" },
});
