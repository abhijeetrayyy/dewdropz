import { useMemo, useState } from "react";
import { Link, router } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { formatPrice } from "@/lib/utils";
import { useOrdersQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Body, Mono, Numeric, Title } from "@/components/ui/Type";
import { C, F, R, S } from "@/lib/theme";

const ON_THE_WAY = new Set(["pending", "confirmed", "processing", "shipped"]);

// Every status the orders table can hold gets a tone. v4 only distinguished
// "delivered" from "everything else", so an order that had been cancelled
// still rendered as "ON THE ROAD" with a truck icon.
const STATUS_TONE: Record<string, { label: string; fg: string; bg: string }> = {
  delivered: { label: "DELIVERED", fg: C.meadowDeep, bg: C.meadow12 },
  shipped: { label: "ON THE ROAD", fg: C.marigoldDeep, bg: C.marigold12 },
  processing: { label: "PACKING", fg: C.marigoldDeep, bg: C.marigold12 },
  confirmed: { label: "CONFIRMED", fg: C.textMid, bg: C.cream },
  pending: { label: "PENDING", fg: C.textMid, bg: C.cream },
  cancelled: { label: "CANCELLED", fg: C.danger, bg: C.danger12 },
};

// Orders. v4 rendered each order as a shadowed card containing two grey
// placeholder squares standing in for product thumbnails — decoration where
// information should be. v5 makes each order a ruled docket row: status,
// number, date, piece count, total. Everything you'd actually scan for.
export default function OrdersScreen() {
  const { user } = useAuthStore();
  const { data: orders = [], isLoading, isError, refetch } = useOrdersQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("all");

  const filtered = useMemo(() => {
    if (filter === "active") return orders.filter((o) => ON_THE_WAY.has(o.status));
    if (filter === "delivered") return orders.filter((o) => o.status === "delivered");
    return orders;
  }, [orders, filter]);

  const activeCount = orders.filter((o) => ON_THE_WAY.has(o.status)).length;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        <ScreenHeader
          eyebrow="Your history"
          title="Orders"
          lede={activeCount > 0 ? `${activeCount} on the way right now.` : undefined}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label="All" count={orders.length} selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="On the way" selected={filter === "active"} onPress={() => setFilter("active")} />
          <Chip label="Delivered" selected={filter === "delivered"} onPress={() => setFilter("delivered")} />
        </ScrollView>

        <View style={{ paddingHorizontal: S.gutter, marginTop: S.lg }}>
          {!user ? (
            <EmptyState
              eyebrow="Signed out"
              icon="receipt_long"
              title="Sign in to see your orders."
              body="Your order history follows your account across every device."
              ctaLabel="Sign in"
              ctaHref="/auth/login"
            />
          ) : isLoading ? (
            <SkeletonRows count={3} />
          ) : isError ? (
            <ErrorState message="Couldn't load your orders." onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              eyebrow="Nothing here"
              icon="receipt_long"
              title={filter === "all" ? "No orders yet." : "Nothing in this state."}
              body={
                filter === "all"
                  ? "When you place an order it'll show up here with live tracking."
                  : "Try another filter — your other orders are still here."
              }
              ctaLabel={filter === "all" ? "Start shopping" : "Show all orders"}
              onPress={filter === "all" ? () => router.push("/(tabs)/shop") : () => setFilter("all")}
            />
          ) : (
            <>
              <Rule weight="ink" />
              {filtered.map((o, i) => {
                const tone = STATUS_TONE[o.status] ?? STATUS_TONE.pending;
                const delivered = o.status === "delivered";
                // Sum quantities, not lines — an order of one item ×3 is
                // "3 pieces" to a customer, not "1 piece".
                const count = o.items?.reduce((n, it) => n + (it.quantity ?? 0), 0) ?? 0;

                return (
                  <Animated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).springify().damping(18)}>
                    <Link href={`/orders/${o.id}`} asChild>
                      <TouchableOpacity activeOpacity={0.7}>
                        <View style={s.row}>
                          <View style={s.rowTop}>
                            <View style={[s.status, { backgroundColor: tone.bg }]}>
                              <Text style={[s.statusT, { color: tone.fg }]}>{tone.label}</Text>
                            </View>
                            <View style={{ flex: 1 }} />
                            <Mono color={C.textFaint}>#{o.order_number}</Mono>
                          </View>

                          <View style={s.rowBody}>
                            <View style={{ flex: 1 }}>
                              <Title>
                                {count} {count === 1 ? "piece" : "pieces"}
                              </Title>
                              <Body color={C.textMid} style={{ marginTop: 3 }}>
                                {delivered ? "Delivered" : "Ordered"}{" "}
                                {new Date(o.created_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </Body>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 6 }}>
                              <Numeric>{formatPrice(o.total_amount)}</Numeric>
                              <View style={s.go}>
                                <Text style={s.goT}>{delivered ? "Buy again" : "Track"}</Text>
                                <Icon name="arrow_forward" size={15} color={C.ink} />
                              </View>
                            </View>
                          </View>
                        </View>
                        <Rule weight="soft" />
                      </TouchableOpacity>
                    </Link>
                  </Animated.View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  chips: { gap: 8, paddingHorizontal: S.gutter },
  row: { paddingVertical: S.lg, gap: S.md },
  rowTop: { flexDirection: "row", alignItems: "center", gap: S.sm },
  status: { borderRadius: R.tag, paddingHorizontal: 7, paddingVertical: 3.5 },
  statusT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.1 },
  rowBody: { flexDirection: "row", alignItems: "flex-start", gap: S.md },
  go: { flexDirection: "row", alignItems: "center", gap: 4 },
  goT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
});
