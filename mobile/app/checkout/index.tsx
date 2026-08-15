import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/Button";
import { StatusCap } from "@/components/ui/StatusCap";
import { Input } from "@/components/Input";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display2, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { useAddressesQuery, useCheckoutMutation } from "@/lib/queries";
import { FREE_SHIPPING_THRESHOLD_PAISE, FLAT_SHIPPING_RATE_PAISE } from "@/lib/constants";
import { haptics } from "@/lib/haptics";
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
  const { items, subtotal: st, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { data: addresses = [] } = useAddressesQuery(user?.id);
  const checkout = useCheckoutMutation();

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

  const tot = st();
  const ship = tot >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FLAT_SHIPPING_RATE_PAISE;
  const grand = tot + ship;

  if (!user) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 10 }]}>
        <View style={s.header}>
          <IconButton name="close" onPress={() => router.back()} />
        </View>
        <View style={s.gate}>
          <Eyebrow>One step first</Eyebrow>
          <Rule weight="strong" style={{ marginTop: 9 }} />
          <Display2 style={{ marginTop: S.md }}>Sign in to check out.</Display2>
          <Body color={C.textMid} style={{ marginTop: 10 }}>
            You&apos;ll need an account so we can send you tracking and keep your order history.
          </Body>
          <Button title="Sign in" variant="dark" onPress={() => router.push("/auth/login")} style={{ marginTop: S.xl, alignSelf: "flex-start" }} />
          <Button title="Create an account" variant="link" onPress={() => router.push("/auth/signup")} style={{ marginTop: S.md }} />
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

  async function place() {
    setErr("");
    try {
      const data = await checkout.mutateAsync({
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
      clearCart();
      router.replace(`/checkout/success?orderId=${data.orderId}`);
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
            onPress={() => (step === 1 ? setStep(0) : router.back())}
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
                <Numeric color={ship === 0 ? C.forest : C.ink}>{ship === 0 ? "FREE" : formatPrice(ship)}</Numeric>
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

              <View style={s.optRow}>
                <View style={[s.radio, s.radioOn]}>
                  <View style={s.radioDot} />
                </View>
                <Icon name="payments" size={22} color={C.ink} />
                <View style={{ flex: 1 }}>
                  <Title>Cash on delivery</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    Pay the courier when it arrives
                  </Body>
                </View>
              </View>
              <Rule weight="soft" />
              <View style={[s.optRow, { opacity: 0.45 }]}>
                <View style={s.radio} />
                <Icon name="account_balance" size={22} color={C.textMuted} />
                <View style={{ flex: 1 }}>
                  <Title>UPI</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    GPay, PhonePe, Paytm — coming soon
                  </Body>
                </View>
              </View>
              <Rule weight="soft" />
              <View style={[s.optRow, { opacity: 0.45 }]}>
                <View style={s.radio} />
                <Icon name="credit_card" size={22} color={C.textMuted} />
                <View style={{ flex: 1 }}>
                  <Title>Card</Title>
                  <Body color={C.textMid} style={{ marginTop: 2 }}>
                    Coming soon
                  </Body>
                </View>
              </View>
              <Rule weight="soft" />
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
                  { key: "Delivery", value: ship === 0 ? "Free" : formatPrice(ship) },
                  { key: "Total", value: formatPrice(grand), emphasis: true },
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
            <Numeric color={ship === 0 ? C.forest : C.textMid}>
              {ship === 0 ? "FREE" : formatPrice(ship)}
            </Numeric>
          </View>
          <View style={[s.barLine, s.barLineTotal]}>
            <Text style={s.barTotalL}>Total</Text>
            <Text style={s.barTotalV}>{formatPrice(grand)}</Text>
          </View>
        </View>

        {step === 0 ? (
          <Button title="Continue to payment" iconRight="arrow_forward" onPress={continueToPayment} style={{ width: "100%" }} />
        ) : (
          <Button title="Place order" loading={checkout.isPending} onPress={place} style={{ width: "100%" }} />
        )}

        <View style={s.barTrust}>
          <Icon name="lock" size={12} color={C.textMuted} />
          <Text style={s.barTrustT}>Cash on delivery · 7-day returns · No card details stored</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
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
