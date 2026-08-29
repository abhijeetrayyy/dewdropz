import { useState } from "react";
import { Alert, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { goBack } from "@/lib/nav";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { useAddressesQuery, useDeleteAddressMutation, useSetDefaultAddressMutation } from "@/lib/queries";
import { StatusCap } from "@/components/ui/StatusCap";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
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
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
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
        <StatusCap tone="warm" />
        <ScreenHeader
        tone="warm" eyebrow="Delivery" title="Your addresses"
          scrollY={scrollY}
        />

        <Animated.ScrollView contentContainerStyle={s.pad} ref={scrollRef}>
          <EmptyState
              tone="warm"
            icon="location_on"
            title="Sign in to see your addresses."
            body="Addresses are saved to your account so you do not have to type one twice."
            ctaLabel="Sign in"
            onPress={() => router.push("/auth/login")}
          />
        </Animated.ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusCap tone="warm" />
      <ScreenHeader
        eyebrow="Delivery"
        title="Your addresses"
        tone="warm"
        scrollY={scrollY}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.forest} />}
        showsVerticalScrollIndicator={false}
      >

        {!isLoading && addresses.length === 0 ? (
          <EmptyState
              tone="warm"
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
                  <View style={[s.card, a.is_default && s.cardDefault, busy && { opacity: 0.5 }]}>
                    <View style={s.cardTop}>
                      {/* The pin does real work here: it tells a scanning eye
                          which block is an address before any of it is read. */}
                      <View style={[s.pin, a.is_default && s.pinDefault]}>
                        <Icon
                          name={a.is_default ? "home_pin" : "location_on"}
                          size={16}
                          color={a.is_default ? C.paper : C.clayDeep}
                        />
                      </View>
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
                </Animated.View>
              );
            })}

            <View style={s.note}>
              <Icon name="info" size={16} color={C.clayDeep} />
              <Body color={C.textMid} style={{ flex: 1, lineHeight: 21 }}>
                A new address is saved automatically when you use it at checkout — there is
                nothing to fill in here.
              </Body>
            </View>
          </View>
        )}

        <Button
          title="Back"
          variant="link"
          onPress={() => goBack("/(tabs)/account")}
          style={{ marginTop: S.block, alignSelf: "flex-start" }}
        />
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  pad: { paddingHorizontal: S.gutter, paddingBottom: 120 },
  // An address was a block of text with vertical padding and a hairline under
  // it, which is why this screen read as a paragraph rather than a list of
  // things you can act on. It is now a card, and the default one carries a
  // forest edge so which address gets used is answerable at a glance.
  card: {
    backgroundColor: C.cream,
    borderRadius: R.panel,
    padding: S.md,
    marginBottom: S.md,
  },
  cardDefault: {
    backgroundColor: C.forest12,
    borderLeftWidth: 3,
    borderLeftColor: C.forest,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  pin: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.clay12,
  },
  pinDefault: { backgroundColor: C.forest },
  tag: { backgroundColor: C.forest, borderRadius: R.tag, paddingHorizontal: 6, paddingVertical: 3 },
  tagT: { fontFamily: F.monoBold, fontSize: 8, letterSpacing: 1, color: C.paper },
  actions: {
    flexDirection: "row", alignItems: "center", gap: S.lg,
    marginTop: S.md, paddingTop: S.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(16,21,18,0.12)",
  },
  note: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: C.clay12, borderRadius: R.panel, padding: S.md, marginTop: S.md,
  },
  act: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
});
