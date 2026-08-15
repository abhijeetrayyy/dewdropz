import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Body, Mono, Title } from "@/components/ui/Type";
import { useAuthStore } from "@/stores/auth";
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import type { AppNotification } from "@/lib/data";
import { formatTimeAgo } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

// Real data as of the notifications table (migration 024) — this used to
// render mockTrekData.NOTIFICATIONS unconditionally with no query at all.
//
// Palette tokens, not literals: order updates were tinted #125B45 on #DCEFE5,
// a teal that appears nowhere else in the brand, and the other two inlined the
// hex values of C.textMid and C.cream by hand.
const ICON_BY_TYPE: Record<AppNotification["type"], { icon: string; iconColor: string; iconBg: string }> = {
  order_update: { icon: "local_shipping", iconColor: C.forestDeep, iconBg: C.forest12 },
  promotion: { icon: "local_offer", iconColor: C.textMid, iconBg: C.cream },
  back_in_stock: { icon: "workspace_premium", iconColor: C.clayDeep, iconBg: C.clay12 },
};

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const { data: notifications, isLoading, isError, refetch } = useNotificationsQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const markRead = useMarkNotificationReadMutation(user?.id);
  const markAllRead = useMarkAllNotificationsReadMutation(user?.id);

  // "Mark all read" used to render unconditionally, including on an empty list.
  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  function handlePress(n: AppNotification) {
    haptics.select();
    if (!n.read_at) markRead.mutate(n.id);
    if (n.order_id) router.push(`/orders/${n.order_id}`);
  }

  return (
    <View style={s.root}>
      <StatusCap />
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        <ScreenHeader
          eyebrow="Activity"
          title="Notifications"
          stats={
            notifications && notifications.length > 0
              ? [
                  { label: "Unread", value: String(unreadCount) },
                  { label: "Total", value: String(notifications.length) },
                ]
              : undefined
          }
          right={
            unreadCount > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.select();
                  markAllRead.mutate();
                }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={s.markRead}>Mark all read</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        <View style={{ paddingHorizontal: S.gutter }}>
          {/* The heavy rule that used to sit here separated the list from a flat
              cream header. The ink panel is that separation now, so the rule was
              left floating with nothing above it. */}

          {/* Notifications are per-account, so a signed-out visitor was being
              told "Nothing yet" — a statement about an inbox we hadn't looked
              in, because the query is disabled without a user id. */}
          {!user ? (
            <EmptyState
              eyebrow="Signed out"
              icon="notifications"
              title="Sign in for updates."
              body="Order updates, drop alerts and restock notices are tied to your account."
              ctaLabel="Sign in"
              ctaHref="/auth/login"
            />
          ) : isLoading ? (
            <View style={{ gap: S.lg, paddingTop: S.lg }}>
              <Skeleton height={54} />
              <Skeleton height={54} />
              <Skeleton height={54} />
            </View>
          ) : isError ? (
            <ErrorState message="Couldn't load your notifications." onRetry={() => refetch()} />
          ) : !notifications || notifications.length === 0 ? (
            <View style={s.empty}>
              <Icon name="notifications" size={22} color={C.faintIcon} />
              <Body color={C.textMid} style={{ marginTop: 8 }}>
                Nothing yet — order updates, drop alerts, and restocks will show up here.
              </Body>
            </View>
          ) : (
            notifications.map((n, i) => {
              const meta = ICON_BY_TYPE[n.type];
              return (
                <Animated.View key={n.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(380)}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => handlePress(n)}>
                    <View style={s.row}>
                      <View style={[s.icon, { backgroundColor: meta.iconBg }]}>
                        <Icon name={meta.icon} size={17} color={meta.iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.rowTop}>
                          <Title style={{ flex: 1 }}>{n.title}</Title>
                          {!n.read_at ? <View style={[s.unread, { backgroundColor: C.forest }]} /> : null}
                        </View>
                        {n.body ? (
                          <Body color={C.textMid} style={{ marginTop: 4 }}>
                            {n.body}
                          </Body>
                        ) : null}
                        <Mono color={C.textFaint} style={{ marginTop: 8 }}>
                          {formatTimeAgo(n.created_at).toUpperCase()}
                        </Mono>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <Rule weight="soft" />
                </Animated.View>
              );
            })
          )}

          {user ? (
            <TouchableOpacity
              style={s.footer}
              activeOpacity={0.7}
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
            >
              <Icon name="tune" size={19} color={C.textMuted} />
              <Body color={C.textMid} style={{ flex: 1 }}>
                Order updates and drop alerts can be turned off separately in Settings.
              </Body>
              <Icon name="chevron_right" size={19} color={C.faintIcon} />
            </TouchableOpacity>
          ) : null}
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
  empty: { alignItems: "center", paddingVertical: S.section },
});
