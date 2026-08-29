import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPrice, pickVariant } from "@/lib/utils";
import { useCancelOrderMutation, useOrderQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { useCartStore } from "@/stores/cart";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { contactSupport } from "@/lib/support";
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

  const addItem = useCartStore((st) => st.addItem);

  const delivered = o?.status === "delivered";
  // Cancelled and refunded orders used to fall through to "Packed." — the one
  // headline the screen exists to get right, stating the opposite of the truth.
  const closed = o?.status === "cancelled" || o?.status === "refunded";

  // What the server will actually accept. `cancelOrderInternal` refuses a
  // shipped or delivered order, so offering the button for one would be a
  // button that always fails — the same class of thing as the old "Track" that
  // pushed to the shop.
  const cancellable = !!o && !closed && o.status !== "shipped" && o.status !== "delivered";
  const cancelOrder = useCancelOrderMutation(id);

  function confirmCancel() {
    haptics.warning();
    Alert.alert(
      "Cancel this order?",
      "We will stop it before it is packed and put the stock back. If it has already been paid for, the refund goes back the way it came.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            try {
              const r = await cancelOrder.mutateAsync(undefined);
              haptics.success();
              toast.show(r.refundIssued ? "Order cancelled — refund on its way" : "Order cancelled");
            } catch (e: unknown) {
              haptics.error();
              // cancelOrderInternal's refusals are written for a person
              // ("Order is already cancelled"), so they are shown as they are.
              Alert.alert("Could not cancel", e instanceof Error ? e.message : "Try again in a moment.");
            }
          },
        },
      ],
    );
  }
  const headline = closed
    ? o?.status === "refunded"
      ? "Refunded."
      : "Cancelled."
    : delivered
      ? "Delivered."
      : o?.status === "shipped"
        ? "On the road."
        : "Packed.";

  // Puts the same pieces back in the pack. Lines whose product has since been
  // delisted are skipped rather than added as a broken line, and the count in
  // the toast reflects what actually went in.
  function buyAgain() {
    if (!o?.items?.length) return;
    haptics.tap();
    let added = 0;
    for (const line of o.items) {
      const p = line.product;
      if (!p) continue;
      const variant = pickVariant(p.variants);
      addItem(
        {
          productId: p.id,
          slug: p.slug,
          name: line.product_name ?? p.slug,
          price: p.price,
          image: p.images?.[0] ?? "",
          size: variant?.name,
          variantId: variant?.id ?? null,
        },
        line.quantity,
      );
      added += 1;
    }
    if (added === 0) {
      toast.show("Those pieces aren't available any more");
      return;
    }
    toast.success(`Added ${added} ${added === 1 ? "piece" : "pieces"} to pack`);
  }

  const helpSubject = o ? `Help with order #${o.order_number}` : "Help with an order";

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <IconButton name="arrow_back" onPress={() => goBack("/orders")} />
        <Mono color={C.textMuted}>{o ? `#${o.order_number}` : "ORDER"}</Mono>
        <IconButton
          name="help"
          accessibilityLabel="Get help with this order"
          onPress={() => contactSupport(helpSubject)}
        />
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
              <Eyebrow color={closed ? C.textMuted : delivered ? C.forest : C.clayDeep}>
                {closed ? "Closed" : delivered ? "Complete" : "In transit"}
              </Eyebrow>
              <Display1 style={{ marginTop: 8 }}>{headline}</Display1>
              <Body color={C.textMid} style={{ marginTop: 8 }}>
                Placed{" "}
                {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </Body>

              {/* The whole delivery-progress apparatus is suppressed once an
                  order is cancelled or refunded. It used to render regardless:
                  a cancelled order showed "In transit", a segment bar and
                  "STAGE 1 OF 4 · PACKED IN DEHRADUN" — a delivery that was
                  never going to happen, described as under way. */}
              {closed ? (
                <Body color={C.textMid} style={{ marginTop: S.lg }}>
                  {o.status === "refunded"
                    ? "This order was refunded. The money is back with your bank — it can take a few working days to appear."
                    : "This order was cancelled and nothing was dispatched."}
                </Body>
              ) : (
                <>
                  {/* Labelled segment bar — each segment is a named stage. */}
                  <View style={s.segments}>
                    {STAGES.map((stg, i) => (
                      <View key={stg.key} style={[s.segment, i <= activeIndex && s.segmentOn]} />
                    ))}
                  </View>
                  <Mono color={C.textMuted} style={{ marginTop: 8 }}>
                    STAGE {activeIndex + 1} OF {STAGES.length} · {STAGES[activeIndex].label.toUpperCase()}
                  </Mono>
                </>
              )}
            </View>

            {/* ── Timeline ───────────────────────────────────────────────── */}
            {closed ? null : (
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
            )}

            {/* ── Contents ───────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: S.gutter, marginTop: S.block }}>
              <SectionHead eyebrow="Contents" title="What's in it." size="d3" />
              <Rule weight="soft" style={{ marginTop: S.md }} />
              {o.items?.map((item, i) => (
                <View key={i}>
                  {i > 0 ? <Rule weight="hair" /> : null}
                  <View style={s.itemRow}>
                    <View style={s.thumb}>
                      {item.image ? <Image source={{ uri: item.image }} style={s.thumbImg} contentFit="cover" alt="" /> : null}
                    </View>
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

      {/* "Track" used to sit here and push to the shop — from the very screen
          that already shows the tracking timeline. It's gone; on an order still
          in transit this screen IS the tracking, so help is the only action
          left to offer. */}
      {o ? (
        <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
          {/* THE TWO THINGS A CUSTOMER ACTUALLY NEEDS AFTER ORDERING, neither
              of which the app could do: stop one that has not shipped, and send
              back one that has arrived. Both existed on the web from launch.

              They are mutually exclusive by definition — an order is either
              still stoppable or already delivered — so only one is ever drawn
              beside "Get help". */}
          <Button
            title="Get help"
            variant="quiet"
            icon="chat"
            onPress={() => contactSupport(helpSubject)}
            style={{ flex: 1 }}
          />
          {cancellable ? (
            <Button
              title={cancelOrder.isPending ? "Cancelling…" : "Cancel order"}
              variant="quiet"
              icon="close"
              disabled={cancelOrder.isPending}
              onPress={confirmCancel}
              style={{ flex: 1 }}
            />
          ) : delivered ? (
            <Button
              title="Return"
              variant="quiet"
              icon="restart_alt"
              onPress={() => router.push(`/orders/${id}/return`)}
              style={{ flex: 1 }}
            />
          ) : null}
          {delivered ? (
            <Button title="Buy again" variant="dark" icon="refresh" onPress={buyAgain} style={{ flex: 1 }} />
          ) : null}
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
  thumb: { width: 52, height: 64, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  thumbImg: { width: "100%", height: "100%" },

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
