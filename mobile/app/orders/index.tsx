import { Link } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { formatPrice } from "@/lib/utils";
import { useOrdersQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { C, F, R } from "@/lib/theme";

const SC: Record<string, string> = { pending: C.clay, confirmed: C.sage, processing: C.sage, shipped: C.sage, delivered: C.forest, cancelled: C.clay, refunded: C.light };

export default function OrdersScreen() {
  const { user } = useAuthStore();
  const { data: orders = [], isLoading, isError, refetch } = useOrdersQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  return (
    <ScrollView
      style={S.root}
      contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 24, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
    >
      <Text style={S.eb}>Orders</Text>
      <Text style={S.t}>My Orders</Text>

      {!user ? (
        <EmptyState title="Sign in to see your orders" ctaLabel="Sign in" ctaHref="/auth/login" />
      ) : isLoading ? (
        <View style={{ gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={78} radius={4} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState message="Couldn't load your orders." onRetry={() => refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" ctaLabel="Start shopping" ctaHref="/shop" />
      ) : (
        orders.map((o, i) => (
          <Animated.View key={o.id} entering={FadeInDown.delay(i * 50).springify().damping(18)}>
            <Link href={`/orders/${o.id}`} asChild>
              <TouchableOpacity style={S.card}>
                <View style={S.r}>
                  <Text style={S.on}>#{o.order_number}</Text>
                  <Text style={S.ot}>{formatPrice(o.total_amount)}</Text>
                </View>
                <View style={S.r}>
                  <View style={S.pillRow}>
                    <View style={[S.pill, { backgroundColor: (SC[o.status] ?? C.text) + "1A" }]}>
                      <Text style={[S.pillT, { color: SC[o.status] ?? C.text }]}>{o.status}</Text>
                    </View>
                    <Text style={S.pay}>{o.payment_status}</Text>
                  </View>
                  <Text style={S.od}>{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
                </View>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        ))
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 6 },
  t: { fontFamily: F.display, fontSize: 28, color: C.text, marginBottom: 24 },
  card: { backgroundColor: C.surface, borderRadius: R.md + 4, padding: 18, borderWidth: 1, borderColor: C.rule, marginBottom: 12 },
  r: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  on: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.text, textTransform: "uppercase" },
  ot: { fontFamily: F.display, fontSize: 20, color: C.forest },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillT: { fontFamily: F.bodyBold, fontSize: 11, textTransform: "capitalize" },
  pay: { fontFamily: F.body, fontSize: 11, color: C.light, textTransform: "capitalize" },
  od: { fontFamily: F.body, fontSize: 11, color: C.light },
});
