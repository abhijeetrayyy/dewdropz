import { useEffect } from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { useOrderQuery } from "@/lib/queries";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/Button";
import { Rule } from "@/components/editorial/Rule";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display1, Eyebrow, Mono } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, F, M, R, S } from "@/lib/theme";

// Order confirmation. `gestureEnabled` is off for this route (app/_layout.tsx)
// so the only ways out are the explicit actions below — a swipe-back here
// would land the user on a checkout form for an order they already placed.
//
// The stamp is the whole idea: a confirmation should feel like a receipt being
// franked, so the mark springs in slightly rotated, and the order number is
// set in mono like a real docket reference rather than as body copy.
export default function OrderPlacedScreen() {
  const insets = useSafeAreaInsets();
  const { orderId, skipped } = useLocalSearchParams<{ orderId: string; skipped?: string }>();
  // Lines the server could not put on the order — see the note in checkout.
  const skippedItems = (skipped ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const { data: order } = useOrderQuery(orderId);

  // The cart is cleared HERE, not only by the path that got here.
  //
  // COD clears it before navigating, because the order is placed the moment the
  // button returns. The online path cannot: at the point the browser sheet
  // opens, no money has moved and the cart is the only thing standing between
  // an abandoned payment and starting over. So it is cleared on arrival at the
  // one screen that means the order is real — idempotent, so the COD path
  // clearing it twice costs nothing.
  const clearCart = useCartStore((st) => st.clearCart);
  useEffect(() => {
    if (orderId) clearCart();
  }, [orderId, clearCart]);

  const stamp = useSharedValue(0);
  useEffect(() => {
    stamp.value = withDelay(120, withSpring(1, { damping: 11, stiffness: 130 }));
  }, [stamp]);

  const stampStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stamp.value }, { rotate: `${(1 - stamp.value) * -12}deg` }],
    opacity: stamp.value,
  }));

  const pieces = order?.items?.length ?? 0;
  const total = order?.total_amount ?? 0;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />

      <View style={[s.top, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} hitSlop={12}>
          <Mono color={C.textMuted}>CLOSE</Mono>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        <Animated.View style={[s.stamp, stampStyle]}>
          <Icon name="check" size={38} color={C.paper} filled />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(260).duration(M.slow)}>
          <Eyebrow color={C.forest} style={{ marginTop: S.xl }}>
            Order confirmed
          </Eyebrow>

          {/* SAID PLAINLY, ON THE SCREEN THAT SAYS EVERYTHING WENT WELL.
              A line that sold out between the cart and this button is left off
              the order by the server. It used to be left off silently too, with
              the cart cleared behind it — the customer's only way of finding
              out was the parcel arriving short. Naming it here is the whole
              point; the order itself was still placed. */}
          {skippedItems.length > 0 ? (
            <View style={s.skipped}>
              <Icon name="error" size={16} color={C.danger} />
              <Body color={C.textMid} style={{ flex: 1 }}>
                {skippedItems.length === 1
                  ? "One item sold out before we could add it, so it is not on this order and you have not been charged for it."
                  : `${skippedItems.length} items sold out before we could add them, so they are not on this order and you have not been charged for them.`}
              </Body>
            </View>
          ) : null}
          <Rule weight="strong" style={{ marginTop: 9 }} />
          <Display1 style={{ marginTop: S.md }}>That&apos;s packed.</Display1>
          <Body color={C.textMid} style={{ marginTop: 10 }}>
            {pieces ? `${pieces} piece${pieces !== 1 ? "s" : ""}` : "Your order"}
            {total ? ` · ${formatPrice(total)}` : ""} — we&apos;ll email you the moment it leaves Dehradun.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).duration(380)} style={{ marginTop: S.block }}>
          <Rule weight="soft" />
          <SpecTable
            rows={[
              { key: "Order", value: `#${order?.order_number ?? "—"}`, emphasis: true },
              { key: "Placed", value: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" }) },
              { key: "Payment", value: "Cash on delivery" },
              { key: "Ships from", value: "Dehradun" },
            ]}
          />
          <Rule weight="soft" />
        </Animated.View>
      </View>

      <View style={[s.actions, { paddingBottom: insets.bottom + 20 }]}>
        <Button
          title="Track this order"
          variant="dark"
          icon="local_shipping"
          onPress={() => orderId && router.push(`/orders/${orderId}`)}
        />
        <View style={s.altRow}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)/shop")} hitSlop={8}>
            <Text style={s.altT}>Keep shopping</Text>
          </TouchableOpacity>
          <View style={s.altDot} />
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              Share.share({ message: `I just ordered from DEWDROPZ — order #${order?.order_number ?? ""}.` });
            }}
            hitSlop={8}
          >
            <Text style={s.altT}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  skipped: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: C.danger12,
    borderRadius: R.panel,
    padding: 14,
    marginTop: S.md,
  },
  root: { flex: 1, backgroundColor: C.paper },
  top: { alignItems: "flex-end", paddingHorizontal: S.gutter },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: S.gutter, paddingBottom: 40 },
  stamp: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  actions: { paddingHorizontal: S.gutter, gap: S.md },
  altRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.md },
  altT: { fontFamily: F.bodySemiBold, fontSize: 14, color: C.textMid },
  altDot: { width: 3, height: 3, borderRadius: 999, backgroundColor: C.faintIcon },
});
