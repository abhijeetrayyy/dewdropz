import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Body, Meta, Mono, Numeric, Title } from "@/components/ui/Type";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRentalBookingQuery } from "@/lib/queries";
import { prettyDate } from "@/lib/rent/dates";
import { formatPrice } from "@/lib/utils";
import { C, F, R, S } from "@/lib/theme";

/**
 * Paid, and reserved.
 *
 * THIS SCREEN USED TO OPEN "deliberately not a receipt: nothing has been paid",
 * which was true when a rental was settled at a counter and became the most
 * misleading sentence in the app the moment paying became how a reservation is
 * made. It is now reached only after the payment has been confirmed against the
 * database — the item screen re-reads the booking before pushing here rather
 * than trusting the browser sheet — so it can say "paid" and mean it.
 *
 * What the reader still needs is the deposit, which is NOT paid here, and what
 * to bring. Those it says, and stops.
 *
 * A guest booking is readable here only because it was just made; the RLS
 * policy on `rental_bookings` is "own bookings", so signing in is what makes
 * it reachable again later. The empty state says that rather than pretending
 * the booking failed.
 */
export default function RentalBookedScreen() {
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  // How much room the floating header needs at the top of the scroll
  // content. The panel is out of the layout so its collapse cannot resize
  // this list mid-drag — see ScreenHeader. It reports its height here.
  const [headerH, setHeaderH] = useState(0);
  const { number } = useLocalSearchParams<{ number: string }>();
  const { data: booking, isLoading } = useRentalBookingQuery(number);

  return (
    <View style={s.root}>
      <StatusCap tone="forest" />
      <ScreenHeader
        tone="forest"
        eyebrow="Held for you"
        title="Your gear is booked"
        onBack={() => goBack("/rent")}
        scrollY={scrollY}
        onHeight={setHeaderH}
      />

      <Animated.ScrollView contentContainerStyle={{ paddingTop: headerH, paddingBottom: S.section }} showsVerticalScrollIndicator={false} ref={scrollRef}>

        <View style={{ paddingHorizontal: S.gutter }}>
          <Animated.View entering={FadeInDown.duration(320)} style={s.badge}>
            <Icon name="check_circle" size={20} color={C.forest} filled />
            <View style={{ flex: 1 }}>
              <Mono style={{ fontSize: 10 }}>BOOKING NUMBER</Mono>
              <Numeric style={{ fontSize: 18, marginTop: 2 }}>{number}</Numeric>
            </View>
          </Animated.View>

          {isLoading ? (
            <View style={{ gap: S.sm, marginTop: S.lg }}>
              <Skeleton height={20} width="70%" />
              <Skeleton height={16} />
            </View>
          ) : !booking ? (
            // NOT a failure state, so it must not read like one. The default
            // eyebrow is "Nothing here", which sat directly under the words
            // "Your gear is booked" and flatly contradicted them. A guest
            // booking genuinely cannot be read back — RLS on rental_bookings
            // is "own bookings" — and saying which is the whole job here.
            <EmptyState
              tone="forest"
              eyebrow="Kept private"
              icon="lock"
              title="It's held — sign in to see the detail"
              body="The booking is confirmed and the email is on its way. Bookings are private to the account that made them, so signing in with this address is what brings the dates and the deposit back on screen."
              ctaLabel="Sign in"
              ctaHref="/auth/login"
              style={{ marginTop: S.lg }}
            />
          ) : (
            <>
              <Rule style={{ marginVertical: S.lg }} />
              {booking.reservations?.map((r) => (
                <View key={r.id} style={s.line}>
                  <View style={{ flex: 1 }}>
                    <Title numberOfLines={1}>{r.item?.name ?? "Gear"}</Title>
                    <Meta style={{ marginTop: 2 }}>
                      {prettyDate(r.starts_on)} → {prettyDate(r.ends_on)} · {r.days} days
                    </Meta>
                  </View>
                  {!!r.unit?.code && <Mono style={{ fontSize: 10 }}>{r.unit.code}</Mono>}
                </View>
              ))}

              <Rule style={{ marginVertical: S.lg }} />

              {/* The two amounts are NOT summed. They are due in two places at
                  two times, and a single "to hand over at the counter" total —
                  which is what stood here — tells somebody who has just paid
                  the rental that they still owe all of it. */}
              <View style={[s.row, s.total]}>
                <Body style={{ fontFamily: F.bodyMedium }}>
                  {booking.payment_status === "paid" ? "Paid" : "Rental, with GST"}
                </Body>
                <Numeric style={{ fontSize: 17 }}>{formatPrice(booking.total_amount)}</Numeric>
              </View>
              {booking.deposit_amount > 0 && (
                <View style={s.row}>
                  <Body color={C.textMid}>
                    {booking.fulfilment === "ship" ? "Deposit, before we post it" : "Deposit, at the counter"}
                  </Body>
                  <Numeric color={C.textMid}>{formatPrice(booking.deposit_amount)}</Numeric>
                </View>
              )}
              <Meta style={{ marginTop: 4 }}>Refundable, and not part of what you have paid.</Meta>

              <View style={s.note}>
                <Body color={C.textMid} style={{ lineHeight: 22 }}>
                  {booking.fulfilment === "ship"
                    ? "We'll pack it and post it so it reaches you the day the rental starts. The return label is in the box."
                    : "Collect from the Dehradun shop on the first day of the rental. Bring some ID."}
                  {" "}The deposit comes back when the gear does, less anything owed for damage or a late return.
                  {" "}Changed your mind? Cancel from your rentals — the exact refund is shown before you
                  confirm, and the deposit always comes back in full.
                </Body>
              </View>

              <Button
                title="See all your rentals"
                variant="quiet"
                onPress={() => router.replace("/rent/bookings")}
                style={{ marginTop: S.lg }}
              />
            </>
          )}

          <Button
            title="Back to the locker"
            variant="link"
            onPress={() => router.replace("/rent")}
            style={{ marginTop: S.sm }}
          />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  badge: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    backgroundColor: C.forest12, borderRadius: R.panel, padding: S.md,
  },
  line: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 4 },
  total: { borderTopWidth: 1, borderTopColor: C.ruleSoft, marginTop: S.xs, paddingTop: S.sm },
  note: { marginTop: S.lg, backgroundColor: C.cream, borderRadius: R.panel, padding: S.md },
});
