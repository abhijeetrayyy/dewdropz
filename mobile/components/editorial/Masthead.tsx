import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Rule } from "./Rule";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { C, F, S } from "@/lib/theme";

// A newspaper masthead, which is what the top of an editorial home screen
// should be: the title, the dateline, and nothing else competing with them.
//
//   ┌──────────────────────────────────────────────────────┐
//   │  D E W D R O P Z                         ⌕    ⌂      │
//   ├──────────────────────────────────────────────────────┤
//   │  SAT 09 AUG 2026        DEHRADUN · 30.3°N 78.0°E     │
//   └──────────────────────────────────────────────────────┘
//
// The dateline is the detail that sells it. It costs one `toLocaleDateString`
// and it's the difference between "an app header" and "an issue".

// The real brand mark — a peak-and-river drawn in the logo's own blue, which
// is deliberately NOT recoloured to the forest palette. It's the company's
// asset, it carries alpha, and it composites correctly on both the ink panels
// and the paper masthead, so it goes in as authored.
const LOGO_MARK = require("@/assets/images/logo-mark.png");
/** 1425×820 — the intrinsic ratio, so the mark is never distorted. */
const LOGO_RATIO = 1425 / 820;
const LOGO_H = 22;

function dateline() {
  const now = new Date();
  const day = now.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
  return `${day} ${date} ${now.getFullYear()}`;
}

type Props = {
  /** Right-hand slot: search, saved, pack, notifications. */
  unread?: boolean;
  /**
   * `onDark` strips the paper background and inverts the glyphs so the
   * masthead can sit directly on a photograph. Home stacks one of each and
   * cross-fades between them as the hero scrolls away, which is what lets the
   * hero run full-bleed under the status bar instead of starting below a paper
   * bar.
   */
  tone?: "onLight" | "onDark";
};

export function Masthead({ unread = true, tone = "onLight" }: Props) {
  const insets = useSafeAreaInsets();
  const onDark = tone === "onDark";
  const fg = onDark ? C.paper : C.ink;
  const meta = onDark ? "rgba(251,247,239,0.72)" : C.textMuted;
  const cartCount = useCartStore((s) => s.itemCount());
  const savedCount = useWishlistStore((s) => s.count());

  return (
    <View style={[s.wrap, onDark && s.wrapDark, { paddingTop: insets.top + 10 }]}>
      <View style={s.row}>
        <View style={s.brand}>
          {/* The wordmark beside it already announces the brand, so the mark
              is decorative to a screen reader rather than read twice. */}
          <Image
            source={LOGO_MARK}
            style={{ width: LOGO_H * LOGO_RATIO, height: LOGO_H }}
            resizeMode="contain"
            alt=""
            accessibilityElementsHidden
            importantForAccessibility="no"
            accessibilityIgnoresInvertColors
          />
          <Text style={[s.wordmark, { color: fg }]}>DEWDROPZ</Text>
        </View>
        <View style={s.actions}>
          <TouchableOpacity onPress={() => router.push("/search")} hitSlop={10} accessibilityLabel="Search">
            <Icon name="search" size={22} color={fg} />
          </TouchableOpacity>

          {/* Saved lived only behind You → Saved, which meant the heart on
              every product card wrote to a list with no visible destination —
              you could save things and never find them again. It belongs in
              the masthead: same rank as search, and the filled/clay state
              doubles as proof the tap registered. */}
          <TouchableOpacity onPress={() => router.push("/saved")} hitSlop={10} accessibilityLabel="Saved">
            <Icon
              name="favorite"
              size={22}
              color={savedCount > 0 ? C.clay : fg}
              filled={savedCount > 0}
            />
          </TouchableOpacity>

          {/* Both, always. The pack used to trade places with notifications
              because it also had a tab; now that Rent has taken that slot and
              the pack lives only here, an either/or would make the cart
              unreachable from half the app. */}
          <TouchableOpacity onPress={() => router.push("/(tabs)/cart")} hitSlop={10} accessibilityLabel="Pack">
            <View>
              <Icon name="backpack" size={22} color={fg} />
              <Badge count={cartCount} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/notifications")} hitSlop={10} accessibilityLabel="Notifications">
            <View>
              <Icon name="notifications" size={22} color={fg} />
              {unread ? <View style={s.dot} /> : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Rule weight={onDark ? "soft" : "ink"} style={{ marginTop: 12, ...(onDark ? { backgroundColor: "rgba(251,247,239,0.5)" } : null) }} />

      <View style={s.dateRow}>
        <Text style={[s.dateT, { color: meta }]}>{dateline()}</Text>
        <Text style={[s.dateT, { color: meta }]}>DEHRADUN · 30.3°N</Text>
      </View>

      {onDark ? null : <Rule weight="soft" />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.paper, paddingHorizontal: S.gutter },
  wrapDark: { backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  // Wide tracking is what makes a wordmark read as a masthead rather than a
  // logo — it's the one place in the app where letterspacing goes positive on
  // display type.
  wordmark: { fontFamily: F.display, fontSize: 20, letterSpacing: 3, color: C.ink },
  actions: { flexDirection: "row", alignItems: "center", gap: 18 },
  dot: { position: "absolute", top: -1, right: -2, width: 7, height: 7, borderRadius: 999, backgroundColor: C.clay, borderWidth: 1.5, borderColor: C.paper },
  dateRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  dateT: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.3, color: C.textMuted },
});
