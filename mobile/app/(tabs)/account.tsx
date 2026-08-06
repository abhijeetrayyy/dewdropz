import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link, router } from "expo-router";
import { Package, Heart, LogOut, MapPin } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useWishlistStore } from "@/stores/wishlist";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { C, F, R } from "@/lib/theme";

export default function AccountScreen() {
  const { user, signOut } = useAuthStore();
  const wc = useWishlistStore((s) => s.count());
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <View style={S.root}>
        <Header />
        <View style={S.gt}>
          <Text style={S.gtT}>Your expedition HQ</Text>
          <Text style={S.gtB}>Sign in to track orders, manage addresses, and save gear for later.</Text>
          <Button title="Sign In" onPress={() => router.push("/auth/login")} />
          <TouchableOpacity onPress={() => router.push("/auth/signup")} style={{ marginTop: 18 }}>
            <Text style={S.lnk}>Create an account →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  async function handleSignOut() {
    haptics.tap();
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    toast.show("Signed out");
    router.replace("/account");
  }

  return (
    <View style={S.root}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 24, paddingBottom: 120 }}>
        <Text style={S.eb}>Account</Text>
        <Text style={S.t}>Your basecamp</Text>
        <View style={S.prf}>
          <View style={S.av}>
            <Text style={S.avT}>{user.email?.[0]?.toUpperCase() ?? "D"}</Text>
          </View>
          <View style={{ marginLeft: 14 }}>
            <Text style={S.em}>{user.email}</Text>
            <Text style={S.rl}>Customer</Text>
          </View>
        </View>

        <Link href="/orders" asChild>
          <TouchableOpacity style={S.menu}>
            <Package size={18} strokeWidth={1.75} color={C.forest} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={S.mn}>Orders</Text>
              <Text style={S.ms}>View your order history</Text>
            </View>
            <Text style={S.arr}>→</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/wishlist" asChild>
          <TouchableOpacity style={S.menu}>
            <Heart size={18} strokeWidth={1.75} color={C.forest} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={S.mn}>Wishlist</Text>
              <Text style={S.ms}>{wc > 0 ? `${wc} item${wc > 1 ? "s" : ""} saved` : "Save gear for later"}</Text>
            </View>
            <Text style={S.arr}>→</Text>
          </TouchableOpacity>
        </Link>

        <View style={[S.menu, { opacity: 0.5 }]}>
          <MapPin size={18} strokeWidth={1.75} color={C.forest} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={S.mn}>Addresses</Text>
            <Text style={S.ms}>Managed at checkout</Text>
          </View>
        </View>

        <TouchableOpacity style={S.so} onPress={handleSignOut} disabled={signingOut}>
          <LogOut size={16} strokeWidth={1.5} color={C.clay} />
          <Text style={S.soT}>{signingOut ? "Signing Out…" : "Sign Out"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  gt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 100 },
  gtT: { fontFamily: F.display, fontSize: 24, color: C.text, textAlign: "center" },
  gtB: { fontFamily: F.body, fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 21, marginTop: 10, marginBottom: 28 },
  lnk: { fontFamily: F.bodyBold, fontSize: 14, color: C.forest },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 6 },
  t: { fontFamily: F.display, fontSize: 28, color: C.text, marginBottom: 24 },
  prf: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: R.md + 4, padding: 18, borderWidth: 1, borderColor: C.rule, marginBottom: 28 },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.forest + "1F", alignItems: "center", justifyContent: "center" },
  avT: { fontFamily: F.display, fontSize: 18, color: C.forest },
  em: { fontFamily: F.body, fontSize: 15, color: C.text, fontWeight: "500" },
  rl: { fontFamily: F.body, fontSize: 12, color: C.light, marginTop: 2 },
  menu: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: R.md + 4, padding: 18, borderWidth: 1, borderColor: C.rule, marginBottom: 12 },
  mn: { fontFamily: F.displayBold, fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: C.forest, marginBottom: 2 },
  ms: { fontFamily: F.body, fontSize: 13, color: C.mid },
  arr: { fontSize: 18, color: C.light, fontFamily: F.display },
  so: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: C.clay + "40", borderRadius: R.md, paddingVertical: 16, marginTop: 32 },
  soT: { fontFamily: F.bodyBold, fontSize: 13, color: C.clay, letterSpacing: 0.4, fontWeight: "700" },
});
