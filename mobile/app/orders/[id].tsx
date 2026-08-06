import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { formatPrice } from "@/lib/utils";
import { useOrderQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { C, F, R } from "@/lib/theme";

const SC: Record<string, string> = { pending: C.clay, confirmed: C.sage, processing: C.sage, shipped: C.sage, delivered: C.forest, cancelled: C.clay, refunded: C.light };

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: o, isLoading, isError, refetch } = useOrderQuery(id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  return (
    <ScrollView
      style={S.root}
      contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
    >
      <Stack.Screen options={{ title: o ? `#${o.order_number}` : "" }} />
      {isLoading ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={100} radius={4} />
          <Skeleton height={200} radius={4} />
        </View>
      ) : isError || !o ? (
        <ErrorState message="Couldn't load this order." onRetry={() => refetch()} />
      ) : (
        <>
          <Text style={S.eb}>Order</Text>
          <Text style={S.t}>#{o.order_number}</Text>
          <Text style={S.d}>{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>

          <View style={S.sc}>
            <View style={S.sr}>
              <Text style={S.sl}>Status</Text>
              <View style={[S.pl, { backgroundColor: (SC[o.status] ?? C.text) + "1A" }]}>
                <Text style={[S.plt, { color: SC[o.status] ?? C.text }]}>{o.status}</Text>
              </View>
            </View>
            <View style={[S.sr, { marginBottom: 0 }]}>
              <Text style={S.sl}>Payment</Text>
              <Text style={S.sv}>{o.payment_status}</Text>
            </View>
          </View>

          <Text style={S.secl}>Items</Text>
          {o.items?.map((item, i) => (
            <View key={i} style={S.ir}>
              <View style={{ flex: 1 }}>
                <Text style={S.in}>{item.product_name}</Text>
                <Text style={S.iq}>Qty: {item.quantity}</Text>
              </View>
              <Text style={S.ip}>{formatPrice(item.unit_price * item.quantity)}</Text>
            </View>
          ))}

          <View style={S.tc}>
            <View style={S.tr}>
              <Text style={S.tl}>Subtotal</Text>
              <Text style={S.tv}>{formatPrice(o.subtotal)}</Text>
            </View>
            <View style={S.tr}>
              <Text style={S.tl}>Shipping</Text>
              <Text style={o.shipping_cost === 0 ? S.free : S.tv}>{o.shipping_cost === 0 ? "Free" : formatPrice(o.shipping_cost)}</Text>
            </View>
            <View style={[S.tr, S.tt]}>
              <Text style={S.ttL}>Total</Text>
              <Text style={S.ttV}>{formatPrice(o.total_amount)}</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 6 },
  t: { fontFamily: F.display, fontSize: 28, color: C.text },
  d: { fontFamily: F.body, fontSize: 13, color: C.light, marginTop: 4 },
  sc: { backgroundColor: C.surface, borderRadius: R.md + 4, padding: 18, borderWidth: 1, borderColor: C.rule, marginTop: 20, marginBottom: 24 },
  sr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, color: C.light },
  pl: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  plt: { fontFamily: F.bodyBold, fontSize: 12, textTransform: "capitalize" },
  sv: { fontFamily: F.body, fontSize: 14, color: C.text, textTransform: "capitalize" },
  secl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 14 },
  ir: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.rule },
  in: { fontFamily: F.body, fontSize: 14, fontWeight: "500", color: C.text },
  iq: { fontFamily: F.body, fontSize: 12, color: C.light, marginTop: 3 },
  ip: { fontFamily: F.body, fontSize: 14, color: C.mid },
  tc: { marginTop: 24, paddingTop: 16 },
  tr: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  tl: { fontFamily: F.body, fontSize: 14, color: C.mid },
  tv: { fontFamily: F.body, fontSize: 14, color: C.text },
  free: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest },
  tt: { borderTopWidth: 1, borderTopColor: C.rule, marginTop: 8, paddingTop: 14 },
  ttL: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  ttV: { fontFamily: F.display, fontSize: 24, color: C.forest },
});
