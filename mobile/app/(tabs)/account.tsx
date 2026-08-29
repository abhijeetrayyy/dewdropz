import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { useWishlistStore } from "@/stores/wishlist";
import { useCartStore } from "@/stores/cart";
import { useOrdersQuery } from "@/lib/queries";
import { Button } from "@/components/Button";
import { StatusCap } from "@/components/ui/StatusCap";
import { useTabBarSpace } from "@/components/TabBar";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Rule } from "@/components/editorial/Rule";
import { Topography } from "@/components/editorial/Topography";
import { Body, Display1, Eyebrow, Mono, Title } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { contactSupport } from "@/lib/support";
import { toast } from "@/components/ui/Toast";
import { SITE } from "@/lib/editorial";
import { C, F, R, S } from "@/lib/theme";

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
  const tabSpace = useTabBarSpace();
  const { user, signOut } = useAuthStore();
  const wishlistCount = useWishlistStore((st) => st.count());
  const packCount = useCartStore((st) => st.itemCount());
  const { width: SCREEN_W } = useWindowDimensions();
  const { data: orders = [] } = useOrdersQuery(user?.id);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      // No StatusCap here: the signed-out state has no ink panel, so an ink
      // band under the clock would be a floating black strip on cream.
      <View style={s.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: S.section + tabSpace }}>
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
              <NavRow icon="explore" label="Trail guide" tint="ink" onPress={() => router.push("/trails")} />
              <NavRow icon="menu_book" label="The journal" tint="ink" onPress={() => router.push("/journal")} />
              <NavRow icon="landscape" label="Our story" tint="ink" onPress={() => router.push("/about")} />
              <NavRow icon="eco" label="Sustainability" tint="ink" onPress={() => router.push("/sustainability")} last />
            </View>

            {/* The only route to Settings — and therefore to the privacy policy
                — used to sit in the signed-in branch below. Settings itself
                already renders a signed-out state with that link in it, so the
                policy was reachable in code and unreachable in the app: both
                stores require it of someone who has not made an account, which
                is exactly the person deciding whether to. */}
            <View style={{ marginTop: S.section }}>
              <Eyebrow>Privacy &amp; app</Eyebrow>
              <Rule weight="ink" style={{ marginTop: 9 }} />
              <NavRow icon="settings" label="Settings" tint="altitude" onPress={() => router.push("/settings")} last />
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
      <StatusCap />
      <ScrollView contentContainerStyle={{ paddingBottom: S.section + tabSpace }} showsVerticalScrollIndicator={false}>
        {/* ── Identity ──────────────────────────────────────────────────────
            An ink panel matching every pushed screen's header, so You reads as
            part of the same app rather than a settings list on cream. The
            counts are inside it and TAPPABLE — they were the two figures a
            returning customer opens this tab for, previously rendered as flat
            text below the fold of the identity block. ─────────────────────── */}
        <View style={[s.panel, { paddingTop: insets.top + 10 }]}>
          <Topography
            width={SCREEN_W}
            height={320}
            color={C.sage}
            opacity={0.13}
            lines={9}
            seed={2.7}
            originX={0.85}
            originY={0.25}
          />

          <View style={{ paddingHorizontal: S.gutter }}>
            <View style={s.idRow}>
              <View style={s.avatar}>
                <Text style={s.avatarT}>{name.trim().charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.hello}>Signed in</Text>
                <Text style={s.name} numberOfLines={2}>
                  {name}
                </Text>
              </View>
              <IconButton
                name="settings"
                tone="glass"
                accessibilityLabel="Settings"
                onPress={() => router.push("/settings")}
              />
            </View>

            {user.email ? (
              <Text style={s.email} numberOfLines={1}>
                {user.email.toUpperCase()}
              </Text>
            ) : null}

            <View style={s.tiles}>
              <TouchableOpacity
                style={s.tile}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${active || orders.length} ${active ? "orders on the way" : "orders"}`}
                onPress={() => router.push("/orders")}
              >
                <Text style={s.tileV}>{active || orders.length}</Text>
                <Text style={s.tileL}>{active ? "ON THE WAY" : "ORDERS"}</Text>
              </TouchableOpacity>
              <View style={s.tileRule} />
              <TouchableOpacity
                style={s.tile}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${wishlistCount} saved pieces`}
                onPress={() => router.push("/saved")}
              >
                <Text style={s.tileV}>{wishlistCount}</Text>
                <Text style={s.tileL}>SAVED</Text>
              </TouchableOpacity>
              <View style={s.tileRule} />
              <TouchableOpacity
                style={s.tile}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${packCount} pieces in your pack`}
                onPress={() => router.push("/(tabs)/cart")}
              >
                <Text style={s.tileV}>{packCount}</Text>
                <Text style={s.tileL}>IN PACK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: S.gutter }}>

          {/* ── Primary ──────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Eyebrow>Your things</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <NavRow icon="receipt_long" label="Orders" tint="warm" value={String(orders.length)} onPress={() => router.push("/orders")} />
            {/* The address book. It had no entry point anywhere in the app —
                addresses could only be created as a side effect of checking
                out, and never seen, defaulted or removed. */}
            <NavRow icon="camping" label="Your rentals" tint="warm" onPress={() => router.push("/rent/bookings")} />
            <NavRow icon="location_on" label="Addresses" tint="warm" onPress={() => router.push("/addresses")} />
            <NavRow icon="favorite" label="Saved" tint="warm" value={String(wishlistCount)} onPress={() => router.push("/saved")} />
            <NavRow icon="draw" label="The studio" tint="forest" onPress={() => router.push("/(tabs)/design")} />
            {/* What you have already made — unreachable until now. */}
            <NavRow icon="palette" label="Your designs" tint="warm" onPress={() => router.push("/designs")} />
            <NavRow icon="notifications" label="Notifications" tint="altitude" onPress={() => router.push("/notifications")} last />
          </View>

          {/* ── Read ─────────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Eyebrow>Read</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <NavRow icon="explore" label="Trail guide" tint="ink" onPress={() => router.push("/trails")} />
            <NavRow icon="menu_book" label="The journal" tint="ink" onPress={() => router.push("/journal")} />
            <NavRow icon="landscape" label="Our story" tint="ink" onPress={() => router.push("/about")} />
            <NavRow icon="eco" label="Sustainability" tint="ink" onPress={() => router.push("/sustainability")} />
            <NavRow icon="grid_view" label="Collections" tint="ink" onPress={() => router.push("/collections")} last />
          </View>

          {/* ── Quiet ────────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Eyebrow>Support</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <NavRow
              icon="help"
              label="Help & returns"
              onPress={() => contactSupport("Help & returns")}
            />
            <NavRow icon="settings" label="Settings" tint="altitude" onPress={() => router.push("/settings")} />
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

/**
 * A row in the account list.
 *
 * `tint` is not decoration. This is the longest list in the app — eleven rows
 * of identical grey glyph on cream — and it was the single dullest surface we
 * had. The chip colours match the four header families, so the colour a row
 * carries here is the colour of the screen it opens: warm for your own things,
 * forest for the studio and the locker, altitude for system, ink for reading.
 * By the second visit that is navigation, not ornament.
 */
type RowTint = "warm" | "forest" | "altitude" | "ink";

const ROW_TINT: Record<RowTint, { bg: string; fg: string }> = {
  warm: { bg: C.clay12, fg: C.clayDeep },
  forest: { bg: C.forest12, fg: C.forestDeep },
  altitude: { bg: "rgba(20,37,54,0.10)", fg: C.altitude },
  // A cream chip on a cream page is not a chip. These rows open the ink-headed
  // editorial screens, so the chip carries that ground: dark disc, paper glyph.
  ink: { bg: C.ink, fg: C.paper },
};

function NavRow({
  icon,
  label,
  value,
  last,
  onPress,
  tint = "ink",
}: {
  icon: string;
  label: string;
  value?: string;
  last?: boolean;
  onPress?: () => void;
  tint?: RowTint;
}) {
  const t = ROW_TINT[tint];
  return (
    <>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
        <View style={[s.rowIcon, { backgroundColor: t.bg }]}>
          <Icon name={icon} size={17} color={t.fg} />
        </View>
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
  panel: {
    backgroundColor: C.ink,
    overflow: "hidden",
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingTop: S.sm },
  avatar: {
    width: 52, height: 52, borderRadius: 999,
    backgroundColor: C.sage, alignItems: "center", justifyContent: "center",
  },
  avatarT: { fontFamily: F.display, fontSize: 24, color: C.ink },
  hello: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.9, color: C.sage },
  name: { fontFamily: F.display, fontSize: 29, lineHeight: 33, color: C.paper, marginTop: 5 },
  email: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: "rgba(251,247,239,0.45)", marginTop: S.md },
  tiles: { flexDirection: "row", alignItems: "stretch", marginTop: S.lg },
  tile: { flex: 1 },
  tileV: { fontFamily: F.display, fontSize: 30, lineHeight: 34, color: C.paper },
  tileL: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, color: "rgba(251,247,239,0.5)", marginTop: 4 },
  tileRule: { width: 1, backgroundColor: "rgba(251,247,239,0.14)", marginHorizontal: S.md },
  row: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  rowIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, fontFamily: F.bodyBold, fontSize: 16, letterSpacing: -0.1 },
});
