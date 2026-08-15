import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useWishlistStore } from "@/stores/wishlist";
import { ProductCard } from "@/components/ProductCard";
import { StatusCap } from "@/components/ui/StatusCap";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Body, Mono } from "@/components/ui/Type";
import { useProductsBySlugsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { useCartStore } from "@/stores/cart";
import { formatPrice, pickVariant } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, R, S } from "@/lib/theme";

// Saved. Reached from the You tab and from heart toggles on product cards —
// not a tab of its own.
//
// The low-stock notice is the one genuinely useful thing this screen can do
// that a grid can't, so it's a proper ruled alert at the top rather than v4's
// marigold rounded box, and it now names every at-risk piece instead of just
// the first one it happened to find.
export default function SavedScreen() {
  const { slugs } = useWishlistStore();
  const { data: products = [], isLoading, isError, refetch } = useProductsBySlugsQuery(slugs);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const addItem = useCartStore((st) => st.addItem);

  const lowStock = useMemo(
    () => (products as any[]).filter((p) => p.inventory_quantity != null && p.inventory_quantity <= 3),
    [products],
  );
  const total = useMemo(() => (products as any[]).reduce((sum, p) => sum + p.price, 0), [products]);

  function addAllToPack() {
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
    toast.success(`Added ${products.length} item${products.length !== 1 ? "s" : ""} to pack`);
  }

  return (
    <View style={s.root}>
      <StatusCap />
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        <ScreenHeader
          eyebrow="Kept for later"
          title="Saved"
          lede={products.length === 0 ? "Tap the heart on any piece and it waits for you here." : undefined}
          stats={
            products.length > 0
              ? [
                  { label: "Pieces", value: String(products.length) },
                  { label: "Altogether", value: formatPrice(total) },
                  ...(lowStock.length > 0
                    ? [{ label: "Running low", value: String(lowStock.length) }]
                    : []),
                ]
              : undefined
          }
        />

        <View style={{ paddingHorizontal: S.gutter }}>
          {lowStock.length > 0 ? (
            <View style={s.alert}>
              <Icon name="notifications_active" size={19} color={C.clayDeep} />
              <View style={{ flex: 1 }}>
                <Mono color={C.clayDeep}>RUNNING LOW</Mono>
                <Body color={C.textMid} style={{ marginTop: 4 }}>
                  {lowStock.length === 1
                    ? `${lowStock[0].name} is down to ${lowStock[0].inventory_quantity} pieces.`
                    : `${lowStock.length} saved pieces are down to their last few.`}{" "}
                  We&apos;ll tell you before they go.
                </Body>
              </View>
            </View>
          ) : null}

          {isLoading ? (
            <SkeletonProductGrid count={4} />
          ) : isError ? (
            <ErrorState message="Couldn't load your saved gear." onRetry={() => refetch()} />
          ) : products.length === 0 ? (
            // Keyed on what actually RESOLVED, not on how many slugs are stored.
            // A saved slug whose product has since been unpublished or deleted
            // still counts in `slugs`, so the old check fell through to the grid
            // branch and rendered "0 PIECES", an "Add all to pack" button and a
            // rule above an empty void — no empty state at all.
            <EmptyState
              eyebrow="Nothing saved"
              icon="favorite"
              title={slugs.length > 0 ? "Nothing left to show." : "Keep a shortlist."}
              body={
                slugs.length > 0
                  ? "The pieces you saved aren't available any more. Anything you save from here on will wait for you in this list."
                  : "Tap the heart on any piece and it'll wait for you here — across every device you sign in on."
              }
              ctaLabel="Browse the gear room"
              onPress={() => router.push("/(tabs)/shop")}
            />
          ) : (
            <>
              <View style={s.actions}>
                <Mono color={C.textMuted}>
                  {products.length} {products.length === 1 ? "PIECE" : "PIECES"}
                </Mono>
                <Button title="Add all to pack" variant="quiet" size="md" onPress={addAllToPack} />
              </View>
              <Rule weight="ink" />

              <View style={s.grid}>
                {(products as any[]).map((p, i) => (
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
                      tag={
                        p.inventory_quantity != null && p.inventory_quantity <= 3
                          ? { label: `${p.inventory_quantity} LEFT`, tone: "scarcity" }
                          : undefined
                      }
                      showHeart
                      variants={p.variants}
                      showQuickAdd
                    />
                  </Animated.View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  alert: {
    flexDirection: "row",
    gap: S.md,
    alignItems: "flex-start",
    backgroundColor: C.clay12,
    borderRadius: R.panel,
    padding: S.md,
    marginBottom: S.xl,
  },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: S.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl, marginTop: S.xl },
  cell: { width: "48%" },
});
