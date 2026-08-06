import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, ShoppingBag } from "lucide-react-native";
import { C, F } from "@/lib/theme";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";

const LOGO_MARK = require("@/assets/images/logo-mark.png");
const LOGO_ASPECT = 1425 / 820;

// A normal in-flow app bar — every screen is on the warm cream surface now,
// so there's no more "transparent overlay over a hero image" case to
// support. Sitting in flow (not position:absolute) also means screens no
// longer need to fake a matching top-padding estimate to avoid content
// hiding behind it — the exact bug that clipped the Shop title on Android.
export function Header() {
  const insets = useSafeAreaInsets();
  const count = useCartStore((s) => s.itemCount());
  const wlCount = useWishlistStore((s) => s.count());

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 14 }]}>
      <View style={s.row}>
        <TouchableOpacity style={s.logo} activeOpacity={0.7} onPress={() => router.push("/")}>
          <Image source={LOGO_MARK} style={{ width: 26 * LOGO_ASPECT, height: 26 }} contentFit="contain" />
          <Text style={s.wm}>DEWDROPZ</Text>
        </TouchableOpacity>
        <View style={s.actions}>
          <TouchableOpacity style={s.btn} activeOpacity={0.6} onPress={() => router.push("/wishlist")}>
            <Heart size={21} strokeWidth={1.75} color={wlCount > 0 ? C.forest : C.text} fill={wlCount > 0 ? C.forest : "transparent"} />
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} activeOpacity={0.6} onPress={() => router.push("/cart")}>
            <ShoppingBag size={21} strokeWidth={1.75} color={C.text} />
            {count > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeT}>{count > 99 ? "99+" : count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.paper, paddingHorizontal: 22, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.rule },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { flexDirection: "row", alignItems: "center", gap: 9 },
  wm: { fontFamily: F.display, fontSize: 15, letterSpacing: 3, color: C.text, textTransform: "uppercase" },
  actions: { flexDirection: "row", alignItems: "center", gap: 22 },
  btn: { position: "relative", padding: 4 },
  badge: { position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.forest, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeT: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
