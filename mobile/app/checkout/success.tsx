import { useEffect } from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { useOrderQuery } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/Button";
import { Rule } from "@/components/editorial/Rule";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display1, Eyebrow, Mono } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, F, M, S } from "@/lib/theme";

// Order confirmation. `gestureEnabled` is off for this route (app/_layout.tsx)
// so the only ways out are the explicit actions below — a swipe-back here
// would land the user on a checkout form for an order they already placed.
//
// The stamp is the whole idea: a confirmation should feel like a receipt being
// franked, so the mark springs in slightly rotated, and the order number is
// set in mono like a real docket reference rather than as body copy.
export default function OrderPlacedScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: order } = useOrderQuery(orderId);

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
          <Rule weight="strong" style={{ marginTop: 9 }} />
          <Display1 style={{ marginTop: S.md }}>That&apos;s packed.</Display1>
          <Body color={C.textMid} style={{ marginTop: 10 }}>
            {pieces ? `${pieces} piece${pieces !== 1 ? "s" : ""}` : "Your order"}
            {total ? ` · ${formatPrice(total)}` : ""} — we&apos;ll email you the moment it leaves Dehradun.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).springify().damping(18)} style={{ marginTop: S.block }}>
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
