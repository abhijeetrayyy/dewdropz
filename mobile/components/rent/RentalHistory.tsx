import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Body, Meta, Mono, Numeric } from "@/components/ui/Type";
import { useRentalHistoryQuery } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { C, S } from "@/lib/theme";

/**
 * What happened to this booking, in order.
 *
 * `rental_events` had twenty-eight write sites and, until the web grew a reader
 * for it, none at all. The app had the same RLS policy available to it — "Own
 * booking events", carried since migration 096 — and no screen using it. This
 * is the phone's half, and it answers the only question that really matters
 * about a deposit: *why is this figure not the figure I handed over?*
 *
 * SOME EVENTS ARE NOT THE CUSTOMER'S BUSINESS. An internal note, a failed
 * payment attempt, an inspection — those are operational detail, and showing
 * them invites a support conversation about something already handled. Every
 * event that moved MONEY is shown, always; that is the whole point of keeping
 * the log. The same split the web's reader makes, for the same reason.
 */
const LOOK: Record<string, { label: string; icon: string; tone: string }> = {
  created:             { label: "Booked",                   icon: "add",              tone: C.textMid },
  payment_received:    { label: "Payment received",         icon: "payments",         tone: C.forestDeep },
  refunded:            { label: "Refunded",                 icon: "undo",             tone: C.forestDeep },
  coupon_applied:      { label: "Discount applied",         icon: "sell",             tone: C.forestDeep },
  deposit_held:        { label: "Deposit taken",            icon: "shield",           tone: C.textMid },
  deposit_refunded:    { label: "Deposit returned",         icon: "south_west",       tone: C.forestDeep },
  deposit_forfeited:   { label: "Deposit kept",             icon: "block",            tone: C.clayDeep },
  handed_over:         { label: "Handed over",              icon: "inventory_2",      tone: C.textMid },
  returned:            { label: "Returned",                 icon: "check_circle",     tone: C.forestDeep },
  late_fee:            { label: "Late return charged",      icon: "schedule",         tone: C.clayDeep },
  damage_fee:          { label: "Damage charged",           icon: "build",            tone: C.clayDeep },
  cancelled:           { label: "Cancelled",                icon: "block",            tone: C.clayDeep },
  extension_requested: { label: "Extension asked for",      icon: "more_time",        tone: C.textMid },
  extension_confirmed: { label: "Extension confirmed",      icon: "check_circle",     tone: C.forestDeep },
  extension_declined:  { label: "Extension declined",       icon: "block",            tone: C.clayDeep },
  reminder_sent:       { label: "Reminder sent",            icon: "mail",             tone: C.textMid },
  dispatched:          { label: "Posted out",               icon: "local_shipping",   tone: C.textMid },
  delivered:           { label: "Delivered",                icon: "check_circle",     tone: C.forestDeep },
  return_booked:       { label: "Return collection booked", icon: "local_shipping",   tone: C.textMid },
};

const STAFF_ONLY = new Set(["note", "photo_added", "payment_failed", "inspected"]);

export function RentalHistory({ bookingId }: { bookingId: string }) {
  const { data: entries = [], isLoading } = useRentalHistoryQuery(bookingId);
  const shown = entries.filter((e) => !STAFF_ONLY.has(e.kind));

  if (isLoading) return <Meta style={{ marginTop: S.sm }}>Reading the log…</Meta>;
  if (!shown.length) return <Meta style={{ marginTop: S.sm }}>Nothing has happened to this booking yet.</Meta>;

  return (
    <View style={s.list}>
      {shown.map((e, i) => {
        // An unrecognised kind renders with its raw name rather than being
        // dropped. A log that silently hides what it does not recognise is not
        // a log — and this list has grown three times already.
        const look = LOOK[e.kind] ?? { label: e.kind.replace(/_/g, " "), icon: "circle", tone: C.textMid };
        const last = i === shown.length - 1;
        return (
          <View key={e.id} style={s.entry}>
            <View style={s.gutter}>
              <View style={s.dot}>
                <Icon name={look.icon} size={12} color={look.tone} />
              </View>
              {!last && <View style={s.spine} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : S.md }}>
              <View style={s.headRow}>
                <Body style={{ fontSize: 14, flex: 1 }}>{look.label}</Body>
                {/* The figure is the reason this exists. It reads as money,
                    aligned right — never buried in the note beside it. */}
                {e.amount != null && e.amount !== 0 && (
                  <Numeric style={{ fontSize: 13 }} color={look.tone}>{formatPrice(e.amount)}</Numeric>
                )}
              </View>
              {!!e.note && <Meta style={{ marginTop: 1 }}>{e.note}</Meta>}
              <Mono style={s.stamp}>{stamp(e.created_at)}</Mono>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Shown in the shop's timezone, because that is where the counter is. A
 *  handover at 00:30 IST rendered in UTC reads as having happened yesterday. */
function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

const s = StyleSheet.create({
  list: { marginTop: S.md },
  entry: { flexDirection: "row", gap: S.sm },
  gutter: { alignItems: "center", width: 22 },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: C.ruleSoft, backgroundColor: C.paper,
    alignItems: "center", justifyContent: "center",
  },
  spine: { flex: 1, width: 1, backgroundColor: C.ruleSoft, marginVertical: 2 },
  headRow: { flexDirection: "row", alignItems: "baseline", gap: S.sm },
  stamp: { fontSize: 9, marginTop: 2, color: C.textMuted },
});
