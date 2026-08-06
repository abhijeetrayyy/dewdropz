import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useWishlistStore } from "@/stores/wishlist";
import { ProductCard } from "@/components/ProductCard";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { useProductsBySlugsQuery, useProductsQuery } from "@/lib/queries";
import { getCartRecommendations } from "@/lib/data";
import { usePullToRefresh } from "@/lib/hooks";
import { useCartStore } from "@/stores/cart";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, F } from "@/lib/theme";

export default function WishlistScreen() {
  const { slugs } = useWishlistStore();
  const { data: products = [], isLoading, isError, refetch } = useProductsBySlugsQuery(slugs);
  const { data: allProducts = [] } = useProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const addItem = useCartStore((s) => s.addItem);

  const groups = useMemo(() => {
    const byCollection = new Map<string, { name: string; tagline?: string; items: any[] }>();
    for (const p of products as any[]) {
      const key = p.collection?.id ?? "none";
      if (!byCollection.has(key)) byCollection.set(key, { name: p.collection?.name ?? "Other", items: [] });
      byCollection.get(key)!.items.push(p);
    }
    return [...byCollection.values()];
  }, [products]);

  const recs = getCartRecommendations(allProducts as any, slugs, 6);

  function addAllToCart() {
    haptics.tap();
    for (const p of products as any[]) {
      addItem({ productId: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images?.[0] ?? "", size: p.variants?.[0]?.name });
    }
    toast.success(`Added ${products.length} item${products.length !== 1 ? "s" : ""} to cart`);
  }

  return (
    <View style={S.root}>
      <Header />
      <ScrollView
        contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 24, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
      >
        <Text style={S.eb}>Wishlist</Text>
        <View style={S.hr}>
          <Text style={S.t}>Saved for later</Text>
          {products.length > 0 && (
            <TouchableOpacity onPress={addAllToCart}>
              <Text style={S.addAll}>Add all to cart</Text>
            </TouchableOpacity>
          )}
        </View>
        {products.length > 0 && <Text style={S.sub}>{products.length} piece{products.length !== 1 ? "s" : ""} saved · free shipping over ₹2,000 · 7-day returns</Text>}

        {isLoading ? (
          <View style={{ marginTop: 24 }}>
            <SkeletonProductGrid count={4} />
          </View>
        ) : isError ? (
          <ErrorState message="Couldn't load your wishlist." onRetry={() => refetch()} />
        ) : slugs.length === 0 ? (
          <EmptyState title="Nothing saved yet" body="Tap the heart on any product to save it here." ctaLabel="Browse Gear" ctaHref="/shop" />
        ) : groups.length > 1 ? (
          groups.map((g, gi) => (
            <View key={gi} style={{ marginTop: 24 }}>
              <Text style={S.groupL}>{g.name}</Text>
              <View style={S.grid}>
                {g.items.map((p: any, i: number) => (
                  <Animated.View key={p.id} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={{ width: "48%", marginBottom: 24 }}>
                    <ProductCard productId={p.id} slug={p.slug} name={p.name} price={p.price} imageUri={p.images?.[0] ?? ""} collectionLabel={p.collection?.name} />
                  </Animated.View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={[S.grid, { marginTop: 20 }]}>
            {(products as any[]).map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={{ width: "48%", marginBottom: 24 }}>
                <ProductCard productId={p.id} slug={p.slug} name={p.name} price={p.price} imageUri={p.images?.[0] ?? ""} collectionLabel={p.collection?.name} />
              </Animated.View>
            ))}
          </View>
        )}

        {recs.length > 0 && slugs.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <Text style={S.groupL}>Complete the Kit</Text>
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
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 6 },
  hr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  t: { fontFamily: F.display, fontSize: 28, color: C.text },
  addAll: { fontFamily: F.bodyBold, fontSize: 12, color: C.forest, letterSpacing: 0.3, fontWeight: "700" },
  sub: { fontFamily: F.body, fontSize: 12, color: C.light, marginTop: 8 },
  groupL: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
