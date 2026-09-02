import { useState } from "react";
import { RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { router } from "expo-router";
import { goBack } from "@/lib/nav";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { useAuthStore } from "@/stores/auth";
import { useMyDesignsQuery } from "@/lib/queries";
import { StatusCap } from "@/components/ui/StatusCap";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Body, Mono, Title } from "@/components/ui/Type";
import { usePullToRefresh } from "@/lib/hooks";
import { formatPrice } from "@/lib/utils";
import { MIN_DPI } from "@/lib/customize/printQuality";
import { C, F, R, S } from "@/lib/theme";

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
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  // How much room the floating header needs at the top of the scroll
  // content. The panel is out of the layout so its collapse cannot resize
  // this list mid-drag — see ScreenHeader. It reports its height here.
  const [headerH, setHeaderH] = useState(0);
  const { user } = useAuthStore();
  const { data: designs = [], isLoading, refetch } = useMyDesignsQuery(user?.id);
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  if (!user) {
    return (
      <View style={s.root}>
        <StatusCap tone="warm" />
        <ScreenHeader
        tone="warm" eyebrow="The studio" title="Your designs"
          scrollY={scrollY}
        onHeight={setHeaderH}
        />

        <Animated.ScrollView contentContainerStyle={[s.pad, { paddingTop: headerH }]} ref={scrollRef}>
          <EmptyState
              tone="warm"
            eyebrow="Signed out"
            icon="draw"
            title="Sign in to see what you have made."
            body="Designs are saved to your account. Anything made before signing in belongs to nobody and cannot be recovered — so sign in first if you want to keep it."
            ctaLabel="Sign in"
            ctaHref="/auth/login"
          />
        </Animated.ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusCap tone="warm" />
      <ScreenHeader
        eyebrow="The studio"
        title="Your designs"
        tone="warm"
        scrollY={scrollY}
        onHeight={setHeaderH}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.pad, { paddingTop: headerH }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerH} tintColor={C.forest} />}
        showsVerticalScrollIndicator={false}
      >

        {isLoading ? (
          <View style={{ marginTop: S.xl }}>
            <SkeletonProductGrid />
          </View>
        ) : designs.length === 0 ? (
          <EmptyState
              tone="warm"
            icon="draw"
            title="Nothing made yet."
            body="Put your own artwork on a heavyweight blank. Nothing is printed until you approve it."
            ctaLabel="Open the studio"
            onPress={() => router.push("/(tabs)/design")}
          />
        ) : (
          <View style={s.grid}>
            {designs.map((d, i) => {
              // `||` — an empty preview column must fall through, not win.
              const preview = d.front_preview_url || d.back_preview_url;
              const dpis = [d.front_print_dpi, d.back_print_dpi].filter(
                (n): n is number => typeof n === "number"
              );
              const worst = dpis.length ? Math.min(...dpis) : null;
              const soft = worst !== null && worst < MIN_DPI;
              return (
                <Animated.View
                  key={d.id}
                  entering={FadeInDown.delay(Math.min(i, 6) * 45).duration(300)}
                  style={s.cell}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!d.product?.slug}
                    onPress={() => d.product?.slug && router.push(`/customize/${d.product.slug}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Make another like ${d.product?.name ?? "this design"}`}
                  >
                    <View style={s.plate}>
                      {preview ? (
                        <Image source={{ uri: preview }} style={s.plateImg} contentFit="cover" transition={200} alt="" />
                      ) : (
                        <Icon name="draw" size={26} color={C.textFaint} />
                      )}

                      {/* Only when it is worth saying. A design rendered before
                          040 recorded DPI has null and says nothing, which is
                          honest — the column's own comment is "NULL means the
                          file predates this being recorded". */}
                      {soft ? (
                        <View style={s.softTag}>
                          <Icon name="error" size={11} color={C.paper} />
                          <Mono style={s.softTagT}>{worst} DPI</Mono>
                        </View>
                      ) : null}
                    </View>

                    <Title numberOfLines={1} style={{ marginTop: 9 }}>
                      {d.product?.name ?? "A design"}
                    </Title>
                    <Body color={C.textMid} style={{ marginTop: 1, fontSize: 13 }} numberOfLines={1}>
                      {[d.color_name, d.product ? formatPrice(d.product.price) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Body>
                    <Mono color={C.textMuted} style={{ marginTop: 4, fontSize: 9 }}>
                      {new Date(d.created_at)
                        .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        .toUpperCase()}
                    </Mono>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}

        {designs.length > 0 ? (
          <View style={s.note}>
            <Icon name="draw" size={16} color={C.forestDeep} />
            <Body color={C.textMid} style={{ flex: 1, lineHeight: 21 }}>
              Opening one starts a fresh design on the same blank. The original stays here.
            </Body>
          </View>
        ) : null}

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
  // A portfolio shown as a text list with 62px thumbnails is not a portfolio.
  // These are the things the customer MADE; two-up plates give them the size to
  // actually be looked at, which is the whole reason the screen exists.
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: S.xl, gap: S.md },
  cell: { width: "47.5%", flexGrow: 1 },
  plate: {
    aspectRatio: 4 / 5,
    borderRadius: R.card,
    backgroundColor: C.sand,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  plateImg: { width: "100%", height: "100%" },
  softTag: {
    position: "absolute", left: 8, bottom: 8,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(138,90,63,0.92)",
    borderRadius: R.pill, paddingHorizontal: 7, paddingVertical: 3,
  },
  softTagT: { fontFamily: F.monoBold, fontSize: 8, letterSpacing: 0.8, color: C.paper },
  note: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: C.forest12, borderRadius: R.panel, padding: S.md, marginTop: S.lg,
  },
});
