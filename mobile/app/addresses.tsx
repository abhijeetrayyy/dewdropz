import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { useAddressesQuery, useDeleteAddressMutation, useSetDefaultAddressMutation } from "@/lib/queries";
import { StatusCap } from "@/components/ui/StatusCap";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Body, Mono, Title } from "@/components/ui/Type";
import { usePullToRefresh } from "@/lib/hooks";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

// The address book, which did not exist.
//
// Addresses could only ever be CREATED, and only as a side effect of checking
// out — and the checkout endpoint wrote a new row on every order even when the
// shopper had just picked a saved one. So the list grew by one identical
// duplicate per order, and there was no screen anywhere in the app that could
// delete any of them. A customer who ordered five times chose between five
// copies of their own house.
//
// The duplication is fixed at its source (the checkout route reuses the picked
// row). This screen is the other half: somewhere to see what is stored, make
// one the default, and remove the ones that should not be there.
//
// ADDING still happens at checkout, where the form already lives and where a
// person is actually thinking about where a parcel should go. A second address
// form here would be a second thing to keep in step with it.
export default function AddressesScreen() {
  const { user } = useAuthStore();
  const { data: addresses = [], isLoading, refetch } = useAddressesQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const del = useDeleteAddressMutation(user?.id);
  const setDefault = useSetDefaultAddressMutation(user?.id);
  const [busyId, setBusyId] = useState<string | null>(null);

  function confirmDelete(id: string, label: string) {
    haptics.warning();
    Alert.alert(
      "Remove this address?",
      `${label}\n\nOrders already placed to it are unaffected — they keep their own copy of where they went.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusyId(id);
            try {
              await del.mutateAsync(id);
              haptics.success();
              toast.show("Address removed");
            } catch {
              haptics.error();
              toast.error("Could not remove that address.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    try {
      await setDefault.mutateAsync(id);
      haptics.success();
      toast.show("Default address updated");
    } catch {
      haptics.error();
      toast.error("Could not update the default.");
    } finally {
      setBusyId(null);
    }
  }

  if (!user) {
    return (
      <View style={s.root}>
        <StatusCap />
        <ScrollView contentContainerStyle={s.pad}>
          <ScreenHeader eyebrow="Delivery" title="Your addresses" />
          <EmptyState
            icon="location_on"
            title="Sign in to see your addresses."
            body="Addresses are saved to your account so you do not have to type one twice."
            ctaLabel="Sign in"
            onPress={() => router.push("/auth/login")}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusCap />
      <ScrollView
        contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Delivery" title="Your addresses" />

        {!isLoading && addresses.length === 0 ? (
          <EmptyState
            icon="location_on"
            title="No addresses saved yet."
            body="The address you enter at checkout is kept here, so the next order takes one tap."
            ctaLabel="See the shop"
            onPress={() => router.push("/(tabs)/shop")}
          />
        ) : (
          <View style={{ marginTop: S.xl }}>
            {addresses.map((a, i) => {
              const busy = busyId === a.id;
              const label = [a.address_line1, a.city, a.postal_code].filter(Boolean).join(", ");
              return (
                <Animated.View key={a.id} entering={FadeInDown.delay(i * 40).duration(260)}>
                  <View style={[s.card, busy && { opacity: 0.5 }]}>
                    <View style={s.cardTop}>
                      <Title style={{ flex: 1 }}>{a.full_name}</Title>
                      {a.is_default ? (
                        <View style={s.tag}>
                          <Mono style={s.tagT}>DEFAULT</Mono>
                        </View>
                      ) : null}
                    </View>

                    <Body color={C.textMid} style={{ marginTop: 4 }}>
                      {[a.address_line1, a.address_line2, a.city, a.state, a.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </Body>
                    <Mono color={C.textMuted} style={{ marginTop: 6 }}>
                      {a.phone}
                    </Mono>

                    <View style={s.actions}>
                      {!a.is_default ? (
                        <TouchableOpacity
                          style={s.act}
                          disabled={busy}
                          onPress={() => makeDefault(a.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Make ${label} the default address`}
                        >
                          <Icon name="check_circle" size={17} color={C.forest} />
                          <Body color={C.forest}>Make default</Body>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                      <TouchableOpacity
                        style={s.act}
                        disabled={busy}
                        onPress={() => confirmDelete(a.id, label)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${label}`}
                      >
                        <Icon name="delete" size={17} color={C.danger} />
                        <Body color={C.danger}>Remove</Body>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Rule weight="soft" />
                </Animated.View>
              );
            })}

            <Body color={C.textMuted} style={{ marginTop: S.lg }}>
              A new address is saved automatically when you use it at checkout.
            </Body>
          </View>
        )}

        <Button
          title="Back"
          variant="link"
          onPress={() => router.back()}
          style={{ marginTop: S.block, alignSelf: "flex-start" }}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  pad: { paddingHorizontal: S.gutter, paddingBottom: 120 },
  card: { paddingVertical: S.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  tag: { backgroundColor: C.forest12, borderRadius: R.tag, paddingHorizontal: 6, paddingVertical: 2 },
  tagT: { fontFamily: F.monoBold, fontSize: 8, letterSpacing: 1, color: C.forestDeep },
  actions: { flexDirection: "row", alignItems: "center", gap: S.lg, marginTop: S.md },
  act: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
});
