import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { Icon } from "@/components/ui/Icon";
import { Mono } from "@/components/ui/Type";
import type { Order } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// "Where you left off"
// ─────────────────────────────────────────────────────────────────────────────
// The IA fix for Home.
//
// Home was written entirely for a first-time visitor: hero, manifesto, seven
// numbered sections of brand. It is a good issue and a poor home screen,
// because a returning customer opens this app to answer one of three questions
// — where is my order, what is in my pack, what did I save — and Home answered
// none of them. You could have two orders in transit and the app's first screen
// would not mention it; the only route was You → Orders, three taps down.
//
// This band takes the slot directly under the hero and answers whichever of
// those is true, in priority order. It renders NOTHING when none of them are —
// so a first-time visitor still gets the trust marquee and the issue reads
// exactly as designed. The same slot serves whoever is actually looking, which
// is the point.
//
// Everything here is real: order status and number off the orders query, counts
// off the cart and wishlist stores. No delivery estimates, because the schema
// has no delivery dates and a guessed "arriving Tuesday" is the kind of small
// lie that costs a support ticket.
// ─────────────────────────────────────────────────────────────────────────────

const ON_THE_WAY = new Set(["pending", "confirmed", "processing", "shipped"]);

/**
 * Whether this band has anything true to show. Exported so the caller can pick
 * a fallback for the slot without rendering the band to find out — the rule
 * lives here, next to the component that obeys it, rather than being restated
 * (and eventually drifting) at the call site.
 */
export function hasContinueContent(orders: Order[], packCount: number, savedCount: number) {
  return orders.some((o) => ON_THE_WAY.has(o.status)) || packCount > 0 || savedCount > 0;
}

/** What the customer would call this status, not what the column calls it. */
const HEADLINE: Record<string, string> = {
  pending: "Order received.",
  confirmed: "Confirmed.",
  processing: "Packing it now.",
  shipped: "On the road.",
};

export function ContinueBand({
  orders,
  packCount,
  packTotal,
  savedCount,
}: {
  orders: Order[];
  packCount: number;
  packTotal: number;
  savedCount: number;
}) {
  const active = orders.find((o) => ON_THE_WAY.has(o.status));
  const hasChips = packCount > 0 || savedCount > 0;

  // Nothing true, nothing shown. The caller falls back to the trust marquee.
  if (!active && !hasChips) return null;

  const thumb = active?.items?.find((it) => it.product?.images?.[0])?.product?.images?.[0];
  const pieces = active?.items?.reduce((n, it) => n + (it.quantity ?? 0), 0) ?? 0;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={s.band}>
      {active ? (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Order ${active.order_number}, ${HEADLINE[active.status] ?? "in progress"}`}
          onPress={() => {
            haptics.tap();
            router.push(`/orders/${active.id}`);
          }}
          style={s.row}
        >
          {thumb ? (
            <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" alt="" />
          ) : (
            <View style={[s.thumb, s.thumbPh]}>
              <Icon name="local_shipping" size={20} color={C.sage} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={s.eyebrowRow}>
              <View style={s.pulse} />
              <Mono color={C.sage}>ON THE WAY</Mono>
            </View>
            <Text style={s.headline} numberOfLines={1}>
              {HEADLINE[active.status] ?? "In progress."}
            </Text>
            <Mono color="rgba(251,247,239,0.5)" style={{ marginTop: 5 }}>
              #{active.order_number} · {pieces || "—"} {pieces === 1 ? "PIECE" : "PIECES"}
            </Mono>
          </View>

          <View style={s.go}>
            <Icon name="arrow_forward" size={18} color={C.ink} />
          </View>
        </TouchableOpacity>
      ) : null}

      {hasChips ? (
        <View style={[s.chips, active ? s.chipsAfter : null]}>
          {packCount > 0 ? (
            <TouchableOpacity
              style={s.chip}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Your pack, ${packCount} pieces, ${formatPrice(packTotal)}`}
              onPress={() => {
                haptics.tap();
                router.push("/(tabs)/cart");
              }}
            >
              <Icon name="backpack" size={15} color={C.paper} />
              <Text style={s.chipT}>
                {packCount} in your pack · {formatPrice(packTotal)}
              </Text>
              <Icon name="arrow_forward" size={14} color="rgba(251,247,239,0.55)" />
            </TouchableOpacity>
          ) : null}

          {savedCount > 0 ? (
            <TouchableOpacity
              style={s.chip}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${savedCount} saved pieces`}
              onPress={() => {
                haptics.tap();
                router.push("/saved");
              }}
            >
              <Icon name="favorite" size={15} color={C.clay} filled />
              <Text style={s.chipT}>{savedCount} saved</Text>
              <Icon name="arrow_forward" size={14} color="rgba(251,247,239,0.55)" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Ink, continuing the hero's darkness one beat further before the issue turns
  // to paper — so the screen opens on a cinematic run rather than cutting to
  // white immediately under the photograph.
  band: { backgroundColor: C.ink, paddingHorizontal: S.gutter, paddingVertical: S.lg },

  row: { flexDirection: "row", alignItems: "center", gap: S.md },
  thumb: { width: 52, height: 64, borderRadius: R.card, backgroundColor: C.inkSoft },
  thumbPh: { alignItems: "center", justifyContent: "center" },

  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pulse: { width: 6, height: 6, borderRadius: 999, backgroundColor: C.sage },
  headline: { fontFamily: F.display, fontSize: 24, lineHeight: 28, color: C.paper, marginTop: 6 },

  go: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: C.paper, alignItems: "center", justifyContent: "center",
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipsAfter: { marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: "rgba(251,247,239,0.12)" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: R.chip, borderWidth: 1, borderColor: "rgba(251,247,239,0.2)",
    paddingVertical: 9, paddingHorizontal: 13,
  },
  chipT: { fontFamily: F.bodyMedium, fontSize: 13, color: C.paper },
});
