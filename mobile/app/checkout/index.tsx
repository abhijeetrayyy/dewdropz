import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { goBack } from "@/lib/nav";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useCartStore, type CartItem } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/Button";
import { StatusCap } from "@/components/ui/StatusCap";
import { Input } from "@/components/Input";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Img as Image } from "@/components/ui/Img";
import { Rule } from "@/components/editorial/Rule";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display2, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import {
  fetchQuote, useAddressesQuery, useCheckoutMutation, useQuoteQuery, useRazorpayOrderMutation,
} from "@/lib/queries";
import { haptics } from "@/lib/haptics";
import { ENV } from "@/lib/env";
import * as WebBrowser from "expo-web-browser";
import { C, F, M, R, S, SHADOW_BAR } from "@/lib/theme";

const PINCODE_RE = /^[1-9][0-9]{5}$/;
const STEPS = ["Delivery", "Payment"];

// Checkout. v4 rendered both steps as a stack of white bordered cards with a
// 1-2 dot tracker on top; it worked, but every element carried the same visual
// weight, so nothing told you where you were or what mattered.
//
// v5 changes three things:
//   • The step tracker is a ruled progress bar with mono labels — it reads as
//     a position in a process, not two decorative dots.
//   • The order total is pinned in a bar at the bottom of BOTH steps, so the
//     amount you're committing to is never scrolled off-screen.
//   • Saved addresses are full tappable rows, not 240px-wide truncated chips
//     that hid the address you were trying to identify.
export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, subtotal: st, itemCount, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { data: addresses = [] } = useAddressesQuery(user?.id);
  const checkout = useCheckoutMutation();
  const razorpay = useRazorpayOrderMutation();

  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Only a code the SERVER accepted goes into the quote. See fetchQuote's note:
  // putting the raw input straight in means one typo blanks the order total.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [method, setMethod] = useState<"cod" | "online">("cod");

  // THE TOTAL IS THE SERVER'S, NOT THIS SCREEN'S.
  //
  // This used to be `subtotal + FLAT_SHIPPING_RATE`, from two constants that
  // claimed to mirror the shop's settings and did not. GST is additive and was
  // absent altogether; delivery was ₹150 against a real zone rate of ₹120. On a
  // hoodie the screen said ₹2,049 and the courier asked for ₹2,246.88 — because
  // this is cash on delivery, the gap was collected at somebody's door.
  //
  // `lib/checkoutPricing.ts` on the web exists precisely to stop this: one
  // function prices the quote the customer approves AND the order that bills
  // them. /api/mobile/quote is that function, reachable from here.
  const tot = st();
  const quoteLines = items.map((i) => ({
    slug: i.slug,
    size: i.size,
    quantity: i.quantity,
    productId: i.productId,
    variantId: i.variantId ?? null,
    customDesignId: i.customDesignId,
  }));
  // Re-quoted once a destination exists, because both shipping and the GST
  // place of supply depend on it.
  const quote = useQuoteQuery(quoteLines, {
    state: stateField.trim() || undefined,
    postalCode: postalCode.trim() || undefined,
    couponCode: appliedCoupon ?? undefined,
  });
  const q = quote.data;
  const ship = q?.effectiveShipping ?? null;
  const grand = q?.totalAmount ?? null;

  // Whether the form still holds exactly what the selected saved address held.
  // `fillFromAddress` copies the row into the fields, so any later edit means
  // this is a new address wearing an old id — and sending the id then would
  // silently ship to the ORIGINAL row's contents.
  const selected = addresses.find((a) => a.id === selectedAddressId);
  const matchesSelected =
    !!selected &&
    selected.full_name === fullName.trim() &&
    selected.phone === phone.trim() &&
    selected.address_line1 === addressLine1.trim() &&
    (selected.address_line2 ?? "") === addressLine2.trim() &&
    selected.city === city.trim() &&
    selected.state === stateField.trim() &&
    selected.postal_code === postalCode.trim();

  // A rupee figure the server has not returned yet is rendered as an em dash,
  // never as a guess. "—" is honest; a stale or invented number on a cash-on-
  // delivery order is what this whole change is undoing.
  const money = (v: number | null | undefined) => (v == null ? "—" : formatPrice(v));
  const shipLabel = ship == null ? "—" : ship === 0 ? "FREE" : formatPrice(ship);
  const shipIsFree = ship === 0;

  if (!user) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 10 }]}>
        {/* This branch returns before the <StatusCap /> further down, so it
            declares its own bar style or it inherits one. On Android the style
            is global and persists across navigations: arriving from the cart's
            ink hero left the clock and battery light on this cream screen,
            where they were invisible. Cream screen, dark glyphs. */}
        <StatusBar style="dark" />
        <View style={s.header}>
          <IconButton name="close" onPress={() => goBack("/(tabs)/cart")} />
        </View>
        <View style={s.gate}>
          <Eyebrow>One step first</Eyebrow>
          <Rule weight="strong" style={{ marginTop: 9 }} />
          <Display2 style={{ marginTop: S.md }}>Sign in to check out.</Display2>
          <Body color={C.textMid} style={{ marginTop: 10, lineHeight: 22 }}>
            You&apos;ll need an account so we can send you tracking and keep your order history.
          </Body>

          {/* WHAT THEY ARE ABOUT TO BUY, on the screen that asks them to stop.
              This was a sign-in form on an otherwise empty cream field, shown
              at the exact moment a person has decided to spend money. Nothing
              on it acknowledged the pack they had just filled, so the gate read
              as a wall rather than a step. Their own items are the best
              argument for getting past it. */}
          {items.length > 0 ? (
            <View style={s.gatePack}>
              <View style={s.gateThumbs}>
                {(items as CartItem[]).slice(0, 3).map((it, i) => (
                  <Image
                    key={`${it.productId}-${it.size ?? ""}-${i}`}
                    source={{ uri: it.image }}
                    style={[s.gateThumb, i > 0 && { marginLeft: -14 }]}
                    contentFit="cover"
                    alt=""
                  />
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Mono style={{ fontSize: 10 }}>WAITING IN YOUR PACK</Mono>
                <Body style={{ marginTop: 2 }}>
                  {itemCount()} {itemCount() === 1 ? "piece" : "pieces"} · {formatPrice(st())}
                </Body>
              </View>
            </View>
          ) : null}

          <Button title="Sign in" variant="dark" onPress={() => router.push("/auth/login?next=%2Fcheckout")} style={{ marginTop: S.xl, alignSelf: "stretch" }} />
          <Button title="Create an account" variant="link" onPress={() => router.push("/auth/signup?next=%2Fcheckout")} style={{ marginTop: S.md }} />

          <View style={s.gateTrust}>
            {([
              ["local_shipping", "Free delivery over ₹2,000"],
              ["payments", "Cash on delivery across India"],
              ["history", "7-day returns on unused items"],
            ] as const).map(([icon, label]) => (
              <View key={label} style={s.gateTrustRow}>
                <Icon name={icon} size={16} color={C.forestDeep} />
                <Body color={C.textMid} style={{ fontSize: 13, flex: 1 }}>{label}</Body>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  function fillFromAddress(a: (typeof addresses)[number]) {
    haptics.select();
    setSelectedAddressId(a.id);
    setFullName(a.full_name);
    setPhone(a.phone);
    setAddressLine1(a.address_line1);
    setAddressLine2(a.address_line2 ?? "");
    setCity(a.city);
    setStateField(a.state);
    setPostalCode(a.postal_code);
    // A saved address always satisfies validation, but an error banner from a
    // previous failed attempt is still in state, pointing at now-overwritten
    // values — clear it so autofill doesn't leave stale "Required" errors on
    // fields that are actually filled in.
    setFieldErrs({});
  }

  // Tried on its own before it is allowed to affect the total.
  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponErr("");
    setCheckingCoupon(true);
    try {
      await fetchQuote(quoteLines, {
        state: stateField.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        couponCode: code,
      });
      setAppliedCoupon(code);
      setCouponInput("");
      haptics.success();
    } catch (e: unknown) {
      // validateCoupon's messages are written for a customer — "Coupon has
      // expired", "Minimum order amount is ₹1,500" — so they are shown as-is
      // rather than flattened into "invalid code".
      setCouponErr(e instanceof Error ? e.message : "That code could not be applied.");
      haptics.warning();
    } finally {
      setCheckingCoupon(false);
    }
  }

  function removeCoupon() {
    haptics.tap();
    setAppliedCoupon(null);
    setCouponErr("");
  }

  function clearFieldErr(key: string) {
    setFieldErrs((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Required";
    if (!phone.trim() || phone.trim().replace(/\D/g, "").length < 10) errs.phone = "Enter a valid phone number";
    if (!addressLine1.trim()) errs.addressLine1 = "Required";
    if (!city.trim()) errs.city = "Required";
    if (!stateField.trim()) errs.stateField = "Required";
    if (!PINCODE_RE.test(postalCode.trim())) errs.postalCode = "Enter a valid 6-digit pincode";
    setFieldErrs(errs);
    return Object.keys(errs).length === 0;
  }

  function continueToPayment() {
    if (!validate()) {
      haptics.warning();
      return;
    }
    haptics.tap();
    setStep(1);
  }

  /** The shared payload — both paths order exactly the same cart. */
  function orderPayload() {
    return {
      ...(selectedAddressId && matchesSelected ? { addressId: selectedAddressId } : {}),
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
      fullName: fullName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: stateField.trim(),
      postalCode: postalCode.trim(),
      items: items.map((i) => ({
        slug: i.slug,
        size: i.size,
        quantity: i.quantity,
        productId: i.productId,
        variantId: i.variantId ?? null,
        customDesignId: i.customDesignId,
      })),
    };
  }

  /**
   * Pay online.
   *
   * ⚠ UNVERIFIED — there are no Razorpay credentials in this repository, so
   * this path has never completed. The cart is deliberately NOT cleared here:
   * the order exists and is unpaid, and clearing it before money moved would
   * leave somebody with neither a cart nor a paid order if they abandon the
   * sheet. The success deep link is what clears it.
   */
  async function payOnline() {
    setErr("");
    try {
      const data = await razorpay.mutateAsync(orderPayload());
      const url = `${ENV.siteUrl}/pay/${data.orderId}`;
      // A browser sheet rather than a native SDK — see the route's header.
      // Dismissing it returns here with the order still pending and payable.
      await WebBrowser.openAuthSessionAsync(url, "dewdropz://checkout");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not start the payment.");
      haptics.error();
    }
  }

  async function place() {
    if (method === "online") return payOnline();
    setErr("");
    try {
      const data = await checkout.mutateAsync({
        // Only when the fields still match the row that was picked. Editing a
        // field after selecting a saved address means the shopper wants a
        // different address, and the server should write that one.
        ...(selectedAddressId && matchesSelected ? { addressId: selectedAddressId } : {}),
        ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: stateField.trim(),
        postalCode: postalCode.trim(),
        items: items.map((i) => ({
          slug: i.slug,
          size: i.size,
          quantity: i.quantity,
          productId: i.productId,
          variantId: i.variantId ?? null,
          customDesignId: i.customDesignId,
        })),
      });
      haptics.success();

      // WHAT THE SERVER COULD NOT PUT ON THE ORDER.
      //
      // `syncLocalCartToDbCart` skips a line that went out of stock or was
      // deactivated between adding it and pressing this button, and returns the
      // slugs. That was being discarded here while the cart was cleared and a
      // success screen was shown — so a customer could order three things,
      // receive two, and never learn which one was missing.
      //
      // The order was still placed, so this is a notice rather than an error,
      // and it travels to the success screen where there is room to name them.
      const skipped = data.skippedItems ?? [];
      clearCart();
      const q = new URLSearchParams({ orderId: data.orderId });
      if (skipped.length) q.set("skipped", skipped.join(","));
      router.replace(`/checkout/success?${q.toString()}`);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't place the order. Check your connection and try again.");
      haptics.error();
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusCap />
      {/* ── Header + progress ─────────────────────────────────────────────
          The same ink panel every other screen wears, with the step tracker
          living inside it rather than as a separate strip on paper below. */}
      <View style={[s.panel, { paddingTop: insets.top + 10 }]}>
        <View style={s.header}>
          <IconButton
            name={step === 1 ? "arrow_back" : "close"}
            tone="glass"
            accessibilityLabel={step === 1 ? "Back to delivery" : "Close checkout"}
            onPress={() => (step === 1 ? setStep(0) : goBack("/(tabs)/cart"))}
          />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={s.panelKicker}>CHECKOUT</Text>
          </View>
          <View style={s.secure}>
            <Icon name="lock" size={13} color={C.sage} />
            <Text style={s.secureT}>Secure</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.md }}>
          <View style={s.stepRow}>
            {STEPS.map((label, i) => (
              <View key={label} style={{ flex: 1, gap: 7 }}>
                <View style={[s.stepTrack, i <= step && s.stepTrackOn]} />
                <Text style={[s.stepLabel, i <= step && s.stepLabelOn]}>
                  {String(i + 1).padStart(2, "0")} {label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: S.block, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <Animated.View entering={FadeIn.duration(M.base)}>
            <Display2>Where to?</Display2>

            {addresses.length > 0 ? (
              <View style={{ marginTop: S.xl }}>
                <Eyebrow>Saved addresses</Eyebrow>
                <Rule weight="soft" style={{ marginTop: 9 }} />
                {addresses.map((a) => {
                  const on = selectedAddressId === a.id;
                  return (
                    <TouchableOpacity key={a.id} activeOpacity={0.7} onPress={() => fillFromAddress(a)}>
                      <View style={s.addrRow}>
                        <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
                        <View style={{ flex: 1 }}>
                          <View style={s.addrTop}>
                            <Title>{a.full_name}</Title>
                            {a.is_default ? (
                              <View style={s.defaultTag}>
                                <Text style={s.defaultTagT}>DEFAULT</Text>
                              </View>
                            ) : null}
                          </View>
                          <Body color={C.textMid} style={{ marginTop: 3 }} numberOfLines={2}>
                            {[a.address_line1, a.address_line2, a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                          </Body>
                        </View>
                      </View>
                      <Rule weight="soft" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {err ? (
              <View style={s.errBox}>
                <Icon name="error" size={16} color={C.danger} />
                <Body color={C.danger} style={{ flex: 1 }}>
                  {err}
                </Body>
              </View>
            ) : null}

            <View style={{ marginTop: S.block }}>
              <Eyebrow>{addresses.length > 0 ? "Or enter a new one" : "Delivery address"}</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9, marginBottom: S.xl }} />

              <Input label="Full name" value={fullName} autoComplete="name" autoCapitalize="words" onChangeText={(v) => { setFullName(v); clearFieldErr("fullName"); }} err={fieldErrs.fullName} />
              <Input label="Phone" value={phone} keyboardType="phone-pad" autoComplete="tel" onChangeText={(v) => { setPhone(v); clearFieldErr("phone"); }} err={fieldErrs.phone} />
              <Input label="Address line 1" value={addressLine1} autoComplete="street-address" onChangeText={(v) => { setAddressLine1(v); clearFieldErr("addressLine1"); }} err={fieldErrs.addressLine1} />
              <Input label="Address line 2" value={addressLine2} onChangeText={setAddressLine2} hint="Optional — flat, landmark" />
              <View style={{ flexDirection: "row", gap: S.md }}>
                <View style={{ flex: 1 }}>
                  <Input label="City" value={city} onChangeText={(v) => { setCity(v); clearFieldErr("city"); }} err={fieldErrs.city} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="State" value={stateField} onChangeText={(v) => { setStateField(v); clearFieldErr("stateField"); }} err={fieldErrs.stateField} />
                </View>
              </View>
              <Input label="Pincode" value={postalCode} keyboardType="number-pad" maxLength={6} autoComplete="postal-code" onChangeText={(v) => { setPostalCode(v); clearFieldErr("postalCode"); }} err={fieldErrs.postalCode} />
            </View>

            <View style={{ marginTop: S.md }}>
              <Eyebrow>When</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9 }} />
              <View style={s.optRow}>
                <View style={[s.radio, s.radioOn]}>
                  <View style={s.radioDot} />
                </View>
                <View style={{ flex: 1 }}>
                  <Title>Standard delivery</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    Ships within 2 working days from Dehradun
                  </Body>
                </View>
                <Numeric color={shipIsFree ? C.forest : C.ink}>{shipLabel}</Numeric>
              </View>
              <Rule weight="soft" />
              <View style={[s.optRow, { opacity: 0.45 }]}>
                <View style={s.radio} />
                <View style={{ flex: 1 }}>
                  <Title>Express delivery</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    Coming soon
                  </Body>
                </View>
              </View>
              <Rule weight="soft" />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(M.base)}>
            <Display2>How would you like to pay?</Display2>

            <View style={{ marginTop: S.xl }}>
              <Eyebrow>Payment method</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9 }} />

              {/* TWO REAL CHOICES, replacing one live option and two rows at
                  45% opacity marked "coming soon". UPI and card are the same
                  gateway hop, so they are one choice here rather than two
                  greyed-out ones — the method inside is picked in Razorpay's
                  own sheet, which is where a customer expects to pick it. */}
              <TouchableOpacity
                style={s.optRow}
                activeOpacity={0.7}
                onPress={() => { haptics.select(); setMethod("cod"); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: method === "cod" }}
              >
                <View style={[s.radio, method === "cod" && s.radioOn]}>
                  {method === "cod" ? <View style={s.radioDot} /> : null}
                </View>
                <Icon name="payments" size={22} color={C.ink} />
                <View style={{ flex: 1 }}>
                  <Title>Cash on delivery</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    Pay the courier when it arrives
                  </Body>
                </View>
              </TouchableOpacity>
              <Rule weight="soft" />
              <TouchableOpacity
                style={s.optRow}
                activeOpacity={0.7}
                onPress={() => { haptics.select(); setMethod("online"); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: method === "online" }}
              >
                <View style={[s.radio, method === "online" && s.radioOn]}>
                  {method === "online" ? <View style={s.radioDot} /> : null}
                </View>
                <Icon name="account_balance" size={22} color={C.ink} />
                <View style={{ flex: 1 }}>
                  <Title>UPI or card</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    GPay, PhonePe, Paytm, or any card
                  </Body>
                </View>
              </TouchableOpacity>
              <Rule weight="soft" />
            </View>

            {/* ── Coupon ──────────────────────────────────────────────────
                The app had no way to enter one at all, while the shop ran
                them: `coupons`, `coupon_usages` and an admin screen all exist,
                and the web checkout has had a field since launch. A customer
                given a code by the shop simply could not use it on a phone. */}
            <View style={{ marginTop: S.block }}>
              <Eyebrow>Have a code?</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9, marginBottom: S.md }} />

              {appliedCoupon ? (
                <View style={s.couponOn}>
                  <Icon name="check_circle" size={17} color={C.forest} />
                  <View style={{ flex: 1 }}>
                    <Title>{appliedCoupon}</Title>
                    <Body color={C.textMid} style={{ marginTop: 2 }}>
                      {q && q.discountAmount > 0
                        ? `${formatPrice(q.discountAmount)} off this order`
                        : "Applied"}
                    </Body>
                  </View>
                  <TouchableOpacity onPress={removeCoupon} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove code ${appliedCoupon}`}>
                    <Body color={C.textMid}>Remove</Body>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: S.sm }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Discount code"
                      value={couponInput}
                      autoCapitalize="characters"
                      autoComplete="off"
                      maxLength={60}
                      onChangeText={(v) => { setCouponInput(v); setCouponErr(""); }}
                      err={couponErr}
                    />
                  </View>
                  <Button
                    title={checkingCoupon ? "…" : "Apply"}
                    variant="dark"
                    disabled={!couponInput.trim() || checkingCoupon}
                    onPress={applyCoupon}
                    style={{ marginTop: 26 }}
                  />
                </View>
              )}
            </View>

            {/* ── Order summary ───────────────────────────────────────────── */}
            <View style={{ marginTop: S.block }}>
              <Eyebrow>Your order</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9 }} />
              <SpecTable
                rows={[
                  ...items.map((i) => ({
                    key: `${i.name}${i.size ? ` · ${i.size}` : ""} ×${i.quantity}`,
                    value: formatPrice(i.price * i.quantity),
                  })),
                  // Everything below the line comes from the server's pricing,
                  // including the GST that this screen never used to show.
                  ...(q && q.discountAmount > 0
                    ? [{ key: "Discount", value: `−${formatPrice(q.discountAmount)}` }]
                    : []),
                  { key: "Delivery", value: shipIsFree ? "Free" : shipLabel },
                  ...(q && q.taxEnabled && q.taxAmount > 0
                    ? [{
                        key: q.taxIsIgst ? "IGST" : "GST",
                        value: money(q.taxAmount),
                      }]
                    : []),
                  { key: "Total", value: money(grand), emphasis: true },
                ]}
              />
              <Rule weight="soft" />
            </View>

            <View style={{ marginTop: S.lg }}>
              <Mono color={C.textFaint}>
                DELIVERING TO {fullName.toUpperCase()} · {city.toUpperCase()} {postalCode}
              </Mono>
            </View>

            {err ? (
              <View style={s.errBox}>
                <Icon name="error" size={16} color={C.danger} />
                <Body color={C.danger} style={{ flex: 1 }}>
                  {err}
                </Body>
              </View>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Pinned total + action ─────────────────────────────────────────── */}
      {/* ── Pinned cost + action ──────────────────────────────────────────
          The breakdown is here on BOTH steps, not just the payment one.
          Unexpected extra costs at checkout are the single largest fixable
          cause of abandonment — 39% of shoppers, per Baymard's benchmark — and
          this bar previously showed a bare "TOTAL" on the delivery step with
          nothing to explain what was inside it. Subtotal and delivery are now
          always on screen, so the number never changes without warning.
          Kept at the bottom because ~half of shoppers check out one-handed and
          the CTA has to stay in the thumb's reach. ────────────────────────── */}
      <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={s.barBreakdown}>
          <View style={s.barLine}>
            <Body color={C.textMid}>Subtotal</Body>
            <Numeric color={C.textMid}>{formatPrice(tot)}</Numeric>
          </View>
          <View style={s.barLine}>
            <Body color={C.textMid}>Delivery</Body>
            <Numeric color={shipIsFree ? C.forest : C.textMid}>{shipLabel}</Numeric>
          </View>
          {q && q.taxEnabled && q.taxAmount > 0 ? (
            <View style={s.barLine}>
              <Body color={C.textMid}>{q.taxIsIgst ? "IGST" : "GST"}</Body>
              <Numeric color={C.textMid}>{money(q.taxAmount)}</Numeric>
            </View>
          ) : null}
          <View style={[s.barLine, s.barLineTotal]}>
            <Text style={s.barTotalL}>Total</Text>
            <Text style={s.barTotalV}>{money(grand)}</Text>
          </View>
        </View>

        {step === 0 ? (
          <Button title="Continue to payment" iconRight="arrow_forward" onPress={continueToPayment} style={{ width: "100%" }} />
        ) : (
          // Never committable against an unknown total. If the quote has not
          // arrived — or failed — the button waits rather than letting somebody
          // agree to a number this screen made up.
          <Button
            title={
              quote.isError
                ? "Price unavailable"
                : method === "online"
                  ? "Pay now"
                  : "Place order"
            }
            loading={checkout.isPending || razorpay.isPending || (quote.isPending && !q)}
            disabled={!q || quote.isError || razorpay.isPending}
            onPress={place}
            style={{ width: "100%" }}
          />
        )}

        {quote.isError ? (
          <Body color={C.danger} style={{ marginTop: 8, textAlign: "center" }}>
            We could not price this order just now. Check your connection and pull to retry.
          </Body>
        ) : null}

        <View style={s.barTrust}>
          <Icon name="lock" size={12} color={C.textMuted} />
          <Text style={s.barTrustT}>Cash on delivery · 7-day returns · No card details stored</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  gatePack: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.cream, borderRadius: R.panel, padding: S.md, marginTop: S.lg,
  },
  gateThumbs: { flexDirection: "row" },
  gateThumb: {
    width: 44, height: 54, borderRadius: R.card,
    backgroundColor: C.sand, borderWidth: 2, borderColor: C.paper,
  },
  gateTrust: {
    gap: 10, marginTop: S.block,
    borderTopWidth: 1, borderTopColor: C.ruleSoft, paddingTop: S.lg,
  },
  gateTrustRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  root: { flex: 1, backgroundColor: C.paper },
  couponOn: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    backgroundColor: C.forest12,
    borderRadius: R.panel,
    padding: 14,
  },
  panel: {
    backgroundColor: C.ink,
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
  },
  panelKicker: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.9, color: "rgba(251,247,239,0.55)" },
  header: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingHorizontal: S.gutter, paddingBottom: S.xs },
  secure: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 40, justifyContent: "flex-end" },
  secureT: { fontFamily: F.bodyMedium, fontSize: 11, color: C.sage },
  stepLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: "rgba(251,247,239,0.4)" },
  stepLabelOn: { fontFamily: F.monoBold, color: C.paper },

  gate: { flex: 1, justifyContent: "center", paddingHorizontal: S.gutter, paddingBottom: 80 },

  stepRow: { flexDirection: "row", gap: S.sm },
  stepTrack: { height: 2, backgroundColor: "rgba(251,247,239,0.18)", borderRadius: R.tag },
  stepTrackOn: { backgroundColor: C.sage },

  addrRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md, paddingVertical: S.md },
  addrTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  defaultTag: { backgroundColor: C.forest12, borderRadius: R.tag, paddingHorizontal: 6, paddingVertical: 2 },
  defaultTagT: { fontFamily: F.monoBold, fontSize: 8, letterSpacing: 1, color: C.forestDeep },

  optRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  radio: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: C.ruleStrong, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioOn: { borderColor: C.ink },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: C.ink },

  errBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.danger12, borderRadius: R.panel, padding: 14, marginTop: S.lg },

  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.ruleSoft,
    paddingHorizontal: S.gutter,
    paddingTop: 14,
    ...SHADOW_BAR,
  },
  barBreakdown: { gap: 3, marginBottom: S.md },
  barLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLineTotal: { marginTop: 5, paddingTop: 7, borderTopWidth: 1, borderTopColor: C.ruleSoft },
  barTotalL: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink },
  barTotalV: { fontFamily: F.monoBold, fontSize: 18, color: C.ink },
  barTrust: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 11 },
  barTrustT: { fontFamily: F.body, fontSize: 11, color: C.textMuted },
});
