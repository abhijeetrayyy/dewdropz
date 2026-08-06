import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useCartStore } from "@/stores/cart";
import { useAuthStore } from "@/stores/auth";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAddressesQuery, useCheckoutMutation } from "@/lib/queries";
import { FREE_SHIPPING_THRESHOLD_PAISE, FLAT_SHIPPING_RATE_PAISE } from "@/lib/constants";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, F, R } from "@/lib/theme";

const PINCODE_RE = /^[1-9][0-9]{5}$/;

export default function CheckoutScreen() {
  const { items, subtotal: st, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { data: addresses = [] } = useAddressesQuery(user?.id);
  const checkout = useCheckoutMutation();

  const [err, setErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const tot = st();
  const ship = tot >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FLAT_SHIPPING_RATE_PAISE;
  const grand = tot + ship;

  if (!user) {
    return (
      <View style={s.root}>
        <View style={s.gt}>
          <Text style={s.gtT}>Sign in to checkout</Text>
          <Text style={s.gtB}>You'll need an account to place your order.</Text>
          <Button title="Sign In" onPress={() => router.push("/auth/login")} />
          <TouchableOpacity onPress={() => router.push("/auth/signup")} style={{ marginTop: 18 }}>
            <Text style={s.lnk}>Create an account →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function fillFromAddress(a: (typeof addresses)[number]) {
    haptics.select();
    setFullName(a.full_name);
    setPhone(a.phone);
    setAddressLine1(a.address_line1);
    setAddressLine2(a.address_line2 ?? "");
    setCity(a.city);
    setStateField(a.state);
    setPostalCode(a.postal_code);
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

  async function place() {
    setErr("");
    if (!validate()) {
      haptics.warning();
      return;
    }
    try {
      const data = await checkout.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: stateField.trim(),
        postalCode: postalCode.trim(),
        items: items.map((i) => ({ slug: i.slug, size: i.size, quantity: i.quantity })),
      });
      haptics.success();
      clearCart();
      router.replace(`/orders/${data.orderId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't place the order. Check your connection and try again.");
      haptics.error();
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Text style={s.heroEb}>Checkout</Text>
          <Text style={s.heroT}>Review your order</Text>
          <View style={s.heroRow}>
            <Text style={s.heroItems}>
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Text>
            <Text style={s.heroTotal}>{formatPrice(grand)}</Text>
          </View>
        </View>

        <View style={s.cd}>
          <Text style={s.cl}>Order Summary</Text>
          {items.map((i) => (
            <View key={`${i.productId}-${i.size}`} style={s.li}>
              <Text style={s.lin}>
                {i.name}
                {i.size ? ` (${i.size})` : ""} <Text style={s.liq}>×{i.quantity}</Text>
              </Text>
              <Text style={s.lip}>{formatPrice(i.price * i.quantity)}</Text>
            </View>
          ))}
          <View style={s.dv} />
          <View style={s.lr}>
            <Text style={s.ll}>Subtotal</Text>
            <Text style={s.lv}>{formatPrice(tot)}</Text>
          </View>
          <View style={s.lr}>
            <Text style={s.ll}>Shipping</Text>
            <Text style={ship === 0 ? s.frv : s.lv}>{ship === 0 ? "Free" : formatPrice(ship)}</Text>
          </View>
          <View style={[s.lr, s.ttl]}>
            <Text style={s.ttlL}>Total</Text>
            <Text style={s.ttlV}>{formatPrice(grand)}</Text>
          </View>
        </View>

        <Text style={[s.cl, { marginTop: 28, marginBottom: 6 }]}>Shipping Address</Text>
        {err ? (
          <View style={s.ebox}>
            <Text style={s.et}>{err}</Text>
          </View>
        ) : null}

        {addresses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
            {addresses.map((a) => (
              <TouchableOpacity key={a.id} style={s.addrChip} onPress={() => fillFromAddress(a)}>
                <Text style={s.addrChipT} numberOfLines={1}>
                  {a.full_name} · {a.city}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Input label="Full Name" value={fullName} onChangeText={setFullName} err={fieldErrs.fullName} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="default" err={fieldErrs.phone} />
        <Input label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} err={fieldErrs.addressLine1} />
        <Input label="Address Line 2 (optional)" value={addressLine2} onChangeText={setAddressLine2} />
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Input label="City" value={city} onChangeText={setCity} err={fieldErrs.city} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="State" value={stateField} onChangeText={setStateField} err={fieldErrs.stateField} />
          </View>
        </View>
        <Input label="Pincode" value={postalCode} onChangeText={setPostalCode} keyboardType="default" err={fieldErrs.postalCode} />

        <Text style={[s.cl, { marginTop: 12 }]}>Payment Method</Text>
        <View style={s.pm}>
          <View style={s.rd}>
            <View style={s.rdI} />
          </View>
          <Text style={s.ptA}>Cash on Delivery</Text>
        </View>
        <View style={[s.pm, s.pmDisabled]}>
          <View style={[s.rd, s.rdDisabled]} />
          <Text style={s.ptDisabled}>Card / UPI / Netbanking — coming soon</Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <Button title={`Place Order — ${formatPrice(grand)}`} loading={checkout.isPending} onPress={place} />
        </View>
        <Text style={s.disc}>By placing this order, you agree to our Terms & Conditions.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  gt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  gtT: { fontFamily: F.display, fontSize: 24, color: C.text, textAlign: "center" },
  gtB: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 21, marginTop: 10, marginBottom: 28 },
  lnk: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest },
  hero: { backgroundColor: C.forest, borderRadius: R.md + 8, padding: 24, marginBottom: 20 },
  heroEb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.paper + "AA", marginBottom: 8 },
  heroT: { fontFamily: F.display, fontSize: 26, color: "#FFFFFF" },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: "#FFFFFF26" },
  heroItems: { fontFamily: F.body, fontSize: 13, color: C.paper + "CC" },
  heroTotal: { fontFamily: F.display, fontSize: 26, color: "#FFFFFF" },
  cd: { backgroundColor: C.surface, borderRadius: R.md + 4, padding: 20, borderWidth: 1, borderColor: C.rule },
  cl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 16 },
  li: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  lin: { fontFamily: F.body, fontSize: 14, color: C.text, flex: 1, marginRight: 16 },
  liq: { color: C.light, fontSize: 12 },
  lip: { fontFamily: F.body, fontSize: 14, color: C.mid },
  dv: { borderTopWidth: 1, borderTopColor: C.rule, marginTop: 14, paddingTop: 14 },
  lr: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  ll: { fontFamily: F.body, fontSize: 14, color: C.mid },
  lv: { fontFamily: F.body, fontSize: 14, color: C.text },
  frv: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest },
  ttl: { borderTopWidth: 1, borderTopColor: C.rule, marginTop: 8, paddingTop: 12 },
  ttlL: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  ttlV: { fontFamily: F.display, fontSize: 24, color: C.forest },
  ebox: { backgroundColor: C.clay + "14", borderWidth: 1, borderColor: C.clay + "26", borderRadius: R.md, padding: 14, marginBottom: 16 },
  et: { fontFamily: F.body, fontSize: 13, color: C.clay, textAlign: "center" },
  addrChip: { borderWidth: 1.5, borderColor: C.rule, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, maxWidth: 220 },
  addrChipT: { fontFamily: F.body, fontSize: 12, color: C.text },
  pm: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1.5, borderColor: C.forest, backgroundColor: C.forest + "0D", borderRadius: R.md, marginBottom: 8 },
  pmDisabled: { borderColor: C.rule, backgroundColor: "transparent", opacity: 0.6 },
  rd: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.forest, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rdDisabled: { borderColor: C.light },
  rdI: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.forest },
  ptA: { fontFamily: F.body, fontSize: 14, color: C.forest, fontWeight: "500" },
  ptDisabled: { fontFamily: F.body, fontSize: 13, color: C.light },
  disc: { fontFamily: F.body, fontSize: 11, color: C.light, textAlign: "center", marginTop: 16 },
});
