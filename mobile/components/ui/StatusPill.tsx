import { StyleSheet, View } from "react-native";
import { Mono } from "./Type";
import { C, R } from "@/lib/theme";

/**
 * One status vocabulary for the whole app.
 *
 * Orders and rentals each kept their own `STATUS_TONE` map — same shape, same
 * colours, different files — and the orders one had already shipped missing
 * `refunded`, so a refunded order fell through to the `pending` fallback and
 * told the customer their money-back order was still waiting to be processed.
 * That is the failure mode of a duplicated lookup: the copies drift, and the
 * gap is silent.
 *
 * Adding a status to a domain below is now the single place it has to be done.
 * Anything unknown renders as neutral rather than falling through to a
 * confident lie.
 */
type Look = { label: string; fg: string; bg: string };

const ORDER: Record<string, Look> = {
  pending:   { label: "PENDING",     fg: C.textMid,    bg: C.cream },
  confirmed: { label: "CONFIRMED",   fg: C.textMid,    bg: C.cream },
  processing:{ label: "PACKING",     fg: C.clayDeep,   bg: C.clay12 },
  shipped:   { label: "ON THE ROAD", fg: C.clayDeep,   bg: C.clay12 },
  delivered: { label: "DELIVERED",   fg: C.forestDeep, bg: C.forest12 },
  cancelled: { label: "CANCELLED",   fg: C.danger,     bg: C.danger12 },
  refunded:  { label: "REFUNDED",    fg: C.textMuted,  bg: C.cream },
};

const RENTAL: Record<string, Look> = {
  reserved:  { label: "HELD FOR YOU", fg: C.clayDeep,   bg: C.clay12 },
  out:       { label: "WITH YOU",     fg: C.forestDeep, bg: C.forest12 },
  returned:  { label: "RETURNED",     fg: C.textMid,    bg: C.cream },
  closed:    { label: "CLOSED",       fg: C.textMuted,  bg: C.cream },
  cancelled: { label: "CANCELLED",    fg: C.danger,     bg: C.danger12 },
};

const DOMAIN = { order: ORDER, rental: RENTAL } as const;

const UNKNOWN: Look = { label: "—", fg: C.textMuted, bg: C.cream };

export type StatusDomain = keyof typeof DOMAIN;

export function statusLook(domain: StatusDomain, status: string): Look {
  return DOMAIN[domain][status] ?? { ...UNKNOWN, label: status.toUpperCase() };
}

export function StatusPill({
  domain,
  status,
  style,
}: {
  domain: StatusDomain;
  status: string;
  style?: object;
}) {
  const look = statusLook(domain, status);
  return (
    <View style={[s.pill, { backgroundColor: look.bg }, style]}>
      <Mono style={[s.text, { color: look.fg }]}>{look.label}</Mono>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 9, letterSpacing: 1 },
});
