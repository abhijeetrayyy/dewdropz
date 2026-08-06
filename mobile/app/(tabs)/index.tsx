import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { ShieldCheck, Truck, RotateCcw, Mountain } from "lucide-react-native";
import { ProductCard } from "@/components/ProductCard";
import { Header } from "@/components/Header";
import { Skeleton, SkeletonProductGrid } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { C, F, R } from "@/lib/theme";
import { TESTIMONIALS, STATS } from "@/lib/constants";

const { width: W } = Dimensions.get("window");
const HERO_IMG = "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600";
const STORY_IMG = "https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=1600";

const TRUST = [
  { Icon: ShieldCheck, label: "Field-tested at altitude" },
  { Icon: Truck, label: "COD available across India" },
  { Icon: RotateCcw, label: "7-day easy returns" },
  { Icon: Mountain, label: "Free shipping over ₹2,000" },
];

export default function HomeScreen() {
  const { data: collections = [], isLoading: colsLoading } = useCollectionsQuery();
  const { data: products = [], isLoading: prodLoading, isError, refetch } = useProductsQuery();
  const featured = products.slice(0, 4);

  return (
    <View style={s.root}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Hero — a warm rounded card, not a full-bleed dark overlay */}
        <View style={s.heroWrap}>
          <Animated.View entering={FadeInUp.springify().damping(18)} style={s.hero}>
            <Image source={{ uri: HERO_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            <LinearGradient colors={[C.sage + "00", C.forest + "CC", C.forest + "F2"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.heroBody}>
              <Text style={s.eb}>Field-tested gear</Text>
              <Text style={s.h1}>Feel the first light.</Text>
              <Text style={s.body}>Equipment built for the miles that turn into stories, tested on real Himalayan expeditions before it ever ships.</Text>
              <TouchableOpacity style={s.cta} onPress={() => router.push("/shop")} activeOpacity={0.9}>
                <Text style={s.ctaT}>Explore the catalogue</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>

        {/* Trust band */}
        <View style={s.trust}>
          {TRUST.map(({ Icon, label }, i) => (
            <View key={i} style={s.trustItem}>
              <Icon size={14} strokeWidth={1.75} color={C.paper} />
              <Text style={s.trustT}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Featured gear */}
        <View style={s.section}>
          <Text style={[s.sl, { paddingHorizontal: 24 }]}>Fresh off the trail</Text>
          {isError ? (
            <ErrorState message="Couldn't load the catalogue." onRetry={() => refetch()} />
          ) : prodLoading ? (
            <SkeletonProductGrid count={4} />
          ) : (
            <View style={s.grid}>
              {featured.map((p: any, i: number) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 60).springify().damping(18)} style={{ width: "48%" }}>
                  <ProductCard productId={p.id} slug={p.slug} name={p.name} price={p.price} imageUri={p.images?.[0] ?? ""} collectionLabel={p.collection?.name} />
                </Animated.View>
              ))}
            </View>
          )}
          <TouchableOpacity style={s.viewAll} onPress={() => router.push("/shop")} activeOpacity={0.7}>
            <Text style={s.viewAllT}>View full catalogue →</Text>
          </TouchableOpacity>
        </View>

        {/* Collections rail */}
        <View style={s.section}>
          <Text style={s.sl}>Shop by collection</Text>
          {colsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} width={190} height={240} radius={R.md} />
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}>
              {collections.map((c: any) => (
                <TouchableOpacity key={c.id} style={s.card} activeOpacity={0.9} onPress={() => router.push(`/collections/${c.slug}`)}>
                  {c.image_url ? <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  <View style={s.cardOv} />
                  <View style={s.cardBody}>
                    <Text style={s.cardT}>{c.name}</Text>
                    {c.tagline ? (
                      <Text style={s.cardTag} numberOfLines={2}>
                        {c.tagline}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Brand story — full-bleed photo with overlaid glass stat cards,
            not a stacked-text block, so it carries the same visual weight
            as the hero instead of reading as filler copy at the bottom of
            the page. */}
        <View style={[s.section, { paddingHorizontal: 16 }]}>
          <Animated.View entering={FadeInUp.springify().damping(18)} style={s.storyCard}>
            <Image source={{ uri: STORY_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["#0C100D00", C.forest + "E6"]} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.storyBody}>
              <Text style={s.storyEb}>Field notes</Text>
              <Text style={s.storyT}>Built above the tree line, not in a boardroom.</Text>
              <Text style={s.storyB}>
                Every piece we ship has already survived a real expedition — guide-tested across the Indian Himalaya before it ever reaches
                a store shelf.
              </Text>
              <View style={s.statsGrid}>
                {STATS.map((st, i) => (
                  <View key={i} style={s.statCell}>
                    <Text style={s.statV}>{st.value}</Text>
                    <Text style={s.statL}>{st.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Testimonials — a horizontal card rail with an avatar mark per
            quote, not stacked plain paragraphs. */}
        <View style={s.section}>
          <Text style={[s.sl, { paddingHorizontal: 24 }]}>What trekkers say</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}>
            {TESTIMONIALS.map((t, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 60).springify().damping(18)} style={s.quoteCard}>
                <Text style={s.quoteMark}>&ldquo;</Text>
                <Text style={s.quote} numberOfLines={5}>
                  {t.quote}
                </Text>
                <View style={s.quoteFoot}>
                  <View style={s.quoteAv}>
                    <Text style={s.quoteAvT}>{t.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={s.quoteName}>{t.name}</Text>
                    <Text style={s.quoteTrail}>{t.trail}</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  heroWrap: { paddingHorizontal: 16, paddingTop: 16 },
  hero: { width: W - 32, height: 480, justifyContent: "flex-end", borderRadius: R.md + 8, overflow: "hidden" },
  heroBody: { padding: 26 },
  eb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#FFFFFF", marginBottom: 10, opacity: 0.9 },
  h1: { fontFamily: F.display, fontSize: 36, color: "#FFFFFF", lineHeight: 40, maxWidth: 260 },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 22, color: "#FFFFFF", opacity: 0.92, marginTop: 14, maxWidth: 300 },
  cta: { backgroundColor: "#FFFFFF", borderRadius: R.md, paddingVertical: 16, alignItems: "center", marginTop: 22 },
  ctaT: { fontFamily: F.bodyBold, fontSize: 14, letterSpacing: 0.3, color: C.forest, fontWeight: "700" },
  trust: { flexDirection: "row", flexWrap: "wrap", backgroundColor: C.forest, paddingVertical: 20, paddingHorizontal: 22, gap: 16, marginTop: 28, borderRadius: R.md, marginHorizontal: 16 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 8, width: "45%" },
  trustT: { fontFamily: F.body, fontSize: 11, fontWeight: "500", color: C.paper, letterSpacing: 0.2, flexShrink: 1 },
  section: { marginTop: 44 },
  sl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest, marginBottom: 16, paddingHorizontal: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 24 },
  viewAll: { alignSelf: "center", marginTop: 12 },
  viewAllT: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 0.3, color: C.forest, fontWeight: "700" },
  card: { width: 190, height: 240, borderRadius: R.md, overflow: "hidden", backgroundColor: C.rule },
  cardOv: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ink + "5C" },
  cardBody: { flex: 1, justifyContent: "flex-end", padding: 16 },
  cardT: { fontFamily: F.display, fontSize: 18, color: C.paper },
  cardTag: { fontFamily: F.body, fontSize: 11, color: C.paper + "CC", marginTop: 4 },
  storyCard: { height: 460, borderRadius: R.md + 8, overflow: "hidden", justifyContent: "flex-end" },
  storyBody: { padding: 26 },
  storyEb: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.paper, opacity: 0.85, marginBottom: 10 },
  storyT: { fontFamily: F.display, fontSize: 25, lineHeight: 31, color: "#FFFFFF", marginBottom: 10, maxWidth: 300 },
  storyB: { fontFamily: F.body, fontSize: 14, lineHeight: 22, color: "#FFFFFFE6" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 24, gap: 12 },
  statCell: { width: "47%", backgroundColor: "#FFFFFF1A", borderWidth: 1, borderColor: "#FFFFFF33", borderRadius: R.md, padding: 14 },
  statV: { fontFamily: F.display, fontSize: 26, color: "#FFFFFF" },
  statL: { fontFamily: F.body, fontSize: 11, color: "#FFFFFFCC", marginTop: 2 },
  quoteCard: {
    width: 260, backgroundColor: C.surface, borderRadius: R.md + 4, padding: 20, borderWidth: 1, borderColor: C.rule,
  },
  quoteMark: { fontFamily: F.display, fontSize: 40, lineHeight: 40, color: C.forest, opacity: 0.35, marginBottom: -6 },
  quote: { fontFamily: F.displayItalic, fontSize: 15, lineHeight: 22, color: C.text },
  quoteFoot: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  quoteAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.forest + "1A", alignItems: "center", justifyContent: "center" },
  quoteAvT: { fontFamily: F.display, fontSize: 14, color: C.forest },
  quoteName: { fontFamily: F.bodyBold, fontSize: 12, color: C.text },
  quoteTrail: { fontFamily: F.body, fontSize: 11, color: C.light, marginTop: 1 },
});
