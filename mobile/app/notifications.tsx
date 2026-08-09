import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Mono, Title } from "@/components/ui/Type";
import { NOTIFICATIONS } from "@/lib/mockTrekData";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

// Mock data — there's no notifications table yet. The layout matches the rest
// of the app's list grammar so this drops in unchanged once real rows exist.
//
// v4 gave each notification a shadowed white card with a coloured circular
// icon; a stack of those reads as a settings screen. Here the timestamp is
// mono and the rows are ruled, which is what makes a feed of events look like
// a log rather than a menu.
export default function NotificationsScreen() {
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Activity"
          title="Notifications"
          right={
            <TouchableOpacity onPress={() => haptics.select()} hitSlop={10}>
              <Text style={s.markRead}>Mark all read</Text>
            </TouchableOpacity>
          }
        />

        <View style={{ paddingHorizontal: S.gutter }}>
          <Rule weight="ink" />
          {NOTIFICATIONS.map((n, i) => (
            <Animated.View key={n.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).springify().damping(18)}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => haptics.select()}>
                <View style={s.row}>
                  <View style={[s.icon, { backgroundColor: n.iconBg }]}>
                    <Icon name={n.icon} size={17} color={n.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.rowTop}>
                      <Title style={{ flex: 1 }}>{n.title}</Title>
                      {n.accent ? <View style={[s.unread, { backgroundColor: n.accent }]} /> : null}
                    </View>
                    <Body color={C.textMid} style={{ marginTop: 4 }}>
                      {n.body}
                    </Body>
                    <Mono color={C.textFaint} style={{ marginTop: 8 }}>
                      {n.time.toUpperCase()}
                    </Mono>
                  </View>
                </View>
              </TouchableOpacity>
              <Rule weight="soft" />
            </Animated.View>
          ))}

          <TouchableOpacity style={s.footer} activeOpacity={0.7} onPress={() => router.push("/settings")}>
            <Icon name="tune" size={19} color={C.textMuted} />
            <Body color={C.textMid} style={{ flex: 1 }}>
              Order updates and drop alerts can be turned off separately in Settings.
            </Body>
            <Icon name="chevron_right" size={19} color={C.faintIcon} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  markRead: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  row: { flexDirection: "row", gap: S.md, paddingVertical: S.lg },
  icon: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: S.sm },
  unread: { width: 7, height: 7, borderRadius: 999 },
  footer: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.lg, marginTop: S.sm },
});
