import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/ui/Icon";
import { Mono, Serif } from "@/components/ui/Type";
import type { CollectionRow } from "@/lib/data";
import { parseGradient } from "@/lib/gradient";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

// A mid-grid collection break. Two variants, because a long uniform grid is the
// single most template-looking thing a shop can do, and two different
// interruptions read as a magazine while one repeated one reads as an ad slot.
//
//   "plate"  — full-bleed photograph, the loud one. Used once, high up.
//   "strip"  — a short wide band on the collection's own gradient. Quieter, and
//              it works for collections that have no photograph at all, which
//              a photo-only banner cannot.
export function CollectionBanner({
  collection,
  variant = "plate",
  count,
  eyebrow,
}: {
  collection: CollectionRow;
  variant?: "plate" | "strip";
  count?: number;
  eyebrow?: string;
}) {
  const go = () => {
    haptics.tap();
    router.push(`/collections/${collection.slug}`);
  };

  if (variant === "strip") {
    const g = parseGradient(collection.gradient);
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel={`${collection.name} collection`}
        style={s.strip}
      >
        <LinearGradient
          colors={g.colors}
          locations={g.locations}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1 }}>
          <Mono color="rgba(255,255,255,0.72)">{(eyebrow ?? "The collection").toUpperCase()}</Mono>
          <Text style={s.stripName} numberOfLines={1}>
            {collection.name}
          </Text>
          {collection.tagline ? (
            <Text style={s.stripTag} numberOfLines={1}>
              {collection.tagline}
            </Text>
          ) : null}
        </View>
        <View style={s.stripGo}>
          <Icon name="arrow_forward" size={18} color={C.ink} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={go}
      accessibilityRole="button"
      accessibilityLabel={`${collection.name} collection`}
      style={s.plate}
    >
      {collection.image_url ? (
        <Image
          source={{ uri: collection.image_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          alt=""
        />
      ) : null}
      <LinearGradient
        colors={["rgba(12,18,15,0.12)", "rgba(12,18,15,0.85)"]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.plateBody}>
        <Mono color="rgba(255,255,255,0.7)">
          {(eyebrow ?? "The collection").toUpperCase()}
          {count ? ` · ${count} PIECES` : ""}
        </Mono>
        <Serif color={C.paper} style={{ marginTop: 4 }}>
          {collection.name}
        </Serif>
        {collection.tagline ? (
          <Text style={s.plateTag} numberOfLines={2}>
            {collection.tagline}
          </Text>
        ) : null}
        <View style={s.plateLink}>
          <Text style={s.plateLinkT}>See the kit</Text>
          <Icon name="arrow_forward" size={16} color={C.paper} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  plate: { height: 260, justifyContent: "flex-end", backgroundColor: C.ink },
  plateBody: { padding: S.gutter },
  plateTag: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.82)", marginTop: 8, maxWidth: 300 },
  plateLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.md },
  plateLinkT: { fontFamily: F.bodySemiBold, fontSize: 14, color: C.paper },

  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    marginHorizontal: S.gutter,
    borderRadius: R.card,
    overflow: "hidden",
    paddingVertical: S.lg,
    paddingHorizontal: S.md,
    backgroundColor: C.altitude,
  },
  stripName: { fontFamily: F.displayRegular, fontSize: 22, lineHeight: 26, color: C.paper, marginTop: 4 },
  stripTag: { fontFamily: F.bodyItalic, fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 },
  stripGo: {
    width: 38, height: 38, borderRadius: 999,
    backgroundColor: C.paper, alignItems: "center", justifyContent: "center",
  },
});
