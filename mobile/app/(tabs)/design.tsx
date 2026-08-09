import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useCustomizableProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { resolveAssetUrl } from "@/lib/customize/assetUrl";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { IndexList } from "@/components/editorial/IndexList";
import { Body, Display1, Display3, Eyebrow, Lede, Mono, Numeric } from "@/components/ui/Type";
import { C, F, R, S } from "@/lib/theme";

const STEPS = [
  { title: "Pick your blank", body: "Choose the garment, the colourway and the size. Every blank is heavyweight cotton in an oversized unisex fit." },
  { title: "Place your artwork", body: "Upload an image or set some type. Front, back, or both — the print area is marked on the garment as you work." },
  { title: "See it before you buy", body: "The preview is the real mockup, on the real colourway. What you approve is what goes to the press." },
];

const SPECS = [
  { k: "Fabric", v: "240gsm combed cotton" },
  { k: "Fit", v: "Oversized unisex" },
  { k: "Print", v: "DTG, front & back" },
  { k: "Turnaround", v: "5–7 working days" },
];

// The Studio tab. This is the store's actual differentiator, and v4 gave it a
// bullet list of three icons and a stack of 320px-tall cards — the least
// confident presentation of the most important thing.
//
// v5 opens it like a feature spread: a full-width statement, the process as a
// numbered index, the blanks as a proper catalogue with swatches and price,
// and a spec table so the "is this actually good cotton?" question is answered
// before it's asked.
export default function DesignTabScreen() {
  const insets = useSafeAreaInsets();
  const { data: products = [], isLoading, isError, refetch } = useCustomizableProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: S.block }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        {/* ── Statement ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: S.gutter }}>
          <Eyebrow>The workbench</Eyebrow>
          <Display1 style={{ marginTop: 8 }}>Design{"\n"}your own.</Display1>
          <Lede style={{ marginTop: 12 }}>
            We print in-house in Dehradun, one garment at a time. No minimums, no setup fee, and nothing gets made until
            you&apos;ve seen exactly how it will look.
          </Lede>
          <Rule weight="ink" style={{ marginTop: S.xl }} />
          <View style={s.specRow}>
            {SPECS.map((spec) => (
              <View key={spec.k} style={s.specCell}>
                <Mono color={C.textMuted}>{spec.k.toUpperCase()}</Mono>
                <Body style={{ marginTop: 4 }}>{spec.v}</Body>
              </View>
            ))}
          </View>
          <Rule weight="soft" />
        </View>

        {/* ── The blanks ─────────────────────────────────────────────────── */}
        <View style={{ paddingTop: S.section }}>
          <SectionHead
            index="01"
            eyebrow="The blanks"
            title="Start with a good garment."
            lede="Three bases, printed to order. Tap one to open the studio."
            style={{ paddingHorizontal: S.gutter }}
          />

          <View style={{ paddingHorizontal: S.gutter, marginTop: S.xl }}>
            {isError ? (
              <ErrorState message="Couldn't load the blanks." onRetry={() => refetch()} />
            ) : isLoading ? (
              <SkeletonProductGrid count={2} />
            ) : products.length === 0 ? (
              <EmptyState
                eyebrow="Not yet"
                title="No blanks are set up."
                body="Nothing is configured for printing right now. Check back soon — we're adding bases as the presses free up."
                ctaLabel="Browse ready-made gear"
                ctaHref="/(tabs)/shop"
              />
            ) : (
              <View style={{ gap: S.xl }}>
                {products.map((p, i) => {
                  const colors = p.customization_config?.colors ?? [];
                  const available = colors.filter((c) => c.available);
                  const cover = resolveAssetUrl(available[0]?.front?.mockupImage ?? p.images?.[0]);
                  return (
                    <Animated.View key={p.id} entering={FadeInDown.delay(i * 70).springify().damping(18)}>
                      <TouchableOpacity
                        activeOpacity={0.94}
                        onPress={() => {
                          haptics.tap();
                          router.push(`/customize/${p.slug}`);
                        }}
                      >
                        <View style={s.blankFrame}>
                          {cover ? (
                            <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} alt="" />
                          ) : null}
                          <LinearGradient
                            colors={["transparent", "rgba(12,18,15,0.55)"]}
                            locations={[0.55, 1]}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={s.blankIndex}>
                            <Text style={s.blankIndexT}>{String(i + 1).padStart(2, "0")}</Text>
                          </View>
                          <View style={s.blankFoot}>
                            <View style={{ flex: 1 }}>
                              <Display3 color={C.paper}>{p.name}</Display3>
                              <View style={s.swatchRow}>
                                {colors.map((c) => (
                                  <View
                                    key={c.name}
                                    style={[s.dot, { backgroundColor: c.hex }, !c.available && s.dotOff]}
                                  />
                                ))}
                                <Mono color="rgba(255,255,255,0.75)" style={{ marginLeft: 5 }}>
                                  {available.length} COLOURWAY{available.length === 1 ? "" : "S"}
                                </Mono>
                              </View>
                            </View>
                            <View style={s.blankGo}>
                              <Icon name="arrow_forward" size={20} color={C.ink} />
                            </View>
                          </View>
                        </View>

                        <View style={s.blankMeta}>
                          <Body color={C.textMid} numberOfLines={2} style={{ flex: 1 }}>
                            {p.short_description ?? "Heavyweight cotton, oversized unisex fit, printed front and back."}
                          </Body>
                          <Numeric>{formatPrice(p.price)}</Numeric>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── How it works ───────────────────────────────────────────────── */}
        <View style={s.band}>
          <SectionHead
            index="02"
            eyebrow="How it works"
            title="Three steps, no surprises."
            style={{ paddingHorizontal: S.gutter }}
          />
          <IndexList items={STEPS} style={{ paddingHorizontal: S.gutter, marginTop: S.md }} />
        </View>

        {/* ── Fine print ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.section }}>
          <SectionHead index="03" eyebrow="Before you start" title="What we can and can't print." size="d3" />
          <Body color={C.textMid} style={{ marginTop: S.md }}>
            Bring a PNG or JPG at roughly 2000px on the long edge and it will print sharp. We can&apos;t print
            third-party logos or licensed characters, and we&apos;ll email you rather than guess if artwork arrives too
            small to hold up on fabric.
          </Body>
          <Mono color={C.textFaint} style={{ marginTop: S.lg }}>
            CUSTOM PIECES ARE MADE TO ORDER · NOT ELIGIBLE FOR RETURN UNLESS FAULTY
          </Mono>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },

  specRow: { flexDirection: "row", flexWrap: "wrap", paddingVertical: S.md },
  specCell: { width: "50%", paddingVertical: 10, paddingRight: S.md },

  blankFrame: { width: "100%", aspectRatio: 3 / 4, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand, justifyContent: "flex-end" },
  blankIndex: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(12,18,15,0.55)", borderRadius: R.tag, paddingHorizontal: 7, paddingVertical: 3 },
  blankIndexT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },
  blankFoot: { flexDirection: "row", alignItems: "flex-end", gap: S.md, padding: S.md },
  blankGo: { width: 40, height: 40, borderRadius: 999, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 9 },
  dot: { width: 13, height: 13, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  dotOff: { opacity: 0.3 },
  blankMeta: { flexDirection: "row", alignItems: "flex-start", gap: S.md, marginTop: S.sm },

  band: { backgroundColor: C.paperDeep, marginTop: S.section, paddingTop: S.block, paddingBottom: S.block },
});
