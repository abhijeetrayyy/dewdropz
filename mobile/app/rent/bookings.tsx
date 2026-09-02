import { useRef, useState } from "react";
import { RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as WebBrowser from "expo-web-browser";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Meta, Mono, Numeric, Title } from "@/components/ui/Type";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/ui/Icon";
import { Body } from "@/components/ui/Type";
import { toast } from "@/components/ui/Toast";
import { CancelRentalSheet } from "@/components/rent/CancelRentalSheet";
import { RentalHistory } from "@/components/rent/RentalHistory";
import { useMyRentalBookingsQuery, rentalPayUrl } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { prettyDate } from "@/lib/rent/dates";
import { formatPrice } from "@/lib/utils";
import { C, R, S } from "@/lib/theme";

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
  // How much room the floating header needs at the top of the scroll
  // content. The panel is out of the layout so its collapse cannot resize
  // this list mid-drag — see ScreenHeader. It reports its height here.
  const [headerH, setHeaderH] = useState(0);
  const { user } = useAuthStore();
  const { data: bookings = [], isLoading, refetch } = useMyRentalBookingsQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  const cancelRef = useRef<BottomSheetModal>(null);
  const [cancelling, setCancelling] = useState<{ id: string; number: string } | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const live = bookings.filter((b) => b.status === "reserved" || b.status === "out").length;
  // Counted separately from `live`, because a hold is not a booking anybody has
  // yet — it is a countdown, and it is the one thing on this screen that needs
  // doing today.
  const holds = bookings.filter((b) => b.status === "pending_payment").length;

  /** Reopen the hosted payment sheet for a hold, then believe the database
   *  rather than the browser about what happened. */
  async function finishPaying(bookingId: string) {
    setPaying(bookingId);
    try {
      await WebBrowser.openAuthSessionAsync(rentalPayUrl(bookingId), "dewdropz://rent");
      const fresh = await refetch();
      const row = fresh.data?.find((b) => b.id === bookingId);
      if (row?.status === "reserved") toast.success("Paid — the gear is reserved for your dates.");
      else if (row?.status === "cancelled") {
        toast.error("That hold expired and the gear is back on the shelf. Nothing was charged.");
      }
    } finally {
      setPaying(null);
    }
  }

  return (
    <View style={s.root}>
      <StatusCap tone="warm" />
      <ScreenHeader
        tone="warm"
        eyebrow="The locker"
        title="Your rentals"
        lede={bookings.length === 0 ? "Gear you've booked shows up here with its dates and its deposit." : undefined}
        stats={bookings.length > 0 ? [
          ...(holds > 0 ? [{ label: "Awaiting payment", value: String(holds) }] : []),
          { label: "In flight", value: String(live) },
          { label: "All time", value: String(bookings.length) },
        ] : undefined}
        scrollY={scrollY}
        onHeight={setHeaderH}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerH} tintColor={C.ink} />}
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

                    {/* ── The one state that is asking for something ──────────
                        A hold is gear set aside with a countdown against it,
                        and this is the only action on the screen that is
                        blocking. It leads, and it says that nothing has been
                        charged — because the fear a half-finished payment
                        creates is "have I been billed for nothing?" */}
                    {b.status === "pending_payment" && (
                      <TouchableOpacity
                        onPress={() => finishPaying(b.id)}
                        disabled={paying === b.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Finish paying for ${b.booking_number}`}
                        style={s.payBar}
                      >
                        <Icon name="schedule" size={16} color={C.clayDeep} />
                        <Body style={{ flex: 1, fontSize: 12.5 }} color={C.clayDeep}>
                          {paying === b.id
                            ? "Opening the payment window…"
                            : `Held while you pay — tap to finish. Nothing has been charged.`}
                        </Body>
                        <Numeric style={{ fontSize: 13 }} color={C.clayDeep}>{formatPrice(b.total_amount)}</Numeric>
                      </TouchableOpacity>
                    )}

                    {/* What happened to the money, said on the card rather than
                        left to be inferred from a bank statement. */}
                    {b.status === "cancelled" && (
                      <Meta style={{ marginTop: 2 }}>
                        {b.cancelled_by === "expired"
                          ? "The payment was not completed in time, so the gear went back on the shelf. Nothing was charged."
                          : b.cancelled_by === "shop"
                            ? "We cancelled this one, so everything you paid has been refunded in full."
                            : b.rent_refunded > 0
                              ? `Cancelled — ${formatPrice(b.rent_refunded)} refunded to the account you paid from.`
                              : "Cancelled."}
                      </Meta>
                    )}

                    <View style={s.actions}>
                      <TouchableOpacity
                        onPress={() => setOpenHistory(openHistory === b.id ? null : b.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: openHistory === b.id }}
                        style={s.action}
                      >
                        <Icon name="history" size={14} color={C.textMid} />
                        <Meta>{openHistory === b.id ? "Hide" : "What happened"}</Meta>
                      </TouchableOpacity>

                      {/* A hold can be called off as well as a reservation —
                          it is somebody changing their mind at the payment
                          sheet, and there is nothing to charge for. */}
                      {(b.status === "reserved" || b.status === "pending_payment") && (
                        <TouchableOpacity
                          onPress={() => { setCancelling({ id: b.id, number: b.booking_number }); cancelRef.current?.present(); }}
                          accessibilityRole="button"
                          style={s.action}
                        >
                          <Icon name="block" size={14} color={C.textMid} />
                          <Meta>Cancel</Meta>
                        </TouchableOpacity>
                      )}
                    </View>

                    {openHistory === b.id && <RentalHistory bookingId={b.id} />}
                  </View>
                  <Rule />
                </Animated.View>
              );
            })
          )}
        </View>
      </Animated.ScrollView>

      <CancelRentalSheet
        ref={cancelRef}
        bookingId={cancelling?.id ?? null}
        bookingNumber={cancelling?.number ?? ""}
        onCancelled={() => { setCancelling(null); refetch(); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  row: { paddingVertical: S.md, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  item: { flexDirection: "row", alignItems: "baseline", gap: S.sm },
  foot: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 },
  payBar: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    backgroundColor: C.clay12, borderRadius: R.panel,
    paddingHorizontal: S.md, paddingVertical: 10, marginTop: S.sm,
  },
  actions: { flexDirection: "row", gap: S.lg, marginTop: S.sm },
  action: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
});
