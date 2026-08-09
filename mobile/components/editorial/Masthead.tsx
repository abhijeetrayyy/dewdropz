import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

function dateline() {
  const now = new Date();
  const day = now.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
  return `${day} ${date} ${now.getFullYear()}`;
}

type Props = {
  /** Right-hand slot override. Defaults to search + saved + notifications. */
  showCart?: boolean;
  unread?: boolean;
};

export function Masthead({ showCart, unread = true }: Props) {
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount());
  const savedCount = useWishlistStore((s) => s.count());

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={s.row}>
        <Text style={s.wordmark}>DEWDROPZ</Text>
        <View style={s.actions}>
          <TouchableOpacity onPress={() => router.push("/search")} hitSlop={10} accessibilityLabel="Search">
            <Icon name="search" size={22} color={C.ink} />
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
              color={savedCount > 0 ? C.clay : C.ink}
              filled={savedCount > 0}
            />
          </TouchableOpacity>

          {showCart ? (
            <TouchableOpacity onPress={() => router.push("/(tabs)/cart")} hitSlop={10} accessibilityLabel="Pack">
              <View>
                <Icon name="backpack" size={22} color={C.ink} />
                <Badge count={cartCount} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push("/notifications")} hitSlop={10} accessibilityLabel="Notifications">
              <View>
                <Icon name="notifications" size={22} color={C.ink} />
                {unread ? <View style={s.dot} /> : null}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Rule weight="ink" style={{ marginTop: 12 }} />

      <View style={s.dateRow}>
        <Text style={s.dateT}>{dateline()}</Text>
        <Text style={s.dateT}>DEHRADUN · 30.3°N</Text>
      </View>

      <Rule weight="soft" />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.paper, paddingHorizontal: S.gutter },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // Wide tracking is what makes a wordmark read as a masthead rather than a
  // logo — it's the one place in the app where letterspacing goes positive on
  // display type.
  wordmark: { fontFamily: F.display, fontSize: 22, letterSpacing: 3.5, color: C.ink },
  actions: { flexDirection: "row", alignItems: "center", gap: 18 },
  dot: { position: "absolute", top: -1, right: -2, width: 7, height: 7, borderRadius: 999, backgroundColor: C.clay, borderWidth: 1.5, borderColor: C.paper },
  dateRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  dateT: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.3, color: C.textMuted },
});
