import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Img as Image } from "@/components/ui/Img";
import { OverlayHeader } from "@/components/editorial/OverlayHeader";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/ui/Icon";
import { Body, Display2, Meta, Mono, Numeric } from "@/components/ui/Type";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { DateRange } from "@/components/rent/DateRange";
import { prettyDate } from "@/lib/rent/dates";
import { useAuthStore } from "@/stores/auth";
import { useRentalBookingMutation, useRentalItemQuery, useRentalQuoteQuery } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

/**
 * Hiring one thing: pick the days, see the real figure, reserve it.
 *
 * NOTHING ON THIS SCREEN DOES ARITHMETIC ON MONEY. Every rupee — the rent, the
 * long-hire discount, return postage, GST, and the deposit held outside the
 * taxable base — arrives from `/api/mobile/rentals/quote`, which calls the same
 * `priceRental` the booking write bills against. The one number computed here
 * is the day count, and only to label the calendar; the server counts its own.
 *
 * Availability is shown from the same response, so the shelf and the price
 * always describe the same dates. It is a claim about a shelf other people are
 * booking from, which is why the quote is never cached, and why a booking that
 * loses the race comes back as a plain sentence rather than a stack trace.
 */
export default function RentItemScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [photo, setPhoto] = useState(0);
  const { user } = useAuthStore();

  const { data: item, isLoading, isError, refetch } = useRentalItemQuery(slug);
  const book = useRentalBookingMutation();

  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [fulfilment, setFulfilment] = useState<"pickup" | "ship" | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState({ line1: "", city: "", state: "", postal_code: "" });
  // The header floats over the photograph and only becomes a solid bar once
  // the image has scrolled away — the same behaviour as the product screen.
  const [scrolled, setScrolled] = useState(false);

  // Default to whatever the item actually allows, once it has loaded — some
  // gear is too bulky to post and offering the choice would be a lie.
  const mode: "pickup" | "ship" = fulfilment ?? (item?.allows_pickup ? "pickup" : "ship");
  const addressComplete = !!(addr.line1 && addr.city && addr.state && addr.postal_code);

  const terms = useMemo(
    () =>
      item && from && to
        ? {
            slug: item.slug,
            startsOn: from,
            endsOn: to,
            quantity,
            fulfilment: mode,
            address: mode === "ship" && addressComplete ? addr : null,
          }
        : null,
    [item, from, to, quantity, mode, addressComplete, addr],
  );

  const { data: quote, isFetching: quoting, error: quoteError } = useRentalQuoteQuery(terms);

  const available = item && quote ? quote.availability[item.slug] : undefined;
  const short = available !== undefined && available < quantity;

  const priceProblem = quote?.price.errors?.[0];

  // A disabled button with no explanation is a dead end — the reader can see
  // the price and cannot work out why they may not have it. This names the one
  // thing still missing, in the order the form asks for it.
  const blockedBecause = !terms
    ? "Pick your dates first."
    : quoting
      ? null
      : priceProblem || (available === 0 ? "None free for those dates." : null) ||
        (short ? `Only ${available} free for those dates.` : null) ||
        (!email.trim() ? "Add an email so we can send the confirmation." : null) ||
        (mode === "ship" && !addressComplete ? "Add the delivery address." : null);

  const canBook =
    !!terms && !!quote && !priceProblem && !short && !quoting && !!email.trim() &&
    (mode === "pickup" || addressComplete);

  async function reserve() {
    if (!terms || !canBook) return;
    haptics.select();
    try {
      const res = await book.mutateAsync({ ...terms, email: email.trim(), phone: phone.trim() || undefined });
      haptics.success();
      router.replace(`/rent/booked/${res.bookingNumber}`);
    } catch (e) {
      // The interesting failure is losing the last unit between the quote and
      // the tap. The server says so in a sentence; repeating it verbatim beats
      // inventing a friendlier message that means something else.
      toast.error(e instanceof Error ? e.message : "That booking didn't go through.");
    }
  }

  if (isError) {
    return (
      <View style={s.root}>
        {/* Paper screens pushed from dark-hero ones inherit the pusher's light
            status-bar glyphs — expo-status-bar is last-mount-wins — so the
            clock vanishes into the paper without this. */}
        <StatusBar style="dark" />
        <OverlayHeader scrolled title="Rent" onBack={() => goBack("/rent")} />
        <ErrorState message="Couldn't load this gear." onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !item) {
    return (
      <View style={s.root}>
        <StatusBar style="dark" />
        <OverlayHeader scrolled title="Rent" onBack={() => goBack("/rent")} />
        <View style={{ padding: S.gutter, gap: S.md }}>
          <Skeleton height={220} radius={R.card} />
          <Skeleton height={28} width="60%" />
          <Skeleton height={16} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style={scrolled || !item.images?.[0] ? "dark" : "light"} />
      <OverlayHeader scrolled={scrolled} title={item.name} onBack={() => goBack("/rent")} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 260 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(e) => {
            const past = e.nativeEvent.contentOffset.y > 220;
            if (past !== scrolled) setScrolled(past);
          }}
        >
          {item.images?.length ? (
            /* Every photograph, not just the first.
               Gear is rented on trust, and the second and third shots — the
               inside, the pitch, the size of it next to a person — are the ones
               that answer what somebody is actually asking. Paged rather than
               a thumbnail rail because a thumb is the only pointer here. */
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setPhoto(Math.round(e.nativeEvent.contentOffset.x / width))
                }
              >
                {item.images.map((uri, i) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={[s.hero, { width }]}
                    contentFit="cover"
                    alt={i === 0 ? item.name : ""}
                  />
                ))}
              </ScrollView>

              {item.images.length > 1 && (
                <View style={s.dots} pointerEvents="none">
                  {item.images.map((uri, i) => (
                    <View key={uri} style={[s.dot, i === photo && s.dotOn]} />
                  ))}
                </View>
              )}
            </View>
          ) : (
            // The header FLOATS over the photograph. Gear with no photograph
            // yet has nothing to float over, so without this spacer the back
            // button lands on top of the day rate — which is exactly what it
            // did, because none of the seeded gear has an image.
            <View style={{ height: insets.top + 56 }} />
          )}

          <View style={s.pad}>
            <Display2 style={{ marginTop: S.lg }}>{item.name}</Display2>
            {!!item.summary && <Body color={C.textMid} style={{ marginTop: S.xs }}>{item.summary}</Body>}

            <View style={s.rates}>
              <View>
                <Numeric style={s.rateFigure}>{formatPrice(item.daily_rate)}</Numeric>
                <Mono style={s.rateLabel}>PER DAY</Mono>
              </View>
              <View>
                <Numeric style={s.rateFigure}>{formatPrice(item.deposit)}</Numeric>
                <Mono style={s.rateLabel}>DEPOSIT, REFUNDED</Mono>
              </View>
              {item.weekly_discount_pct > 0 && (
                <View>
                  <Numeric style={[s.rateFigure, { color: C.sageDeep }]}>−{item.weekly_discount_pct}%</Numeric>
                  <Mono style={s.rateLabel}>7 DAYS OR MORE</Mono>
                </View>
              )}
            </View>

            {!!item.description && (
              <Body color={C.textMid} style={{ marginTop: S.md, lineHeight: 22 }}>{item.description}</Body>
            )}

            {/* The same gear, to own. Offered as a quiet alternative rather
                than a competing button: somebody on this screen has already
                decided to rent, and the job here is to answer "could I just
                buy it?" without derailing that. */}
            {item.product ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push(`/product/${item.product!.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`Buy the ${item.name} outright for ${formatPrice(item.product.price)}`}
                style={s.ownIt}
              >
                <View style={s.ownIcon}>
                  <Icon name="shopping_bag" size={17} color={C.paper} />
                </View>
                <View style={{ flex: 1 }}>
                  <Mono style={{ fontSize: 10 }}>OR OWN IT</Mono>
                  <Body style={{ marginTop: 2 }}>
                    Buy it outright for {formatPrice(item.product.price)}
                  </Body>
                </View>
                <Icon name="arrow_forward" size={18} color={C.forestDeep} />
              </TouchableOpacity>
            ) : null}

            <Rule style={{ marginVertical: S.block }} />

            <SectionHead eyebrow="The dates" title="When do you need it?" size="d3" />
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} maxDays={item.max_days} />
            <Meta style={{ marginTop: S.xs }}>
              Minimum {item.min_days} day{item.min_days === 1 ? "" : "s"}, maximum {item.max_days}.
              {item.buffer_days > 0 && ` Each unit rests ${item.buffer_days} day${item.buffer_days === 1 ? "" : "s"} between rentals.`}
            </Meta>

            {/* ── How many, and how it reaches you ─────────────────────────── */}
            <View style={s.controls}>
              <View style={s.stepper}>
                <Mono style={{ fontSize: 10 }}>HOW MANY</Mono>
                <View style={s.stepperRow}>
                  <Pressable
                    onPress={() => { haptics.select(); setQuantity((q) => Math.max(1, q - 1)); }}
                    disabled={quantity <= 1}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="One fewer"
                    accessibilityState={{ disabled: quantity <= 1 }}
                    style={s.stepBtn}
                  >
                    <Icon name="remove" size={18} color={quantity <= 1 ? C.disabled : C.ink} />
                  </Pressable>
                  <Numeric style={{ fontSize: 17, minWidth: 24, textAlign: "center" }}>{quantity}</Numeric>
                  <Pressable
                    onPress={() => { haptics.select(); setQuantity((q) => Math.min(10, q + 1)); }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="One more"
                    style={s.stepBtn}
                  >
                    <Icon name="add" size={18} color={C.ink} />
                  </Pressable>
                </View>
              </View>

              {item.allows_pickup && item.allows_shipping && (
                <View style={{ flex: 1 }}>
                  <Mono style={{ fontSize: 10 }}>HOW YOU GET IT</Mono>
                  <View style={s.segment}>
                    {([["pickup", "Collect"], ["ship", "Posted"]] as const).map(([value, label]) => (
                      <Pressable
                        key={value}
                        onPress={() => { haptics.select(); setFulfilment(value); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: mode === value }}
                        style={[s.segBtn, mode === value && s.segBtnOn]}
                      >
                        <Body style={{ fontSize: 13 }} color={mode === value ? C.paper : C.textMid}>{label}</Body>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── What the server says about the shelf ─────────────────────── */}
            {!!terms && (
              <View style={s.availability} accessibilityLiveRegion="polite">
                {quoting ? (
                  <Meta>Checking the locker…</Meta>
                ) : quoteError ? (
                  <Meta color={C.danger}>
                    {quoteError instanceof Error ? quoteError.message : "Couldn't price those dates."}
                  </Meta>
                ) : priceProblem ? (
                  <Meta color={C.danger}>{priceProblem}</Meta>
                ) : available === 0 ? (
                  <Meta color={C.danger}>None free for {prettyDate(from!)} → {prettyDate(to!)}.</Meta>
                ) : short ? (
                  <Meta color={C.danger}>Only {available} free for those dates.</Meta>
                ) : available !== undefined ? (
                  <Meta color={C.sageDeep}>{available} free for those dates.</Meta>
                ) : null}
              </View>
            )}

            <Rule style={{ marginVertical: S.block }} />

            <SectionHead eyebrow="You" title="Where to send the confirmation" size="d3" />
            <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Input label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />

            {mode === "ship" && (
              <>
                <SectionHead eyebrow="Delivery" title="Where to post it" size="d3" />
                <Input label="Address" value={addr.line1} onChangeText={(v) => setAddr((a) => ({ ...a, line1: v }))} autoComplete="street-address" />
                <Input label="City" value={addr.city} onChangeText={(v) => setAddr((a) => ({ ...a, city: v }))} />
                <Input label="State" value={addr.state} onChangeText={(v) => setAddr((a) => ({ ...a, state: v }))} />
                <Input label="Pincode" value={addr.postal_code} onChangeText={(v) => setAddr((a) => ({ ...a, postal_code: v }))} keyboardType="number-pad" autoComplete="postal-code" maxLength={6} />
                <Meta style={{ marginTop: S.xs }}>
                  Posting is charged both ways — out to you and back to us.
                </Meta>
              </>
            )}
          </View>
        </ScrollView>

        {/* ── The figure, and the button ──────────────────────────────────────
            Every line below is rendered from the server's quote. None of it is
            added up here. ─────────────────────────────────────────────────── */}
        <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
          {quote && !priceProblem ? (
            <View style={{ gap: 4 }}>
              <View style={s.barLine}>
                <Body color={C.textMid} style={{ fontSize: 13 }}>
                  Rental · {quote.price.lines[0]?.days} days × {quantity}
                </Body>
                <Numeric color={C.textMid} style={{ fontSize: 13 }}>
                  {formatPrice(quote.price.rentAmount + quote.price.discountAmount)}
                </Numeric>
              </View>
              {quote.price.discountAmount > 0 && (
                <View style={s.barLine}>
                  <Body color={C.sageDeep} style={{ fontSize: 13 }}>Long-rental discount</Body>
                  <Numeric color={C.sageDeep} style={{ fontSize: 13 }}>− {formatPrice(quote.price.discountAmount)}</Numeric>
                </View>
              )}
              {quote.price.deliveryAmount > 0 && (
                <View style={s.barLine}>
                  <Body color={C.textMid} style={{ fontSize: 13 }}>Delivery, both ways</Body>
                  <Numeric color={C.textMid} style={{ fontSize: 13 }}>{formatPrice(quote.price.deliveryAmount)}</Numeric>
                </View>
              )}
              <View style={s.barLine}>
                <Body color={C.textMid} style={{ fontSize: 13 }}>GST {quote.price.lines[0]?.gstRate}%</Body>
                <Numeric color={C.textMid} style={{ fontSize: 13 }}>{formatPrice(quote.price.taxAmount)}</Numeric>
              </View>
              <View style={s.barLine}>
                <Body style={{ fontFamily: F.bodyMedium }}>Deposit, refunded</Body>
                <Numeric>{formatPrice(quote.price.depositAmount)}</Numeric>
              </View>
            </View>
          ) : (
            <Meta>
              {from && to
                ? "Working out the price…"
                : "Pick your dates to see the price."}
            </Meta>
          )}

          <Button
            title={quote && !priceProblem ? "Reserve this gear" : "Reserve"}
            trailing={quote && !priceProblem ? formatPrice(quote.price.payableWithDeposit) : undefined}
            onPress={reserve}
            disabled={!canBook}
            loading={book.isPending}
            size="lg"
            style={{ marginTop: S.sm }}
          />
          <Meta style={{ marginTop: 6, fontSize: 11 }} color={blockedBecause && terms ? C.clayDeep : C.textMuted}>
            {blockedBecause && terms
              ? blockedBecause
              : "Nothing is charged now. You pay when you collect, and the deposit comes back with the gear."}
          </Meta>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  pad: { paddingHorizontal: S.gutter },
  hero: { height: 320, backgroundColor: C.sand },
  dots: {
    position: "absolute", bottom: 12, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "rgba(251,247,239,0.45)",
  },
  dotOn: { backgroundColor: C.paper, width: 18 },
  rates: { flexDirection: "row", flexWrap: "wrap", gap: S.xl, marginTop: S.lg },
  // Raising fontSize alone keeps the role's 17px line box and clips the caps
  // — plainly visible on iOS. The line height has to move with the size.
  rateFigure: { fontSize: 20, lineHeight: 26 },
  rateLabel: { fontSize: 9, marginTop: 2 },
  controls: { flexDirection: "row", gap: S.lg, marginTop: S.lg, alignItems: "flex-start" },
  stepper: { gap: 6 },
  stepperRow: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    borderWidth: 1, borderColor: C.ruleSoft, borderRadius: R.pill,
    paddingHorizontal: S.sm, paddingVertical: 6,
  },
  stepBtn: { padding: 4 },
  segment: {
    flexDirection: "row", gap: 6, marginTop: 6,
  },
  segBtn: {
    paddingHorizontal: S.md, paddingVertical: 8,
    borderRadius: R.pill, borderWidth: 1, borderColor: C.ruleSoft,
  },
  segBtnOn: { backgroundColor: C.forest, borderColor: C.forest },
  availability: { marginTop: S.md, minHeight: 20 },
  ownIt: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.forest12, borderRadius: R.panel,
    padding: S.md, marginTop: S.lg,
  },
  ownIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", backgroundColor: C.forest,
  },
  bar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: C.paper,
    borderTopWidth: 1, borderTopColor: C.ruleSoft,
    paddingHorizontal: S.gutter, paddingTop: 14,
  },
  barLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
});
