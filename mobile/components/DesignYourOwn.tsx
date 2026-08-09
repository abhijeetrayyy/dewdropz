import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCustomizableProductsQuery } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { resolveAssetUrl } from "@/lib/customize/assetUrl";
import { Icon } from "@/components/ui/Icon";
import { Label, Display2, Body } from "@/components/ui/Type";
import { C, F, R, S, SHADOW_CTA } from "@/lib/theme";

// Home showcase for the customizable blanks — the store's real core feature.
// Driven by whatever is actually flagged customizable rather than a
// hardcoded list, so adding a blank in admin surfaces it here for free.
export function DesignYourOwn() {
  const { data: products = [] } = useCustomizableProductsQuery();
  if (products.length === 0) return null;

  return (
    <View style={s.section}>
      <Label>THE WORKBENCH</Label>
      <Display2 style={{ marginTop: 6 }}>Put your own mark on it.</Display2>
      <Body color={C.textMid} style={{ marginTop: 10 }}>
        Heavyweight blanks in an oversized unisex fit. Drop in your artwork or set some type, front and back, and see it
        on the garment before you order.
      </Body>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        {products.map((p, i) => {
          const colors = p.customization_config?.colors ?? [];
          const cover = resolveAssetUrl(colors.find((c) => c.available)?.front?.mockupImage ?? p.images?.[0]);
          return (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 70).springify().damping(18)}>
              <TouchableOpacity
                style={s.card}
                activeOpacity={0.9}
                onPress={() => { haptics.tap(); router.push(`/customize/${p.slug}`); }}
              >
                <View style={s.imgWrap}>
                  {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" alt="" /> : null}
                  <View style={s.tag}>
                    <Text style={s.tagT}>Front &amp; Back</Text>
                  </View>
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.price}>{formatPrice(p.price)}</Text>
                  </View>
                  <View style={s.swatches}>
                    {colors.map((c) => (
                      <View
                        key={c.name}
                        style={[s.dot, { backgroundColor: c.hex }, !c.available && s.dotOff]}
                      />
                    ))}
                    <Text style={s.swatchNote}>
                      {colors.filter((c) => c.available).length} available
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={s.cta}
        activeOpacity={0.9}
        onPress={() => { haptics.tap(); router.push("/(tabs)/design"); }}
      >
        <Icon name="brush" size={18} color={C.white} />
        <Text style={s.ctaT}>Open the studio</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: S.xl, backgroundColor: C.cream, paddingVertical: S.lg },
  rail: { paddingHorizontal: S.md, gap: S.sm, paddingTop: S.lg },
  card: { width: 200, backgroundColor: C.paper, borderRadius: R.card, overflow: "hidden" },
  imgWrap: { height: 250, backgroundColor: C.sand },
  tag: {
    position: "absolute", left: 10, top: 10,
    backgroundColor: "rgba(23,35,29,0.7)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  tagT: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: C.paper },
  cardBody: { padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontFamily: F.bodySemiBold, fontSize: 15, color: C.ink, flex: 1 },
  price: { fontFamily: F.bodyBold, fontSize: 14, color: C.ink },
  swatches: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 14, height: 14, borderRadius: 999, borderWidth: 1, borderColor: C.ruleMed },
  dotOff: { opacity: 0.35 },
  swatchNote: { fontFamily: F.body, fontSize: 11, color: C.textFaint, marginLeft: 3 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.forest, borderRadius: R.pill, height: 54,
    marginHorizontal: S.md, marginTop: S.lg, ...SHADOW_CTA,
  },
  ctaT: { fontFamily: F.bodyBold, fontSize: 15, color: C.white },
});
