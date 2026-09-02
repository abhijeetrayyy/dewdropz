import { forwardRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Sheet } from "@/components/ui/Sheet";
import { Rule } from "@/components/editorial/Rule";
import { Button } from "@/components/Button";
import { Body, Meta, Numeric } from "@/components/ui/Type";
import { toast } from "@/components/ui/Toast";
import { useCancellationQuoteQuery, useCancelRentalMutation } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

/**
 * Calling off a booking, with the figure on screen before the button is tapped.
 *
 * WHAT THIS REPLACES ON THE PHONE: nothing. There was no way to cancel a rental
 * from the app at all — the only route was to telephone the shop, for gear that
 * had not left the building.
 *
 * The figure is fetched BEFORE the confirmation is offered, and it is the same
 * `cancellationQuote` the refund itself runs, reached through the same library
 * the web account screen calls. Not a second implementation that agrees today:
 * the number shown and the number paid are one function call apart.
 *
 * THE RETAINED AMOUNT IS ITS OWN LINE, even when it is zero. A refund figure
 * shown alone reads as "this is what you get" and leaves somebody to work out
 * whether anything was kept. Naming both, and naming the rule that decided it,
 * is the difference between a published policy and an unexplained deduction.
 */
type Props = {
  bookingId: string | null;
  bookingNumber: string;
  onCancelled: () => void;
};

export const CancelRentalSheet = forwardRef<BottomSheetModal, Props>(
  ({ bookingId, bookingNumber, onCancelled }, ref) => {
    // Only asked for once the sheet has a booking, so a list of six bookings
    // does not price six cancellations nobody asked about.
    const { data: quote, isLoading, error } = useCancellationQuoteQuery(bookingId ?? undefined, !!bookingId);
    const cancel = useCancelRentalMutation();

    const dismiss = () => (ref as React.RefObject<BottomSheetModal> | null)?.current?.dismiss();

    async function confirm() {
      if (!bookingId) return;
      haptics.select();
      try {
        const res = await cancel.mutateAsync(bookingId);
        haptics.success();
        toast.success(
          res.refunded > 0
            ? `Cancelled — ${formatPrice(res.refunded)} is on its way back to you.`
            : `${bookingNumber} cancelled.`,
        );
        dismiss();
        onCancelled();
      } catch (e) {
        haptics.error();
        toast.error(e instanceof Error ? e.message : "That didn't go through.");
      }
    }

    return (
      <Sheet ref={ref} snapPoints={["58%"]} eyebrow="Cancel" title={`Cancel ${bookingNumber}?`} onClose={dismiss}>
        {isLoading ? (
          <View style={s.centre}>
            <ActivityIndicator color={C.forest} />
            <Meta style={{ marginTop: S.sm }}>Working out what comes back…</Meta>
          </View>
        ) : error || !quote ? (
          <Meta color={C.danger}>
            {error instanceof Error ? error.message : "Couldn't work out the refund just now."}
          </Meta>
        ) : (
          <>
            <Body style={{ fontSize: 14 }} color={C.textMid}>{quote.summary}</Body>

            <Rule weight="soft" style={{ marginVertical: S.md }} />

            {quote.rentRefund > 0 && (
              <Line k="Rental refunded" v={formatPrice(quote.rentRefund)} tone={C.forestDeep} />
            )}
            {quote.rentRetained > 0 && (
              <Line k="Kept by the shop" v={`− ${formatPrice(quote.rentRetained)}`} tone={C.clayDeep} />
            )}
            {quote.depositRefund > 0 && (
              <Line k="Deposit returned in full" v={formatPrice(quote.depositRefund)} tone={C.forestDeep} />
            )}

            <Rule weight="soft" style={{ marginVertical: S.md }} />
            <Line k="Coming back to you" v={formatPrice(quote.total)} strong />

            {quote.rentRetained > 0 && (
              <Meta style={{ marginTop: S.md }}>{quote.band.label}</Meta>
            )}
            <Meta style={{ marginTop: S.sm }}>
              Refunds go back to whatever you paid from, and usually land within five to seven
              working days.
            </Meta>

            <View style={s.actions}>
              <Button title="Keep it" variant="quiet" onPress={dismiss} style={{ flex: 1 }} />
              <Button
                title={quote.total > 0 ? `Cancel · ${formatPrice(quote.total)} back` : "Yes, cancel it"}
                variant="dark"
                onPress={confirm}
                loading={cancel.isPending}
                disabled={!quote.cancellable}
                style={{ flex: 1.5 }}
              />
            </View>
          </>
        )}
      </Sheet>
    );
  },
);

CancelRentalSheet.displayName = "CancelRentalSheet";

function Line({ k, v, tone, strong }: { k: string; v: string; tone?: string; strong?: boolean }) {
  return (
    <View style={s.line}>
      <Body style={{ fontSize: 14, ...(strong ? { fontFamily: F.bodyMedium } : {}) }} color={strong ? C.ink : C.textMid}>
        {k}
      </Body>
      <Numeric style={{ fontSize: strong ? 16 : 14 }} color={strong ? C.ink : tone}>{v}</Numeric>
    </View>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: "center", paddingVertical: S.xl },
  line: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 },
  actions: { flexDirection: "row", gap: S.sm, marginTop: S.xl },
});
