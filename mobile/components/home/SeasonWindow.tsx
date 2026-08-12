import { useMemo } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Topography } from "@/components/editorial/Topography";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Display2, Eyebrow, Mono } from "@/components/ui/Type";
import { useProductsBySlugsQuery } from "@/lib/queries";
import { currentSeasonKit } from "@/lib/editorial";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const BAND_W = SCREEN_W;

// ─────────────────────────────────────────────────────────────────────────────
// The season window — the front page's answer to "why now?"
// ─────────────────────────────────────────────────────────────────────────────
//
// Every other section on Home sells a product. This one sells a *reason*: the
// trekking calendar. Four windows a year, picked by calendar month, each with
// the route that opens and the kit we'd carry on it. It re-merchandises itself
// on 1 March, 1 July, 1 October and 1 December with no deploy.
//
// This is the single biggest thing separating the app from a clothing store.
// A shop says "new arrivals". A gear brand says "Kedarkantha is under snow for
// the next eight weeks and here is what keeps you out there" — and the second
// one is the only one that sounds like it was written by someone who goes.
//
// Set on the altitude band (deep blue-black, the high-cold end of the palette)
// with contour texture behind it, so the section reads as elevation before a
// single word is parsed.
export function SeasonWindow() {
  const kit = useMemo(() => currentSeasonKit(), []);
  const { data: products = [] } = useProductsBySlugsQuery(kit.products);

  // `.in(...)` returns rows in arbitrary order — restore the curated sequence
  // so the kit reads as a packing list rather than a query result.
  const ordered = useMemo(() => {
    const bySlug = new Map((products as any[]).map((p) => [p.slug, p]));
    return kit.products.map((s) => bySlug.get(s)).filter(Boolean) as any[];
  }, [products, kit.products]);

  const kitTotal = ordered.reduce((sum, p) => sum + (p?.price ?? 0), 0);

  return (
    <View style={s.band}>
      <Topography width={BAND_W} height={620} color={C.sage} opacity={0.18} lines={12} seed={4.2} originX={0.74} originY={0.34} />

      <View style={{ paddingHorizontal: S.gutter }}>
        <View style={s.eyebrowRow}>
          {/* A live status light, not decoration: this window is open today. */}
          <View style={s.pulse} />
          <Eyebrow color={C.sage} style={{ flex: 1 }}>
            {kit.seasonLabel} · open now
          </Eyebrow>
          <Mono color="rgba(255,255,255,0.45)">01</Mono>
        </View>
        <Rule weight="soft" style={{ marginTop: 9, opacity: 0.35 }} />

        <Display2 color={C.paper} style={{ marginTop: S.md }}>
          {kit.headline}
        </Display2>
        <Body color="rgba(255,255,255,0.72)" style={{ marginTop: 10 }}>
          {kit.line}
        </Body>

        {/* Field data. Mono, ruled, three columns — reads as instrument
            output, which is exactly the register this section wants. */}
        <View style={s.conditions}>
          {kit.conditions.map((c, i) => (
            <View key={c.label} style={[s.condCell, i < kit.conditions.length - 1 && s.condDivider]}>
              <Mono color="rgba(255,255,255,0.45)">{c.label.toUpperCase()}</Mono>
              <Text style={s.condValue}>{c.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* The kit itself */}
      {ordered.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentContainerStyle={s.rail}
          >
            {ordered.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.9}
                onPress={() => {
                  haptics.tap();
                  router.push(`/product/${p.slug}`);
                }}
                style={s.kitItem}
              >
                <View style={s.kitFrame}>
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} alt="" />
                  ) : null}
                  <View style={s.kitIndex}>
                    <Text style={s.kitIndexT}>{String(i + 1).padStart(2, "0")}</Text>
                  </View>
                </View>
                <Text style={s.kitName} numberOfLines={2}>
                  {p.name}
                </Text>
                <Mono color="rgba(255,255,255,0.55)" style={{ marginTop: 3 }}>
                  {formatPrice(p.price)}
                </Mono>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ paddingHorizontal: S.gutter, marginTop: S.lg }}>
            <Rule weight="soft" style={{ opacity: 0.3 }} />
            <TouchableOpacity
              style={s.cta}
              activeOpacity={0.8}
              onPress={() => {
                haptics.tap();
                router.push(`/collections/${kit.collectionSlug}`);
              }}
            >
              <View style={{ flex: 1 }}>
                <Mono color="rgba(255,255,255,0.5)">
                  {ordered.length} PIECES · {formatPrice(kitTotal)}
                </Mono>
                <Text style={s.ctaT}>See the whole window</Text>
              </View>
              <View style={s.ctaGo}>
                <Icon name="arrow_forward" size={20} color={C.altitude} />
              </View>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  band: { backgroundColor: C.altitude, paddingTop: S.block, paddingBottom: S.block, overflow: "hidden" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  pulse: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.sage },

  conditions: { flexDirection: "row", marginTop: S.xl },
  condCell: { flex: 1, gap: 6 },
  condDivider: { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.14)", marginRight: S.md, paddingRight: S.md },
  condValue: { fontFamily: F.bodyBold, fontSize: 15, color: C.paper, letterSpacing: -0.1 },

  rail: { paddingHorizontal: S.gutter, gap: S.sm, paddingTop: S.block },
  kitItem: { width: 116 },
  kitFrame: { width: "100%", aspectRatio: 4 / 5, borderRadius: R.card, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.07)" },
  kitIndex: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(12,18,15,0.55)", borderRadius: R.tag, paddingHorizontal: 5, paddingVertical: 2 },
  kitIndexT: { fontFamily: F.monoBold, fontSize: 8, letterSpacing: 1, color: C.paper },
  // Fraunces regular — same product-name treatment as ProductCard/DesignYourOwn.
  kitName: { fontFamily: F.displayRegular, fontSize: 14, lineHeight: 18, color: C.paper, marginTop: 9 },

  cta: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.lg },
  ctaT: { fontFamily: F.bodyBold, fontSize: 17, color: C.paper, marginTop: 4, letterSpacing: -0.2 },
  ctaGo: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" },
});
