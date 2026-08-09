import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Eyebrow, Mono, Title } from "@/components/ui/Type";
import { useAuthStore } from "@/stores/auth";
import { haptics } from "@/lib/haptics";
import { SITE } from "@/lib/editorial";
import { C, F, M, S } from "@/lib/theme";

// Settings. Same ruled-list grammar as Account, so moving between them doesn't
// feel like moving between two apps. The toggle knob is animated now — v4
// swapped `alignItems` between flex-start and flex-end, which teleported the
// knob with no transition.
export default function SettingsScreen() {
  const { signOut } = useAuthStore();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);
  const [drops, setDrops] = useState(false);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="Preferences" title="Settings" />

        <View style={{ paddingHorizontal: S.gutter }}>
          <Group eyebrow="Notifications">
            <ToggleRow
              icon="local_shipping"
              label="Order updates"
              sub="Packed, shipped, delivered"
              value={orderUpdates}
              onChange={setOrderUpdates}
            />
            <ToggleRow
              icon="local_offer"
              label="Promotions & offers"
              sub="Sales, coupons, new drops"
              value={promotions}
              onChange={setPromotions}
            />
            <ToggleRow
              icon="inventory_2"
              label="Back in stock"
              sub="When something you saved returns"
              value={drops}
              onChange={setDrops}
              last
            />
          </Group>

          <Group eyebrow="Preferences">
            <LinkRow icon="straighten" label="Units" value="Metric" />
            <LinkRow icon="translate" label="Language" value="English" />
            <LinkRow icon="light_mode" label="Appearance" value="Daylight" last />
          </Group>

          <Group eyebrow="About">
            <LinkRow icon="landscape" label="Our story" onPress={() => router.push("/about")} />
            <LinkRow icon="eco" label="Sustainability" onPress={() => router.push("/sustainability")} />
            <LinkRow icon="menu_book" label="The journal" onPress={() => router.push("/journal")} last />
          </Group>

          <Group eyebrow="Account">
            <LinkRow icon="shield" label="Privacy" />
            <TouchableOpacity
              style={s.row}
              activeOpacity={0.7}
              onPress={() => {
                haptics.warning();
                signOut();
                router.replace("/(tabs)/account");
              }}
            >
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

  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        haptics.select();
        const next = !value;
        x.value = withTiming(next ? 20 : 0, { duration: M.fast });
        onChange(next);
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

function LinkRow({
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
      <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress ?? (() => haptics.select())}>
        <Icon name={icon} size={20} color={C.textMid} />
        <Title style={{ flex: 1 }}>{label}</Title>
        {value ? <Mono color={C.textMuted}>{value.toUpperCase()}</Mono> : null}
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
