import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPrice } from "@/lib/utils";
import { useOrderQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/Button";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display1, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { C, R, S, SHADOW_BAR } from "@/lib/theme";

// The four stages an order moves through, each listing the statuses at which
// it counts as reached. Driven off the same `status` column the admin panel
// writes, so the timeline can't drift from reality.
const STAGES = [
  { key: "packed", label: "Packed in Dehradun", note: "Picked, checked and boxed", statuses: ["pending", "confirmed", "processing", "shipped", "delivered"] },
  { key: "road", label: "Left the facility", note: "Handed to the courier", statuses: ["shipped", "delivered"] },
  { key: "out", label: "Out for delivery", note: "On the last leg", statuses: ["delivered"] },
  { key: "delivered", label: "Delivered", note: "Signed for", statuses: ["delivered"] },
] as const;

// Order detail. The status block leads — when you open this screen you have
// exactly one question, and v4 answered it with a green card whose headline
// ("Packed") sat above a four-segment bar with no labels, so the bar told you
// nothing about what the remaining segments were.
export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: o, isLoading, isPending, isError, refetch } = useOrderQuery(id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  const activeIndex = o
    ? STAGES.reduce((acc, stage, i) => (stage.statuses.includes(o.status as never) ? i : acc), o.status === "delivered" ? 3 : 0)
    : 0;

  const delivered = o?.status === "delivered";
  const headline = delivered ? "Delivered." : o?.status === "shipped" ? "On the road." : "Packed.";

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <IconButton name="arrow_back" onPress={() => router.back()} />
        <Mono color={C.textMuted}>{o ? `#${o.order_number}` : "ORDER"}</Mono>
        <IconButton name="help" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* isPending covers the disabled/not-yet-started case too — see
            the note on the product screen. */}
        {!id || isLoading || isPending ? (
          <View style={{ paddingHorizontal: S.gutter, gap: 14, paddingTop: S.lg }}>
            <Skeleton height={12} width="30%" />
            <Skeleton height={40} width="60%" />
            <Skeleton height={180} radius={R.panel} />
          </View>
        ) : isError || !o ? (
          <View style={{ paddingHorizontal: S.gutter }}>
            <ErrorState message="Couldn't load this order." onRetry={() => refetch()} />
          </View>
        ) : (
          <>
            {/* ── Status ─────────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: S.gutter, paddingTop: S.lg }}>
              <Eyebrow color={delivered ? C.forest : C.clayDeep}>
                {delivered ? "Complete" : "In transit"}
              </Eyebrow>
              <Display1 style={{ marginTop: 8 }}>{headline}</Display1>
              <Body color={C.textMid} style={{ marginTop: 8 }}>
                Placed{" "}
                {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </Body>

              {/* Labelled segment bar — each segment is a named stage. */}
              <View style={s.segments}>
                {STAGES.map((stg, i) => (
                  <View key={stg.key} style={[s.segment, i <= activeIndex && s.segmentOn]} />
                ))}
              </View>
              <Mono color={C.textMuted} style={{ marginTop: 8 }}>
                STAGE {activeIndex + 1} OF {STAGES.length} · {STAGES[activeIndex].label.toUpperCase()}
              </Mono>
            </View>

            {/* ── Timeline ───────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: S.gutter, marginTop: S.block }}>
              <SectionHead eyebrow="Progress" title="Where it is." size="d3" />
              <View style={{ marginTop: S.lg }}>
                {STAGES.map((stg, i) => {
                  const done = i <= activeIndex;
                  const current = i === activeIndex;
                  return (
                    <View key={stg.key} style={s.stageRow}>
                      <View style={s.stageRail}>
                        <View style={[s.dot, done && s.dotDone, current && s.dotCurrent]}>
                          {done && !current ? <Icon name="check" size={11} color={C.paper} filled /> : null}
                        </View>
                        {i < STAGES.length - 1 ? <View style={[s.connector, i < activeIndex && s.connectorDone]} /> : null}
                      </View>
                      <View style={{ flex: 1, paddingBottom: S.lg }}>
                        <Title color={done ? C.ink : C.textFaint}>{stg.label}</Title>
                        <Body color={done ? C.textMid : C.textFaint} style={{ marginTop: 2 }}>
                          {stg.note}
                        </Body>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Contents ───────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: S.gutter, marginTop: S.block }}>
              <SectionHead eyebrow="Contents" title="What's in it." size="d3" />
              <Rule weight="soft" style={{ marginTop: S.md }} />
              {o.items?.map((item, i) => (
                <View key={i}>
                  {i > 0 ? <Rule weight="hair" /> : null}
                  <View style={s.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Title>{item.product_name}</Title>
                      <Mono color={C.textMuted} style={{ marginTop: 4 }}>
                        QTY {item.quantity}
                        {item.unit_price != null ? ` · ${formatPrice(item.unit_price)} EACH` : ""}
                      </Mono>
                    </View>
                    <Numeric>{formatPrice((item.unit_price ?? 0) * item.quantity)}</Numeric>
                  </View>
                </View>
              ))}
              <Rule weight="soft" />

              <SpecTable
                style={{ marginTop: S.lg }}
                rows={[
                  { key: "Subtotal", value: formatPrice(o.subtotal) },
                  { key: "Shipping", value: o.shipping_cost === 0 ? "Free" : formatPrice(o.shipping_cost) },
                  { key: "Payment", value: o.payment_status },
                  { key: "Total paid", value: formatPrice(o.total_amount), emphasis: true },
                ]}
              />
              <Rule weight="soft" />
            </View>
          </>
        )}
      </ScrollView>

      {o ? (
        <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
          <Button title="Get help" variant="quiet" icon="chat" onPress={() => {}} style={{ flex: 1 }} />
          <Button
            title={delivered ? "Buy again" : "Track"}
            variant="dark"
            icon={delivered ? "refresh" : "map"}
            onPress={() => router.push("/(tabs)/shop")}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.gutter, height: 50 },

  segments: { flexDirection: "row", gap: 4, marginTop: S.lg },
  segment: { flex: 1, height: 3, borderRadius: R.tag, backgroundColor: C.sand },
  segmentOn: { backgroundColor: C.ink },

  stageRow: { flexDirection: "row", gap: S.md },
  stageRail: { alignItems: "center", width: 18 },
  dot: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: C.ruleMed, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: C.ink, borderColor: C.ink },
  // The current stage is a ring, not a filled dot — "you are here" reads
  // differently from "this is done".
  dotCurrent: { backgroundColor: C.paper, borderColor: C.ink, borderWidth: 5 },
  connector: { width: 1.5, flex: 1, minHeight: 22, backgroundColor: C.ruleMed },
  connectorDone: { backgroundColor: C.ink },

  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md, paddingVertical: S.md },

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
    flexDirection: "row",
    gap: S.sm,
    ...SHADOW_BAR,
  },
});
