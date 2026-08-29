import { RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Meta, Mono, Numeric, Title } from "@/components/ui/Type";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/stores/auth";
import { useMyRentalBookingsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { prettyDate } from "@/lib/rent/dates";
import { formatPrice } from "@/lib/utils";
import { C, S } from "@/lib/theme";

const DEPOSIT_NOTE: Record<string, string> = {
  pending: "Deposit due at the counter",
  held: "Deposit held",
  refunded: "Deposit returned",
  forfeited: "Deposit kept",
  waived: "Deposit waived",
};

export default function MyRentalsScreen() {
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const { user } = useAuthStore();
  const { data: bookings = [], isLoading, refetch } = useMyRentalBookingsQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  const live = bookings.filter((b) => b.status === "reserved" || b.status === "out").length;

  return (
    <View style={s.root}>
      <StatusCap tone="warm" />
      <ScreenHeader
        tone="warm"
        eyebrow="The locker"
        title="Your rentals"
        lede={bookings.length === 0 ? "Gear you've booked shows up here with its dates and its deposit." : undefined}
        stats={bookings.length > 0 ? [
          { label: "In flight", value: String(live) },
          { label: "All time", value: String(bookings.length) },
        ] : undefined}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >

        <View style={{ paddingHorizontal: S.gutter }}>
          {!user ? (
            <EmptyState
              tone="forest"
              icon="lock"
              title="Sign in to see your rentals"
              body="Bookings are private to the account that made them."
              ctaLabel="Sign in"
              ctaHref="/auth/login"
            />
          ) : isLoading ? (
            <SkeletonRows count={3} />
          ) : bookings.length === 0 ? (
            <EmptyState
              tone="forest"
              icon="camping"
              title="Nothing rented yet"
              body="Tents, packs and poles, by the day — checked and dried between trips."
              ctaLabel="Browse the locker"
              onPress={() => router.push("/rent")}
            />
          ) : (
            bookings.map((b, i) => {
              const owed = b.late_fee + b.damage_fee;
              return (
                <Animated.View key={b.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                  <View style={s.row}>
                    <View style={s.head}>
                      <StatusPill domain="rental" status={b.status} />
                      <Mono style={{ fontSize: 10 }}>{b.booking_number}</Mono>
                    </View>

                    {b.reservations?.map((r) => (
                      <View key={r.id} style={s.item}>
                        <Title numberOfLines={1} style={{ flex: 1 }}>{r.item?.name ?? "Gear"}</Title>
                        <Meta>{prettyDate(r.starts_on)} → {prettyDate(r.ends_on)}</Meta>
                      </View>
                    ))}

                    <View style={s.foot}>
                      <Meta>{DEPOSIT_NOTE[b.deposit_state] ?? "Deposit"} · {formatPrice(b.deposit_amount)}</Meta>
                      <Numeric style={{ fontSize: 14 }}>{formatPrice(b.total_amount)}</Numeric>
                    </View>

                    {owed > 0 && (
                      <Meta color={C.danger} style={{ marginTop: 2 }}>
                        Deducted from the deposit: {formatPrice(owed)}
                        {b.late_fee > 0 ? ` (late ${formatPrice(b.late_fee)})` : ""}
                        {b.damage_fee > 0 ? ` (damage ${formatPrice(b.damage_fee)})` : ""}
                      </Meta>
                    )}
                  </View>
                  <Rule />
                </Animated.View>
              );
            })
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  row: { paddingVertical: S.md, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  item: { flexDirection: "row", alignItems: "baseline", gap: S.sm },
  foot: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 },
});
