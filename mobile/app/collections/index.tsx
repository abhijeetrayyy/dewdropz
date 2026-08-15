import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Mono, Serif } from "@/components/ui/Type";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

// New on mobile. The web app has had /collections since launch; mobile could
// only reach a collection by tapping one of three tiles buried on Home, so two
// thirds of the merchandising structure was effectively unreachable.
//
// Presented as a contents page: full-bleed plate, serif name, and the real
// piece-count and entry price underneath, so the index is genuinely useful
// rather than three more pretty rectangles.
export default function CollectionsIndexScreen() {
  const { data: collections = [], isLoading, isError, refetch } = useCollectionsQuery();
  const { data: products = [] } = useProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  return (
    <View style={s.root}>
      <StatusCap />
      {/* These are paper screens pushed from dark-hero ones (product,
          collection, article). expo-status-bar is last-mount-wins, so
          without an explicit dark style here the light glyphs set by the
          pushing screen persist and the clock vanishes into the paper. */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        <ScreenHeader
          eyebrow="The index"
          title="Collections"
          lede="Every piece we make belongs to one set of conditions. Start with the weather you're walking into."
          stats={
            collections.length > 0
              ? [
                  { label: "Collections", value: String(collections.length) },
                  { label: "Pieces", value: String(products.length) },
                ]
              : undefined
          }
        />

        <View style={{ paddingHorizontal: S.gutter }}>
          {isError ? (
            <ErrorState message="Couldn't load the collections." onRetry={() => refetch()} />
          ) : isLoading ? (
            <View style={{ gap: S.xl }}>
              {[1, 2, 3].map((i) => (
                <View key={i}>
                  <Skeleton height={230} radius={R.card} />
                  <Skeleton height={14} width="45%" style={{ marginTop: 12 }} />
                </View>
              ))}
            </View>
          ) : collections.length === 0 ? (
            <EmptyState
              eyebrow="Empty"
              title="No collections yet."
              body="They'll appear here as soon as they're published."
              ctaLabel="Browse all gear"
              ctaHref="/(tabs)/shop"
            />
          ) : (
            <View style={{ gap: S.block }}>
              {(collections as any[]).map((c, i) => {
                const inCollection = (products as any[]).filter((p) => p.collection?.slug === c.slug);
                const from = inCollection.length ? Math.min(...inCollection.map((p) => p.price)) : 0;

                return (
                  <Animated.View key={c.id} entering={FadeInDown.delay(i * 70).duration(380)}>
                    <TouchableOpacity
                      activeOpacity={0.94}
                      onPress={() => {
                        haptics.tap();
                        router.push(`/collections/${c.slug}`);
                      }}
                    >
                      <View style={s.plate}>
                        {c.image_url ? (
                          <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={240} alt="" />
                        ) : null}
                        <LinearGradient
                          colors={["rgba(12,18,15,0.1)", "rgba(12,18,15,0.78)"]}
                          locations={[0.3, 1]}
                          style={StyleSheet.absoluteFill}
                        />
                        <View style={s.plateIndex}>
                          <Text style={s.plateIndexT}>{String(i + 1).padStart(2, "0")}</Text>
                        </View>
                        <View style={s.plateBody}>
                          <Serif color={C.paper}>{c.name}</Serif>
                          {c.tagline ? (
                            <Body color="rgba(255,255,255,0.82)" style={{ marginTop: 6 }}>
                              {c.tagline}
                            </Body>
                          ) : null}
                        </View>
                      </View>

                      <View style={s.meta}>
                        <Mono color={C.textMuted}>
                          {inCollection.length} {inCollection.length === 1 ? "PIECE" : "PIECES"}
                          {from ? ` · FROM ${formatPrice(from)}` : ""}
                        </Mono>
                        <View style={s.go}>
                          <Text style={s.goT}>See the kit</Text>
                          <Icon name="arrow_forward" size={16} color={C.ink} />
                        </View>
                      </View>
                      <Rule weight="soft" />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  plate: { height: 260, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand, justifyContent: "flex-end" },
  plateIndex: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(12,18,15,0.5)", borderRadius: R.tag, paddingHorizontal: 7, paddingVertical: 3 },
  plateIndexT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },
  plateBody: { padding: S.md },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: S.md },
  go: { flexDirection: "row", alignItems: "center", gap: 5 },
  goT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
});
