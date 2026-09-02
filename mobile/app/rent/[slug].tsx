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
import { prettyDate, todayLocal } from "@/lib/rent/dates";
import { useAuthStore } from "@/stores/auth";
import {
  useRentalBookingMutation, useRentalItemQuery, useRentalQuoteQuery,
  useRentalItemDaysQuery, rentalPayUrl,
} from "@/lib/queries";
import * as WebBrowser from "expo-web-browser";
import * as Data from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

/**
 * Renting one thing: pick the days, see the real figure, reserve it.
 *
 * NOTHING ON THIS SCREEN DOES ARITHMETIC ON MONEY. Every rupee — the rent, the
 * long-rental discount, return postage, GST, and the deposit held outside the
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
  const { slug, from: fromParam, to: toParam } = useLocalSearchParams<{ slug: string; from?: string; to?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [photo, setPhoto] = useState(0);
  const { user } = useAuthStore();

  const { data: item, isLoading, isError, refetch } = useRentalItemQuery(slug);
  const book = useRentalBookingMutation();

  // Seeded from the locker's date bar, and floored at today: a screen reached
  // from a stale back-stack entry must not open with dates that have passed.
  // Anything malformed becomes "no dates" rather than reaching the RPC.
  const seed = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= todayLocal() ? v : null);
  const [from, setFrom] = useState<string | null>(() => seed(fromParam));
  const [to, setTo] = useState<string | null>(() => (seed(fromParam) ? seed(toParam) : null));
  // The month the picker is showing, so the day counts can be fetched for it.
  // Seeded from today rather than from `from`, because the calendar opens on
  // the current month before anything is chosen.
  const [monthWindow, setMonthWindow] = useState(() => {
    const t = seed(fromParam) ?? todayLocal();
    const y = Number(t.slice(0, 4));
    const m = Number(t.slice(5, 7)) - 1;
    return {
      from: `${y}-${String(m + 1).padStart(2, "0")}-01`,
      to: new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10),
    };
  });
  const [quantity, setQuantity] = useState(1);
  const [fulfilment, setFulfilment] = useState<"pickup" | "ship" | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState({ line1: "", city: "", state: "", postal_code: "" });
  // A hold that exists and is not paid for: the sheet was dismissed, or the
  // bank timed out. The gear is still set aside, so this screen offers to
  // finish rather than starting over.
  const [held, setHeld] = useState<{ id: string; number: string } | null>(null);
  const [paying, setPaying] = useState(false);
  // ── The bar's real height, measured ──────────────────────────────────────
  //
  // The ScrollView reserved a hardcoded 260pt for the bar underneath it. That
  // was already slightly short once the cancellation note was added, and at
  // `accessibility-extra-large` it is catastrophically short: the bar's copy
  // reflows to five lines, the bar becomes ~500pt of an 874pt screen, and the
  // scrollable content collapses to a sliver showing the product title clipped
  // through the middle of its glyphs. Everything below it — price, calendar,
  // email — is unreachable.
  //
  // A number that describes the height of something that reflows cannot be a
  // constant. It is measured instead, with a floor so the first frame (before
  // layout) is not zero.
  const [barH, setBarH] = useState(260);
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
  const { data: dayCounts, isFetching: daysLoading } = useRentalItemDaysQuery(
    item?.id, monthWindow.from, monthWindow.to,
  );

  const available = item && quote ? quote.availability[item.slug] : undefined;
  const short = available !== undefined && available < quantity;

  const priceProblem = quote?.price.errors?.[0];

  // The day the fully-refundable band actually expires, so the screen can say
  // "cancel free until the 13th" rather than making somebody do arithmetic on
  // "a week or more before it starts" while holding a card. Seven days is the
  // top band in `lib/rentalPolicy.ts`; it is stated in one place on the server
  // and this is the phone's reading of the same rule.
  // Null once that day has GONE, and the panel then quotes the grace window
  // instead — which is not a fallback but the applicable rule. Printing
  // `start − 7 days` unconditionally is how both storefronts came to promise
  // "cancel free until 29 Aug" on the first of September.
  const refundDeadline = (() => {
    if (!from) return null;
    const d = new Date(Date.parse(`${from}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    return d < todayLocal() ? null : d;
  })();

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

  /**
   * Hold the gear, then pay for it.
   *
   * PAYING IS WHAT RESERVES IT. This used to end at `book.mutateAsync` and push
   * the confirmation screen — which was correct when a rental was settled at a
   * counter, and became a lie the moment the web started requiring payment:
   * every booking made on this screen was a fifteen-minute hold that expired,
   * and the app cheerfully called it reserved.
   *
   * The payment itself is a hosted web page in a browser sheet, for the reason
   * `rentalPayUrl` sets out. What matters here is what happens when the sheet
   * closes, and it is deliberately NOT "assume success": `openAuthSessionAsync`
   * resolves on a deep link, on a dismissal, and on the user swiping the sheet
   * away, and the browser is not the authority on any of it — the sweep runs
   * server-side and may have fired while the sheet was open.
   *
   * So on every exit the booking is re-read from the database and the screen
   * says what is actually true. A flow that guessed would eventually tell
   * somebody "reserved" about gear that had gone back on the shelf while they
   * were typing a one-time password.
   */
  async function payAndReserve() {
    if (!terms || !canBook) return;
    haptics.select();
    let held: { bookingId: string; bookingNumber: string };
    try {
      held = await book.mutateAsync({ ...terms, email: email.trim(), phone: phone.trim() || undefined });
    } catch (e) {
      // The interesting failure is losing the last unit between the quote and
      // the tap. The server says so in a sentence; repeating it verbatim beats
      // inventing a friendlier message that means something else.
      toast.error(e instanceof Error ? e.message : "That booking didn't go through.");
      haptics.error();
      return;
    }

    setPaying(true);
    try {
      await WebBrowser.openAuthSessionAsync(rentalPayUrl(held.bookingId), "dewdropz://rent");

      // The database decides, not the sheet.
      const booking = await Data.getRentalBookingByNumber(held.bookingNumber);
      if (booking?.status === "reserved") {
        haptics.success();
        router.replace(`/rent/booked/${held.bookingNumber}`);
        return;
      }
      if (booking?.status === "cancelled") {
        toast.error(
          booking.cancelled_by === "expired"
            ? "The hold ran out before the payment arrived, so the gear went back on the shelf. Nothing was charged."
            : "That booking was cancelled. Nothing was charged.",
        );
        return;
      }
      // Still a live hold: the sheet was dismissed, or the bank timed out. The
      // gear is genuinely still set aside, so the screen offers to finish
      // rather than making somebody re-pick their dates and race for the same
      // tent they are already holding.
      setHeld({ id: held.bookingId, number: held.bookingNumber });
      toast.show("Your gear is still held. Finish paying to reserve it.");
    } finally {
      setPaying(false);
    }
  }

  /** Reopen the payment sheet for a hold that already exists. */
  async function finishPaying() {
    if (!held) return;
    haptics.select();
    setPaying(true);
    try {
      await WebBrowser.openAuthSessionAsync(rentalPayUrl(held.id), "dewdropz://rent");
      const booking = await Data.getRentalBookingByNumber(held.number);
      if (booking?.status === "reserved") {
        haptics.success();
        router.replace(`/rent/booked/${held.number}`);
      } else if (booking?.status === "cancelled") {
        setHeld(null);
        toast.error("That hold has expired and the gear is back on the shelf. Nothing was charged.");
      }
    } finally {
      setPaying(false);
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
          contentContainerStyle={{ paddingBottom: barH + S.lg }}
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
            <DateRange
              from={from}
              to={to}
              onChange={(f, t) => { setFrom(f); setTo(t); }}
              maxDays={item.max_days}
              // The shelf, day by day, so picking is reading rather than
              // guessing and being refused afterwards.
              days={dayCounts}
              daysLoading={daysLoading}
              onMonthChange={(mFrom, mTo) => setMonthWindow({ from: mFrom, to: mTo })}
            />
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
        <View
          style={[s.bar, { paddingBottom: insets.bottom + 14 }]}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            // Only on a real change: onLayout fires on every re-render, and
            // setting state unconditionally here is an infinite loop.
            if (h > 0 && h !== barH) setBarH(h);
          }}
        >
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
              {/* SPLIT, because the two are due in two places at two times.
                  Summing them into one figure is the most expensive kind of
                  wrong: somebody reads the total, expects to pay it later, and
                  is charged the rent now instead. */}
              <View style={[s.barLine, { marginTop: 4 }]}>
                <Body style={{ fontFamily: F.bodyMedium }}>Pay now to reserve</Body>
                <Numeric>{formatPrice(quote.price.totalAmount)}</Numeric>
              </View>
              {quote.price.depositAmount > 0 && (
                <View style={s.barLine}>
                  <Body color={C.textMid} style={{ fontSize: 13 }}>
                    {mode === "ship" ? "Deposit, before we post it" : "Deposit, at the counter"}
                  </Body>
                  <Numeric color={C.textMid} style={{ fontSize: 13 }}>{formatPrice(quote.price.depositAmount)}</Numeric>
                </View>
              )}
            </View>
          ) : (
            <Meta>
              {from && to
                ? "Working out the price…"
                : "Pick your dates to see the price."}
            </Meta>
          )}

          {/* ── What happens if you change your mind ────────────────────────
              ABOVE the button. Somebody about to send money to a shop they
              have never visited is deciding whether the shop is trustworthy,
              and a cancellation policy with a real date on it is the cheapest
              trust this screen can buy. Burying it would hide the only
              generous part of the policy at the moment it is worth something. */}
          {quote && !priceProblem && from && (
            <View style={s.assure}>
              <Icon name="shield" size={14} color={C.forest} />
              <View style={{ flex: 1 }}>
                <Body style={{ fontSize: 12.5, fontFamily: F.bodyMedium }} color={C.forest}>
                  {refundDeadline
                    ? `Cancel free until ${prettyDate(refundDeadline)}.`
                    : "Cancel free within 24 hours of booking."}
                </Body>
                <Meta style={{ fontSize: 11.5, marginTop: 2 }} maxFontSizeMultiplier={1.6}>
                  Never less than a quarter back after that — and the deposit always comes back in full.
                </Meta>
              </View>
            </View>
          )}

          {/* A hold that has not been paid for. The gear IS set aside, so this
              says so and offers the one action left. */}
          {held && (
            <Pressable onPress={finishPaying} style={s.heldBar} accessibilityRole="button">
              <Body style={{ fontSize: 12.5 }} color={C.clayDeep}>
                {held.number} is held for you — tap to finish paying. Nothing has been charged.
              </Body>
            </Pressable>
          )}

          <Button
            /* The figure is ON the button. "Reserve this gear" was honest when
               nothing was charged; under pay-to-reserve a button that does not
               say what it costs is a button that takes money by surprise. And
               it is the RENT, not rent-plus-deposit: the deposit is not paid
               here and pricing it into this control would overstate the charge
               by several thousand rupees. */
            title={held ? "Finish paying" : quote && !priceProblem ? "Pay and reserve" : "Reserve"}
            trailing={quote && !priceProblem ? formatPrice(quote.price.totalAmount) : undefined}
            onPress={held ? finishPaying : payAndReserve}
            disabled={!canBook || paying}
            loading={book.isPending || paying}
            size="lg"
            style={{ marginTop: S.sm }}
          />
          <Meta
            style={{ marginTop: 6, fontSize: 11 }}
            color={blockedBecause && terms ? C.clayDeep : C.textMuted}
            // Bounded, because this paragraph lives in a FIXED overlay. The
            // price lines and the button label above it scale freely — they
            // are what somebody needs to read — but three sentences of context
            // reflowing to five lines is what turned this bar into 60% of the
            // screen. Measuring the bar (above) keeps the content reachable;
            // this keeps the bar from being worth reaching past.
            maxFontSizeMultiplier={1.6}
          >
            {blockedBecause && terms
              ? blockedBecause
              : mode === "ship"
                // A POSTED rental has no counter to pay at. It is paid before it
                // ships — createRentalBooking stamps deposit_method 'gateway'
                // for every ship booking — and this line told every customer
                // the opposite.
                ? "You pay the rental now; that is what reserves the gear. The refundable deposit is taken separately before we post it."
                : "You pay the rental now; that is what reserves the gear. The refundable deposit is handed over at the counter when you collect."}
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
  assure: {
    flexDirection: "row", gap: S.sm, alignItems: "flex-start",
    backgroundColor: C.forest12, borderRadius: R.panel,
    paddingHorizontal: S.md, paddingVertical: 10, marginTop: S.sm,
  },
  heldBar: {
    backgroundColor: C.clay12, borderRadius: R.panel,
    paddingHorizontal: S.md, paddingVertical: 10, marginTop: S.sm,
  },
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
