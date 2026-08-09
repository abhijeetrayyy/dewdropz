import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { useWishlistStore } from "@/stores/wishlist";
import { useOrdersQuery } from "@/lib/queries";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Rule } from "@/components/editorial/Rule";
import { Body, Display1, Display2, Eyebrow, Mono, Title } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { SITE } from "@/lib/editorial";
import { C, F, S } from "@/lib/theme";

const ON_THE_WAY = new Set(["pending", "confirmed", "processing", "shipped"]);

// The account hub. v4 was a mint header strip plus two shadowed lists of
// identical grey rows — every destination weighted the same, including "Email
// offers" sitting one row below "Orders".
//
// v5 splits it into three ranks:
//   • Two count tiles (orders on the way, saved pieces) — the two things a
//     returning customer opens this tab to check.
//   • A primary ruled list of real destinations.
//   • A quiet secondary list for support and sign-out.
// Plus links to the editorial screens, which had no entry point anywhere in
// the app's navigation before this pass.
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const wishlistCount = useWishlistStore((st) => st.count());
  const { data: orders = [] } = useOrdersQuery(user?.id);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: S.section }}>
          <View style={{ paddingHorizontal: S.gutter }}>
            <Eyebrow>Your account</Eyebrow>
            <Display1 style={{ marginTop: 8 }}>Sign in.</Display1>
            <Body color={C.textMid} style={{ marginTop: 12 }}>
              One account keeps your pack, your orders and your saved gear in sync across every device you own.
            </Body>
            <Button title="Sign in" variant="dark" onPress={() => router.push("/auth/login")} style={{ marginTop: S.xl, alignSelf: "flex-start" }} />
            <Button title="Create an account" variant="link" onPress={() => router.push("/auth/signup")} style={{ marginTop: S.md }} />

            <View style={{ marginTop: S.section }}>
              <Eyebrow>Read while you&apos;re here</Eyebrow>
              <Rule weight="ink" style={{ marginTop: 9 }} />
              <NavRow icon="menu_book" label="The journal" onPress={() => router.push("/journal")} />
              <NavRow icon="landscape" label="Our story" onPress={() => router.push("/about")} />
              <NavRow icon="eco" label="Sustainability" onPress={() => router.push("/sustainability")} last />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  async function handleSignOut() {
    haptics.tap();
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    toast.show("Signed out");
  }

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Member";
  const active = orders.filter((o) => ON_THE_WAY.has(o.status)).length;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
        {/* ── Identity ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: S.gutter }}>
          <View style={s.idRow}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Signed in</Eyebrow>
              <Display2 style={{ marginTop: 8 }} numberOfLines={2}>
                {name}
              </Display2>
              {user.email ? (
                <Mono color={C.textMuted} style={{ marginTop: 8 }}>
                  {user.email.toUpperCase()}
                </Mono>
              ) : null}
            </View>
            <IconButton name="settings" onPress={() => router.push("/settings")} />
          </View>

          {/* ── Counts ────────────────────────────────────────────────────── */}
          <View style={s.tiles}>
            <TouchableOpacity style={s.tile} activeOpacity={0.8} onPress={() => router.push("/orders")}>
              <Display1>{active || orders.length}</Display1>
              <Mono color={C.textMuted} style={{ marginTop: 6 }}>
                {active ? "ON THE WAY" : "ORDERS"}
              </Mono>
            </TouchableOpacity>
            <View style={s.tileRule} />
            <TouchableOpacity style={s.tile} activeOpacity={0.8} onPress={() => router.push("/saved")}>
              <Display1>{wishlistCount}</Display1>
              <Mono color={C.textMuted} style={{ marginTop: 6 }}>
                SAVED
              </Mono>
            </TouchableOpacity>
          </View>
          <Rule weight="ink" />

          {/* ── Primary ──────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Eyebrow>Your things</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <NavRow icon="receipt_long" label="Orders" value={String(orders.length)} onPress={() => router.push("/orders")} />
            <NavRow icon="favorite" label="Saved" value={String(wishlistCount)} onPress={() => router.push("/saved")} />
            <NavRow icon="draw" label="The studio" onPress={() => router.push("/(tabs)/design")} />
            <NavRow icon="notifications" label="Notifications" onPress={() => router.push("/notifications")} last />
          </View>

          {/* ── Read ─────────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Eyebrow>Read</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <NavRow icon="menu_book" label="The journal" onPress={() => router.push("/journal")} />
            <NavRow icon="landscape" label="Our story" onPress={() => router.push("/about")} />
            <NavRow icon="eco" label="Sustainability" onPress={() => router.push("/sustainability")} />
            <NavRow icon="grid_view" label="Collections" onPress={() => router.push("/collections")} last />
          </View>

          {/* ── Quiet ────────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Eyebrow>Support</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <NavRow icon="help" label="Help & returns" onPress={() => haptics.select()} />
            <NavRow icon="settings" label="Settings" onPress={() => router.push("/settings")} />
            <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={handleSignOut}>
              <Icon name="logout" size={20} color={C.danger} />
              <Text style={[s.rowLabel, { color: C.danger }]}>{signingOut ? "Signing out…" : "Sign out"}</Text>
            </TouchableOpacity>
            <Rule weight="soft" />
          </View>

          <View style={{ marginTop: S.block, gap: 5 }}>
            <Mono color={C.textFaint}>DEWDROPZ · {SITE.coords}</Mono>
            <Mono color={C.textFaint}>{SITE.email.toUpperCase()}</Mono>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function NavRow({
  icon,
  label,
  value,
  last,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  last?: boolean;
  onPress?: () => void;
}) {
  return (
    <>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
        <Icon name={icon} size={20} color={C.textMid} />
        <Title style={{ flex: 1 }}>{label}</Title>
        {value ? <Mono color={C.textMuted}>{value}</Mono> : null}
        <Icon name="chevron_right" size={19} color={C.faintIcon} />
      </TouchableOpacity>
      {last ? <Rule weight="soft" /> : <Rule weight="hair" />}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  idRow: { flexDirection: "row", alignItems: "flex-start", gap: S.md },
  tiles: { flexDirection: "row", alignItems: "stretch", marginTop: S.block },
  tile: { flex: 1, paddingBottom: S.lg },
  tileRule: { width: 1, backgroundColor: C.ruleSoft, marginHorizontal: S.lg },
  row: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  rowLabel: { flex: 1, fontFamily: F.bodyBold, fontSize: 16, letterSpacing: -0.1 },
});
