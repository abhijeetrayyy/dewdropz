import { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusCap } from "@/components/ui/StatusCap";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Rule } from "@/components/editorial/Rule";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Body, Display2, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { useReturnEligibilityQuery, useRequestReturnMutation } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, R, S, SHADOW_BAR } from "@/lib/theme";

// Sending something back.
//
// The app had no return path at all — `actions/returns.ts` has run the web's
// RMA flow since launch, and on a phone the only route was the "Get help"
// mailbox. For a shop whose product page advertises 7-day returns, that is a
// promise made on one surface and honoured on another.
//
// WHAT IS RETURNABLE IS NOT DECIDED HERE. The screen renders what
// `/api/mobile/orders/[id]/return` says, and that route runs the same
// eligibility rules the web does — the delivery window, the delivered-status
// check, and the quantities already claimed by an earlier return. Asking the
// server also means the reason it refuses is a real sentence rather than this
// screen guessing at one.
const REASONS = [
  "Does not fit",
  "Not what I expected",
  "Arrived damaged",
  "Wrong item sent",
  "Changed my mind",
];

export default function ReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useReturnEligibilityQuery(id);
  const request = useRequestReturnMutation(id);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const lines = data?.lines?.filter((l) => l.returnable > 0) ?? [];
  const chosen = Object.entries(qty).filter(([, n]) => n > 0);
  const refundEstimate = chosen.reduce((sum, [itemId, n]) => {
    const line = lines.find((l) => l.orderItemId === itemId);
    return sum + (line ? line.unitPrice * n : 0);
  }, 0);

  function bump(itemId: string, max: number, delta: number) {
    haptics.select();
    setErr("");
    setQty((prev) => {
      const next = Math.max(0, Math.min(max, (prev[itemId] ?? 0) + delta));
      return { ...prev, [itemId]: next };
    });
  }

  async function submit() {
    setErr("");
    if (!reason) {
      setErr("Pick a reason so we know what to look for.");
      haptics.warning();
      return;
    }
    if (chosen.length === 0) {
      setErr("Choose at least one piece to send back.");
      haptics.warning();
      return;
    }
    try {
      await request.mutateAsync({
        reason,
        note: note.trim() || undefined,
        items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      });
      haptics.success();
      toast.show("Return requested — we will email you the next step");
      goBack("/orders");
    } catch (e: unknown) {
      haptics.error();
      setErr(e instanceof Error ? e.message : "Could not open that return.");
    }
  }

  return (
    <View style={s.root}>
      <StatusCap />
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <IconButton name="arrow_back" accessibilityLabel="Back to the order" onPress={() => goBack("/orders")} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: 240 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>Returns</Eyebrow>
        <Display2 style={{ marginTop: 8 }}>Send something back.</Display2>

        {isLoading ? (
          <View style={{ gap: S.md, marginTop: S.xl }}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : !data?.eligible ? (
          <EmptyState
            eyebrow="Not available"
            icon="restart_alt"
            title="This order cannot be returned."
            body={data?.reason ?? "Returns close a few days after delivery."}
            ctaLabel="Get help"
            onPress={() => goBack("/orders")}
            style={{ marginTop: S.lg }}
          />
        ) : (
          <>
            <Body color={C.textMid} style={{ marginTop: 10 }}>
              Choose what is coming back and why. Nothing is refunded until the parcel reaches us
              — that is the one rule this whole process is built around.
            </Body>

            <View style={{ marginTop: S.block }}>
              <Eyebrow>What is coming back</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9 }} />
              {lines.map((l) => {
                const n = qty[l.orderItemId] ?? 0;
                return (
                  <View key={l.orderItemId}>
                    <View style={s.line}>
                      <View style={{ flex: 1 }}>
                        <Title>{l.name}</Title>
                        <Body color={C.textMid} style={{ marginTop: 2 }}>
                          {formatPrice(l.unitPrice)} each · {l.returnable} returnable
                        </Body>
                      </View>
                      <View style={s.stepper}>
                        <TouchableOpacity
                          onPress={() => bump(l.orderItemId, l.returnable, -1)}
                          disabled={n === 0}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`One fewer ${l.name}`}
                        >
                          <Icon name="remove" size={18} color={n === 0 ? C.disabled : C.ink} />
                        </TouchableOpacity>
                        <Numeric style={{ minWidth: 22, textAlign: "center" }}>{n}</Numeric>
                        <TouchableOpacity
                          onPress={() => bump(l.orderItemId, l.returnable, 1)}
                          disabled={n >= l.returnable}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`One more ${l.name}`}
                        >
                          <Icon name="add" size={18} color={n >= l.returnable ? C.disabled : C.ink} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Rule weight="soft" />
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: S.block }}>
              <Eyebrow>Why</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9, marginBottom: S.md }} />
              <View style={s.reasons}>
                {REASONS.map((r) => {
                  const on = reason === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => { haptics.select(); setReason(r); setErr(""); }}
                      style={[s.chip, on && s.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Body color={on ? C.paper : C.textMid}>{r}</Body>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: S.lg }}>
                <Input
                  label="Anything else"
                  value={note}
                  multiline
                  maxLength={500}
                  onChangeText={setNote}
                  hint="Optional — a photograph is not needed yet, we will ask if it helps."
                />
              </View>
            </View>

            {err ? (
              <View style={s.err}>
                <Icon name="error" size={16} color={C.danger} />
                <Body color={C.danger} style={{ flex: 1 }}>{err}</Body>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {data?.eligible ? (
        <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={s.barLine}>
            <Body color={C.textMid}>Refund estimate</Body>
            <Numeric>{formatPrice(refundEstimate)}</Numeric>
          </View>
          {/* Said before the button, not after the parcel. The refund is the
              line value of what is being sent back; delivery is not returned
              and this does not pretend otherwise. */}
          <Mono color={C.textFaint} style={{ marginTop: 4 }}>
            DELIVERY IS NOT REFUNDED · PAID BACK THE WAY IT CAME
          </Mono>
          <Button
            title={request.isPending ? "Sending…" : "Request return"}
            loading={request.isPending}
            disabled={request.isPending}
            onPress={submit}
            style={{ width: "100%", marginTop: S.md }}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: S.gutter, paddingBottom: S.sm },
  line: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    borderWidth: 1,
    borderColor: C.ruleMed,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  chip: { borderWidth: 1, borderColor: C.ruleMed, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  err: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.danger12,
    borderRadius: R.panel,
    padding: 14,
    marginTop: S.lg,
  },
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
  barLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
