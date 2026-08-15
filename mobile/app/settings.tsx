import { useEffect } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Body, Eyebrow, Mono, Title } from "@/components/ui/Type";
import { useAuthStore } from "@/stores/auth";
import { useNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } from "@/lib/queries";
import { haptics } from "@/lib/haptics";
import { contactSupport } from "@/lib/support";
import { SITE } from "@/lib/editorial";
import { C, F, M, S } from "@/lib/theme";

// Settings. Same ruled-list grammar as Account, so moving between them doesn't
// feel like moving between two apps. The toggle knob is animated now — v4
// swapped `alignItems` between flex-start and flex-end, which teleported the
// knob with no transition.
//
// The three notification toggles below used to be local useState only —
// flipping them didn't persist anywhere, so they silently reset every time
// the app reopened. They now read from and write to profiles.notification_preferences.
export default function SettingsScreen() {
  const { user } = useAuthStore();
  const { data: prefs, isLoading } = useNotificationPreferencesQuery(user?.id);
  const updatePrefs = useUpdateNotificationPreferencesMutation(user?.id);

  function setPref(key: "order_updates" | "promotions" | "back_in_stock", value: boolean) {
    if (!prefs) return;
    updatePrefs.mutate({ ...prefs, [key]: value });
  }

  // Deleting an account is irreversible and there is no self-serve endpoint for
  // it yet, so this raises a request rather than pretending to do the deletion.
  // It previously called signOut() under a "Delete account" label — the user
  // was told their data was gone when nothing had been deleted at all.
  function requestDeletion() {
    haptics.warning();
    Alert.alert(
      "Delete your account?",
      "This removes your order history, saved gear and addresses for good. We'll open an email so you can confirm the request — deletion is handled within 30 days.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Request deletion",
          style: "destructive",
          onPress: () =>
            contactSupport(
              "Account deletion request",
              `Please delete the DewDropz account for ${user?.email ?? "(this email address)"}.\n\nI understand this permanently removes my order history, saved gear and saved addresses.`,
            ),
        },
      ],
    );
  }

  // Everything on this screen is account-scoped, so a signed-out visitor
  // (deep link, or a sign-out that left them here) used to sit on notification
  // skeletons that never resolved: the preferences query is disabled without a
  // user id, so `prefs` stayed undefined forever.
  if (!user) {
    return (
      <View style={s.root}>
        <StatusCap />
        <ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
          <ScreenHeader eyebrow="Preferences" title="Settings" />
          <View style={{ paddingHorizontal: S.gutter }}>
            <EmptyState
              eyebrow="Signed out"
              icon="settings"
              title="Sign in to change these."
              body="Notification preferences live with your account, so they follow you to every device you sign in on."
              ctaLabel="Sign in"
              ctaHref="/auth/login"
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusCap />
      <ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Preferences" title="Settings" />

        <View style={{ paddingHorizontal: S.gutter }}>
          <Group eyebrow="Notifications">
            {isLoading || !prefs ? (
              <View style={{ gap: S.md, paddingVertical: S.md }}>
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </View>
            ) : (
              <>
                <ToggleRow
                  icon="local_shipping"
                  label="Order updates"
                  sub="Packed, shipped, delivered"
                  value={prefs.order_updates}
                  onChange={(v) => setPref("order_updates", v)}
                />
                <ToggleRow
                  icon="local_offer"
                  label="Promotions & offers"
                  sub="Sales, coupons, new drops"
                  value={prefs.promotions}
                  onChange={(v) => setPref("promotions", v)}
                />
                <ToggleRow
                  icon="inventory_2"
                  label="Back in stock"
                  sub="When something you saved returns"
                  value={prefs.back_in_stock}
                  onChange={(v) => setPref("back_in_stock", v)}
                  last
                />
              </>
            )}
          </Group>

          {/* A "Units / Language / Appearance" group used to sit here showing
              Metric / English / Daylight behind chevrons that opened nothing —
              three settings the app has no second option for. They come back
              when there is something to switch to. */}

          <Group eyebrow="About">
            <LinkRow icon="landscape" label="Our story" onPress={() => router.push("/about")} />
            <LinkRow icon="eco" label="Sustainability" onPress={() => router.push("/sustainability")} />
            <LinkRow icon="menu_book" label="The journal" onPress={() => router.push("/journal")} last />
          </Group>

          <Group eyebrow="Account">
            <LinkRow
              icon="mail"
              label="Contact us"
              onPress={() => contactSupport("Hello from the DewDropz app")}
            />
            <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={requestDeletion}>
              <Icon name="delete" size={20} color={C.danger} />
              <Text style={[s.rowLabel, { color: C.danger }]}>Delete account</Text>
            </TouchableOpacity>
            <Rule weight="soft" />
          </Group>

          <View style={{ marginTop: S.block, gap: 5 }}>
            <Mono color={C.textFaint}>DEWDROPZ 1.0.0</Mono>
            <Mono color={C.textFaint}>MADE IN DEHRADUN · {SITE.coords}</Mono>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Group({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: S.block }}>
      <Eyebrow color={C.textMuted}>{eyebrow}</Eyebrow>
      <Rule weight="ink" style={{ marginTop: 9 }} />
      {children}
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const x = useSharedValue(value ? 20 : 0);
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  // The knob has to follow `value` and not just the tap that set it: a failed
  // write to profiles.notification_preferences reverts the query cache, and
  // without this the switch would sit in the position the user chose while the
  // saved preference said the opposite.
  useEffect(() => {
    x.value = withTiming(value ? 20 : 0, { duration: M.fast });
  }, [value, x]);

  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        haptics.select();
        onChange(!value);
      }}
      style={[s.toggle, value && s.toggleOn]}
    >
      <Animated.View style={[s.knob, knobStyle]} />
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
  last,
}: {
  icon: string;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <>
      <View style={s.row}>
        <Icon name={icon} size={20} color={C.textMid} />
        <View style={{ flex: 1 }}>
          <Title>{label}</Title>
          <Body color={C.textMuted} style={{ marginTop: 2 }}>
            {sub}
          </Body>
        </View>
        <Toggle value={value} onChange={onChange} />
      </View>
      {last ? <Rule weight="soft" /> : <Rule weight="hair" />}
    </>
  );
}

// `onPress` is required, not optional. The optional version invited rows that
// rendered a chevron and did nothing but fire a haptic, which is how four of
// them shipped.
function LinkRow({
  icon,
  label,
  last,
  onPress,
}: {
  icon: string;
  label: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <>
      <TouchableOpacity style={s.row} activeOpacity={0.7} accessibilityRole="button" onPress={onPress}>
        <Icon name={icon} size={20} color={C.textMid} />
        <Title style={{ flex: 1 }}>{label}</Title>
        <Icon name="chevron_right" size={19} color={C.faintIcon} />
      </TouchableOpacity>
      {last ? <Rule weight="soft" /> : <Rule weight="hair" />}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  row: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  rowLabel: { flex: 1, fontFamily: F.bodyBold, fontSize: 16, letterSpacing: -0.1 },
  toggle: { width: 46, height: 26, borderRadius: 999, backgroundColor: C.disabledBg, padding: 3, justifyContent: "center" },
  toggleOn: { backgroundColor: C.forest },
  knob: { width: 20, height: 20, borderRadius: 999, backgroundColor: C.white },
});
