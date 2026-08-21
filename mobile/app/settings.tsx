import { useEffect, useState } from "react";
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
import { contactSupport, openWebPage } from "@/lib/support";
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
  const { user, deleteAccount } = useAuthStore();
  const [deleting, setDeleting] = useState(false);
  const { data: prefs, isLoading } = useNotificationPreferencesQuery(user?.id);
  const updatePrefs = useUpdateNotificationPreferencesMutation(user?.id);

  function setPref(key: "order_updates" | "promotions" | "back_in_stock", value: boolean) {
    if (!prefs) return;
    updatePrefs.mutate({ ...prefs, [key]: value });
  }

  // DELETION HAPPENS, RATHER THAN BEING REQUESTED.
  //
  // This used to open an email asking somebody to do it by hand "within 30
  // days". Apple 5.1.1(v) requires an app that creates accounts to delete them
  // FROM the app and names a support address as the thing that does not count —
  // it is a documented rejection. It was also a promise the app could not keep:
  // pressing it deleted nothing.
  //
  // Two taps, on purpose. The first Alert is the warning; the second is the
  // commitment. This is the only irreversible action in the app.
  function requestDeletion() {
    haptics.warning();
    Alert.alert(
      "Delete your account?",
      "This permanently removes your saved gear, addresses and designs. Orders you have already placed are kept as records of the sale — we are required to keep them — but they will no longer be linked to an account you can sign into.",
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: confirmDeletion },
      ],
    );
  }

  function confirmDeletion() {
    Alert.alert(
      "This cannot be undone",
      `The account for ${user?.email ?? "this address"} will be deleted straight away.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete my account",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const r = await deleteAccount();
            setDeleting(false);
            if (r.error) {
              haptics.error();
              Alert.alert("Could not delete your account", r.error);
              return;
            }
            haptics.success();
            // The session is already cleared by the store; leaving the settings
            // screen of an account that no longer exists is the last step.
            router.replace("/(tabs)");
          },
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

            {/* THE PRIVACY POLICY BELONGS ON THIS SIDE OF THE GATE TOO.
                A first draft put it only in the signed-in branch, which is
                exactly backwards: the moment somebody most wants to read how an
                app treats their data is BEFORE they hand any of it over. This
                screen returns early for a signed-out visitor, so the link has
                to be repeated here rather than living once further down. */}
            <Group eyebrow="Legal">
              <LinkRow
                icon="shield"
                label="Privacy policy"
                onPress={() => openWebPage("/privacy")}
                last
              />
            </Group>
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
          <Group eyebrow="Email & inbox">
            {isLoading || !prefs ? (
              <View style={{ gap: S.md, paddingVertical: S.md }}>
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </View>
            ) : (
              <>
                {/* THESE CONTROL EMAIL AND THE IN-APP INBOX, AND NOW SAY SO.
                    The app has no push capability at all — `expo-notifications`
                    is not a dependency and no device token is ever registered —
                    but three rows labelled "Order updates · Packed, shipped,
                    delivered" on a phone read as a promise of a notification
                    that can never arrive. The preferences themselves are real:
                    the web reads the same `notification_preferences` when it
                    decides whether to send an email, and the inbox on this
                    device is fed from `trek_notifications`.

                    So the fix is to describe what they actually do rather than
                    to imply a channel that does not exist. Push is a project —
                    APNs and FCM credentials, a token table, a sender — not a
                    label change, and shipping the label without the channel was
                    the dishonest half. */}
                <ToggleRow
                  icon="local_shipping"
                  label="Order updates"
                  sub="Emailed to you · packed, shipped, delivered"
                  value={prefs.order_updates}
                  onChange={(v) => setPref("order_updates", v)}
                />
                <ToggleRow
                  icon="local_offer"
                  label="Promotions & offers"
                  sub="Emailed to you · sales, coupons, new drops"
                  value={prefs.promotions}
                  onChange={(v) => setPref("promotions", v)}
                />
                <ToggleRow
                  icon="inventory_2"
                  label="Back in stock"
                  sub="Emailed to you · when something you saved returns"
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

          {/* LEGAL, AND IT WAS NOT HERE AT ALL.
              The app had no privacy policy link anywhere — not in Settings, not
              on the account tab, not at signup. Both stores require one to be
              reachable, and Apple expects it from inside an app that holds an
              account. `/privacy` has existed on the storefront the whole time;
              nothing pointed at it.

              Opened in an in-app browser rather than kicked out to Safari:
              somebody reading a privacy policy is deciding whether to trust the
              app they are currently standing in.

              There is deliberately no "Terms of service" row. The storefront has
              no such page, and a row that opens a 404 is worse than an absent
              one — when `/terms` exists, add it here. */}
          <Group eyebrow="Legal">
            <LinkRow
              icon="shield"
              label="Privacy policy"
              onPress={() => openWebPage("/privacy")}
              last
            />
          </Group>

          <Group eyebrow="Account">
            <LinkRow
              icon="mail"
              label="Contact us"
              onPress={() => contactSupport("Hello from the DewDropz app")}
            />
            <TouchableOpacity
              style={s.row}
              activeOpacity={0.7}
              disabled={deleting}
              onPress={requestDeletion}
              accessibilityRole="button"
              accessibilityLabel="Delete your account"
            >
              <Icon name="delete" size={20} color={C.danger} />
              <Text style={[s.rowLabel, { color: C.danger }]}>
                {deleting ? "Deleting…" : "Delete account"}
              </Text>
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
