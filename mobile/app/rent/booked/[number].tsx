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
 * The gear is held.
 *
 * Deliberately not a receipt: nothing has been paid. What this screen owes the
 * reader is the three things they will need at the counter — the booking
 * number, the dates the units are held for, and what to bring — so it says
 * those and stops.
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
      />

      <Animated.ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false} ref={scrollRef}>

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

              <View style={s.row}>
                <Body color={C.textMid}>Rental, with GST</Body>
                <Numeric>{formatPrice(booking.total_amount)}</Numeric>
              </View>
              <View style={s.row}>
                <Body color={C.textMid}>Deposit, refundable</Body>
                <Numeric>{formatPrice(booking.deposit_amount)}</Numeric>
              </View>
              <View style={[s.row, s.total]}>
                <Body style={{ fontFamily: F.bodyMedium }}>To hand over at the counter</Body>
                <Numeric style={{ fontSize: 17 }}>
                  {formatPrice(booking.total_amount + booking.deposit_amount)}
                </Numeric>
              </View>

              <View style={s.note}>
                <Body color={C.textMid} style={{ lineHeight: 22 }}>
                  {booking.fulfilment === "ship"
                    ? "We'll pack it and post it so it reaches you the day the rental starts. The return label is in the box."
                    : "Collect from the Dehradun shop on the first day of the rental. Bring some ID."}
                  {" "}The deposit comes back when the gear does, less anything owed for damage or a late return.
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
