import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { useMyDesignsQuery } from "@/lib/queries";
import { StatusCap } from "@/components/ui/StatusCap";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Body, Mono, Title } from "@/components/ui/Type";
import { usePullToRefresh } from "@/lib/hooks";
import { formatPrice } from "@/lib/utils";
import { MIN_DPI } from "@/lib/customize/printQuality";
import { C, R, S } from "@/lib/theme";

// Everything you have made.
//
// A design was created in the studio, attached to a cart line, and then became
// unreachable — no screen in the app listed them. Somebody who spent ten
// minutes on a shirt, then removed it from the cart, had no way back to it. The
// web has had /account/designs since launch.
//
// It leads with the PREVIEW, because a design is a picture and a row of text
// describing one is useless. The DPI recorded per side at render time (040) is
// shown when it is poor: the studio warns while you are editing, but a design
// made before that warning existed should still be able to tell you.
export default function DesignsScreen() {
  const { user } = useAuthStore();
  const { data: designs = [], isLoading, refetch } = useMyDesignsQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  if (!user) {
    return (
      <View style={s.root}>
        <StatusCap />
        <ScrollView contentContainerStyle={s.pad}>
          <ScreenHeader eyebrow="The studio" title="Your designs" />
          <EmptyState
            eyebrow="Signed out"
            icon="draw"
            title="Sign in to see what you have made."
            body="Designs are saved to your account. Anything made before signing in belongs to nobody and cannot be recovered — so sign in first if you want to keep it."
            ctaLabel="Sign in"
            ctaHref="/auth/login"
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
        <ScreenHeader eyebrow="The studio" title="Your designs" />

        {isLoading ? (
          <View style={{ marginTop: S.xl }}>
            <SkeletonProductGrid />
          </View>
        ) : designs.length === 0 ? (
          <EmptyState
            icon="draw"
            title="Nothing made yet."
            body="Put your own artwork on a heavyweight blank. Nothing is printed until you approve it."
            ctaLabel="Open the studio"
            onPress={() => router.push("/(tabs)/design")}
          />
        ) : (
          <View style={{ marginTop: S.xl }}>
            {designs.map((d, i) => {
              const preview = d.front_preview_url ?? d.back_preview_url;
              const dpis = [d.front_print_dpi, d.back_print_dpi].filter(
                (n): n is number => typeof n === "number"
              );
              const worst = dpis.length ? Math.min(...dpis) : null;
              return (
                <Animated.View key={d.id} entering={FadeInDown.delay(i * 40).duration(260)}>
                  <TouchableOpacity
                    style={s.row}
                    activeOpacity={0.8}
                    disabled={!d.product?.slug}
                    onPress={() => d.product?.slug && router.push(`/customize/${d.product.slug}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Make another like ${d.product?.name ?? "this design"}`}
                  >
                    <View style={s.thumb}>
                      {preview ? (
                        <Image source={{ uri: preview }} style={s.thumbImg} contentFit="cover" transition={200} alt="" />
                      ) : (
                        <Icon name="draw" size={22} color={C.textFaint} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Title numberOfLines={1}>{d.product?.name ?? "A design"}</Title>
                      <Body color={C.textMid} style={{ marginTop: 2 }}>
                        {[d.color_name, d.product ? formatPrice(d.product.price) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Body>
                      <Mono color={C.textMuted} style={{ marginTop: 5 }}>
                        {new Date(d.created_at)
                          .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          .toUpperCase()}
                      </Mono>

                      {/* Only when it is worth saying. A design rendered before
                          040 recorded DPI has null and says nothing, which is
                          honest — the column's own comment is "NULL means the
                          file predates this being recorded". */}
                      {worst !== null && worst < MIN_DPI ? (
                        <View style={s.warn}>
                          <Icon name="error" size={13} color={C.clayDeep} />
                          <Body color={C.clayDeep} style={{ flex: 1 }}>
                            Printed at {worst} DPI — softer than we would like.
                          </Body>
                        </View>
                      ) : null}
                    </View>

                    <Icon name="chevron_right" size={20} color={C.textFaint} />
                  </TouchableOpacity>
                  <Rule weight="soft" />
                </Animated.View>
              );
            })}

            <Body color={C.textMuted} style={{ marginTop: S.lg }}>
              Opening one starts a fresh design on the same blank. The original stays here.
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
  row: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  thumb: {
    width: 62,
    height: 78,
    borderRadius: R.card,
    backgroundColor: C.sand,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: { width: "100%", height: "100%" },
  warn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
});
