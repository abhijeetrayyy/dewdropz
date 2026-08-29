import { useWindowDimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Icon } from "@/components/ui/Icon";
import { Mono } from "@/components/ui/Type";
import type { CategoryRow } from "@/lib/data";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";


// "What are you packing for?" — the packer's entry into the catalogue, as
// opposed to the collections rail, which is the brand's editorial grouping.
// The web shop has had this since launch (ShopByCategory.tsx); mobile shipped
// with no category axis at all, so four top-level categories with real
// photography and copy sat unused in the database.
//
// A horizontal rail rather than the web's 4-up grid: on a phone a grid of four
// 4:5 tiles eats a full screen before a single product is visible, and the
// whole point of this block is to be passed quickly on the way to the grid.
export function CategoryTiles({
  categories,
  counts,
  covers,
}: {
  categories: CategoryRow[];
  /** Product count per category id. Omitted entirely when zero — an empty
   *  category is still worth navigating to, but "0 PIECES" reads as broken. */
  counts: Record<string, number>;
  /** Fallback photograph per category id, borrowed from a product inside it.
   *  Every category has `image_url` NULL today, so without this the whole rail
   *  is grey rectangles. An explicit admin image still takes precedence. */
  covers?: Record<string, string>;
}) {
  // Measured per render, not captured once at import. See the note in
  // components/ProductGallery.tsx — module-scope `Dimensions.get()` is wrong
  // the moment the window changes size, which on Android is routine.
  const { width: SCREEN_W } = useWindowDimensions();
  const TILE_W = Math.round((SCREEN_W - S.gutter * 2) * 0.42);

  // Hooks must run before this early return, hence the ordering.
  if (categories.length === 0) return null;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
      decelerationRate="fast"
      snapToInterval={TILE_W + S.sm}
    >
      {categories.map((cat, i) => {
        const n = counts[cat.id] ?? 0;
        // `||`, not `??`. Every category carries `image_url = ""` — an empty
        // string, not NULL — and nullish coalescing keeps it, so the tile fell
        // through to a bare gradient while a perfectly good cover sat unused.
        const cover = cat.image_url?.trim() || covers?.[cat.id];
        return (
          <Animated.View key={cat.id} entering={FadeInDown.delay(Math.min(i, 5) * 55).duration(380)}>
            <TouchableOpacity
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={`${cat.name}${n > 0 ? `, ${n} pieces` : ""}`}
              onPress={() => {
                haptics.tap();
                router.push(`/category/${cat.slug}`);
              }}
              style={{ width: TILE_W }}
            >
              <View style={s.frame}>
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                    alt=""
                  />
                ) : null}
                <LinearGradient
                  colors={["rgba(12,18,15,0.05)", "rgba(12,18,15,0.82)"]}
                  locations={[0.35, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.body}>
                  <Text style={s.name} numberOfLines={2}>
                    {cat.name}
                  </Text>
                  {n > 0 ? (
                    <Mono color="rgba(255,255,255,0.7)" style={{ marginTop: 3 }}>
                      {n} {n === 1 ? "PIECE" : "PIECES"}
                    </Mono>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Terminal card — the "everything" escape hatch, so the rail ends on an
          action rather than trailing off. */}
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        onPress={() => {
          haptics.tap();
          router.push("/collections");
        }}
        style={[s.frame, s.allTile, { width: Math.round(TILE_W * 0.62) }]}
      >
        <Icon name="grid_view" size={22} color={C.ink} />
        <Text style={s.allT}>All{"\n"}collections</Text>
        <Icon name="arrow_forward" size={16} color={C.forest} />
      </TouchableOpacity>
    </Animated.ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { gap: S.sm, paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: 4 },
  frame: {
    aspectRatio: 4 / 5,
    borderRadius: R.card,
    overflow: "hidden",
    backgroundColor: C.sand,
    justifyContent: "flex-end",
  },
  body: { padding: 11 },
  name: { fontFamily: F.displayRegular, fontSize: 16, lineHeight: 19, color: C.paper },
  allTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.ruleSoft,
  },
  allT: {
    fontFamily: F.bodySemiBold,
    fontSize: 12,
    lineHeight: 15,
    color: C.ink,
    textAlign: "center",
  },
});
