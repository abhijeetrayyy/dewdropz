import { RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { Img as Image } from "@/components/ui/Img";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Body, Meta, Mono, Numeric, Title } from "@/components/ui/Type";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRentalItemsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { useTabBarSpace } from "@/components/TabBar";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, R, S } from "@/lib/theme";

// The gear locker.
//
// Presented as a ruled index rather than a shop grid, because hiring is not
// shopping: the thing being compared is a day rate against a deposit against
// how the gear gets to you, not a photograph. Each row leads with the rate,
// says the deposit comes back, and states plainly whether the item can be
// posted — some of it is too bulky and finding that out at checkout would be
// a wasted trip.
export default function RentIndexScreen() {
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const { data: items = [], isLoading, isError, refetch } = useRentalItemsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  // The tab pill floats over the content, so every tab screen reserves its
  // height itself — see the contract in components/TabBar.tsx.
  const tabSpace = useTabBarSpace();

  return (
    <View style={s.root}>
      <StatusCap tone="forest" />
      <ScreenHeader
        tone="forest"
        showBack={false}
        eyebrow="The gear locker"
        title="Rent it"
        lede="A four-season tent is worth carrying and not worth owning if you use it twice a year. Everything here is checked, dried and re-lofted between trips."
        stats={items.length > 0 ? [{ label: "Available", value: String(items.length) }] : undefined}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: S.section + tabSpace }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >

        <View style={{ paddingHorizontal: S.gutter }}>
          {isError ? (
            <ErrorState message="Couldn't load the locker." onRetry={() => refetch()} />
          ) : isLoading ? (
            <SkeletonRows count={4} />
          ) : items.length === 0 ? (
            <EmptyState
              tone="forest"
              icon="camping"
              title="Nothing to rent just now"
              body="The locker is empty while we check the gear back in. Try again in a day or two."
            />
          ) : (
            items.map((it, i) => (
              <Animated.View key={it.id} entering={FadeInDown.delay(i * 40).duration(320)}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.name}, ${formatPrice(it.daily_rate)} a day`}
                  onPress={() => {
                    haptics.select();
                    router.push(`/rent/${it.slug}`);
                  }}
                  style={s.row}
                >
                  <View style={s.thumb}>
                    {it.images?.[0] ? (
                      <Image source={{ uri: it.images[0] }} style={s.img} contentFit="cover" alt="" />
                    ) : (
                      // An absent photograph is a real state. Saying so beats a
                      // grey rectangle that reads as a failed load.
                      <View style={s.imgEmpty}>
                        <Mono style={{ fontSize: 9 }}>NO PHOTO</Mono>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Title numberOfLines={1}>{it.name}</Title>
                    {!!it.summary && (
                      <Meta numberOfLines={2} style={{ marginTop: 2 }}>{it.summary}</Meta>
                    )}
                    <View style={s.figures}>
                      <Numeric style={{ fontSize: 15 }}>{formatPrice(it.daily_rate)}</Numeric>
                      <Body color={C.textMuted} style={{ fontSize: 13 }}> / day</Body>
                    </View>
                    <Mono style={{ fontSize: 10, marginTop: 2 }}>
                      {formatPrice(it.deposit)} DEPOSIT, REFUNDED
                    </Mono>
                    <Mono style={{ fontSize: 10, marginTop: 4, color: C.sageDeep }}>
                      {it.allows_pickup && it.allows_shipping
                        ? "COLLECT OR POSTED"
                        : it.allows_pickup
                          ? "COLLECTION ONLY"
                          : "POSTED ONLY"}
                    </Mono>
                  </View>
                </TouchableOpacity>
                <Rule />
              </Animated.View>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  row: { flexDirection: "row", gap: S.md, paddingVertical: S.md, alignItems: "flex-start" },
  thumb: { width: 88, height: 110, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  img: { width: "100%", height: "100%" },
  imgEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  figures: { flexDirection: "row", alignItems: "baseline", marginTop: S.xs },
});
