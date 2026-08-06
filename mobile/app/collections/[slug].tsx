import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { C, F } from "@/lib/theme";

export default function CollectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: collections = [], isLoading: colsLoading, isError: colsError, refetch: refetchCols } = useCollectionsQuery();
  const { data: allProducts = [], isLoading: prodLoading, isError: prodError, refetch: refetchProds } = useProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetchCols, refetchProds]);

  const c = collections.find((x: any) => x.slug === slug) ?? null;
  const products = allProducts.filter((p: any) => p.collection?.slug === slug);
  const loading = colsLoading || prodLoading;
  const error = colsError || prodError;

  return (
    <View style={S.root}>
      <StatusBar style={c ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
      >
        {loading ? (
          <View style={{ paddingTop: 24 }}>
            <SkeletonProductGrid count={4} />
          </View>
        ) : error ? (
          <ErrorState message="Couldn't load this collection." onRetry={() => { refetchCols(); refetchProds(); }} />
        ) : !c ? (
          <EmptyState title="Collection not found" />
        ) : (
          <>
            <View style={S.hero}>
              {c.image_url ? <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={S.ov} />
              <View style={S.body}>
                <Text style={S.eb}>Collection</Text>
                <Text style={S.n}>{c.name}</Text>
                {c.tagline ? <Text style={S.tag}>{c.tagline}</Text> : null}
              </View>
            </View>
            <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
              {products.length === 0 ? (
                <EmptyState title="More pieces on the way" body="This collection is being restocked — check back soon." />
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                  {products.map((p: any, i: number) => (
                    <Animated.View key={p.id} entering={FadeInDown.delay(i * 50).springify().damping(18)} style={{ width: "48%", marginBottom: 24 }}>
                      <ProductCard productId={p.id} slug={p.slug} name={p.name} price={p.price} imageUri={p.images?.[0] ?? ""} collectionLabel={p.collection?.name} />
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  hero: { height: 260, justifyContent: "flex-end" },
  ov: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ink + "73" },
  body: { padding: 24 },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.sage, marginBottom: 10 },
  n: { fontFamily: F.display, fontSize: 36, lineHeight: 38, color: "#FFFFFF" },
  tag: { fontFamily: F.displayItalic, fontSize: 15, color: "#FFFFFFCC", marginTop: 8 },
});
