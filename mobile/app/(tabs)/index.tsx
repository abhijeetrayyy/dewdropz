import { useMemo } from "react";
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useCollectionsQuery, useCustomizableProductsQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { useAuthStore } from "@/stores/auth";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/Button";
import { Masthead } from "@/components/editorial/Masthead";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Marquee } from "@/components/editorial/Marquee";
import { PullQuote } from "@/components/editorial/PullQuote";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Display3, Editorial, Hero, Meta, Mono, Serif, Title } from "@/components/ui/Type";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatPrice } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/customize/assetUrl";
import { JOURNAL, TESTIMONIALS, TRUST_POINTS, formatArticleDate } from "@/lib/editorial";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.56);
const CONTENT_W = SCREEN_W - S.gutter * 2;
const RAIL_CARD_W = Math.round(CONTENT_W * 0.52);

// ─────────────────────────────────────────────────────────────────────────────
// Home — "the issue"
// ─────────────────────────────────────────────────────────────────────────────
// v4's home was hero → 3 cards → banner: three blocks, no through-line, and
// no reason to reach the bottom. This is built as a paginated issue instead,
// numbered 01–06, so a long scroll has structure and a reader always knows how
// far in they are.
//
//   masthead · hero · trust marquee
//   01 NEW THIS WEEK   — the arrivals rail
//   02 THE COLLECTIONS — serif-titled full-bleed blocks
//   03 THE WORKBENCH   — design-your-own, the store's actual core feature
//   04 FROM THE JOURNAL— long-form, previously mobile-only-missing
//   05 VOICES          — testimonials on an ink band
//   06 colophon        — where it's made, links to About/Sustainability
//
// Every section opens with the same SectionHead furniture, which is what makes
// six different content types read as one publication.

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const { data: products = [], isLoading, isError, refetch } = useProductsQuery();
  const { data: collections = [] } = useCollectionsQuery();
  const { data: blanks = [] } = useCustomizableProductsQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const user = useAuthStore((s) => s.user);

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  // Studio blanks are excluded from the arrivals rail on purpose. Their
  // `images` are flat garment mockups (a blank hoodie on white), not product
  // photography — merchandising them next to shot-on-location gear makes the
  // whole rail look like placeholder content. They get section 03 to
  // themselves, where a template mockup is exactly the right image.
  const newArrivals = useMemo(
    () => (products as any[]).filter((p) => !p.is_customizable).slice(0, 6),
    [products],
  );

  // The hero needs a photograph, so it takes the first arrival that actually
  // has one and falls back to a collection shot rather than rendering an
  // empty ink block.
  const hero = newArrivals.find((p: any) => p.images?.[0]) ?? newArrivals[0];
  const heroImage = hero?.images?.[0] ?? (collections[0] as any)?.image_url;
  const featuredArticle = JOURNAL[0];

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.block }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
      >
        <Masthead />

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.96}
          disabled={!hero}
          onPress={() => hero && router.push(`/product/${hero.slug}`)}
          style={[s.hero, { height: HERO_H }]}
        >
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} alt="" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.sand }]} />
          )}
          {/* Four stops, not three. A single transparent midpoint left the
              eyebrow row and the top of the headline sitting on whatever the
              photograph happened to be — on a light studio shot that's white
              text on near-white. The long ramp from 30% down keeps the garment
              readable while guaranteeing contrast everywhere text lands. */}
          <LinearGradient
            colors={[
              "rgba(12,18,15,0.50)",
              "rgba(12,18,15,0.00)",
              "rgba(12,18,15,0.45)",
              "rgba(12,18,15,0.94)",
            ]}
            locations={[0, 0.22, 0.44, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={s.heroTop}>
            <Mono color="rgba(255,255,255,0.8)">
              {greeting().toUpperCase()}
              {firstName ? `, ${firstName.toUpperCase()}` : ""}
            </Mono>
          </View>

          <Animated.View entering={FadeIn.duration(500)} style={s.heroBody}>
            <View style={s.heroTagRow}>
              <View style={s.heroTag}>
                <Text style={s.heroTagT}>THIS WEEK</Text>
              </View>
              {hero?.collection?.name ? (
                <Mono color="rgba(255,255,255,0.88)">{hero.collection.name.toUpperCase()}</Mono>
              ) : null}
            </View>
            <Hero color={C.paper} style={{ marginTop: 14 }}>
              Made to{"\n"}order.
            </Hero>
            <Body color="rgba(255,255,255,0.82)" style={{ marginTop: 12, maxWidth: 300 }}>
              Small-batch gear from Dehradun — or bring your own artwork and we&apos;ll print it.
            </Body>
            <View style={s.heroActions}>
              <Button title="Shop the drop" variant="primary" size="md" onPress={() => router.push("/(tabs)/shop")} />
              <TouchableOpacity style={s.heroAlt} onPress={() => router.push("/(tabs)/design")} activeOpacity={0.7}>
                <Text style={s.heroAltT}>Design your own</Text>
                <Icon name="arrow_outward" size={16} color={C.paper} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <Marquee items={TRUST_POINTS} tone="ink" />

        {/* ── 01 · New this week ─────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHead
            index="01"
            eyebrow="New this week"
            title="Fresh off the bench."
            lede="Restocks and first runs, listed the day they clear the workshop."
            actionLabel="All gear"
            onAction={() => router.push("/(tabs)/shop")}
            style={{ paddingHorizontal: S.gutter }}
          />

          {isError ? (
            <ErrorState message="Couldn't load the catalogue." onRetry={() => refetch()} style={{ paddingHorizontal: S.gutter }} />
          ) : isLoading ? (
            <View style={{ paddingHorizontal: S.gutter, marginTop: S.xl }}>
              <SkeletonProductGrid count={2} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={RAIL_CARD_W + S.md}
              contentContainerStyle={s.rail}
            >
              {newArrivals.map((p: any, i: number) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 5) * 60).springify().damping(18)}>
                  <ProductCard
                    width={RAIL_CARD_W}
                    productId={p.id}
                    slug={p.slug}
                    name={p.name}
                    price={p.price}
                    imageUri={p.images?.[0] ?? ""}
                    meta={p.collection?.name}
                    compareAtPrice={p.compare_at_price}
                    createdAt={p.created_at}
                    tag={
                      p.inventory_quantity != null && p.inventory_quantity <= 3
                        ? { label: `${p.inventory_quantity} LEFT`, tone: "scarcity" }
                        : undefined
                    }
                  />
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── 02 · The collections ───────────────────────────────────────── */}
        {collections.length > 0 ? (
          <View style={s.section}>
            <SectionHead
              index="02"
              eyebrow="The collections"
              title="Three kinds of weather."
              lede="Each collection is built around one set of conditions, and tested in them."
              actionLabel="Index"
              onAction={() => router.push("/collections")}
              style={{ paddingHorizontal: S.gutter }}
            />
            <View style={{ marginTop: S.xl }}>
              {(collections as any[]).slice(0, 3).map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.94}
                  onPress={() => {
                    haptics.tap();
                    router.push(`/collections/${c.slug}`);
                  }}
                  style={s.collectionBlock}
                >
                  <View style={s.collectionFrame}>
                    {c.image_url ? (
                      <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} alt="" />
                    ) : null}
                    <LinearGradient
                      colors={["transparent", "rgba(12,18,15,0.72)"]}
                      locations={[0.35, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={s.collectionBody}>
                      <Mono color="rgba(255,255,255,0.65)">{String(i + 1).padStart(2, "0")}</Mono>
                      {/* Instrument Serif here, not Bricolage: the collection
                          names are the one place the brand speaks in its own
                          voice rather than shouting a product claim. */}
                      <Serif color={C.paper} style={{ marginTop: 4 }}>
                        {c.name}
                      </Serif>
                      {c.tagline ? (
                        <Meta color="rgba(255,255,255,0.78)" style={{ marginTop: 6 }}>
                          {c.tagline}
                        </Meta>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── 03 · The workbench ─────────────────────────────────────────── */}
        {blanks.length > 0 ? (
          <View style={[s.section, s.band]}>
            <SectionHead
              index="03"
              eyebrow="The workbench"
              title="Put your own mark on it."
              lede="Heavyweight blanks in an oversized unisex fit. Drop in artwork or set type — front, back, or both — and see it on the garment before you order."
              style={{ paddingHorizontal: S.gutter }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={s.rail}
            >
              {blanks.map((p) => {
                const colors = p.customization_config?.colors ?? [];
                const cover = resolveAssetUrl(colors.find((c) => c.available)?.front?.mockupImage ?? p.images?.[0]);
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.93}
                    onPress={() => {
                      haptics.tap();
                      router.push(`/customize/${p.slug}`);
                    }}
                    style={{ width: RAIL_CARD_W }}
                  >
                    <View style={s.blankFrame}>
                      {cover ? (
                        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} alt="" />
                      ) : null}
                      <View style={s.blankTag}>
                        <Text style={s.blankTagT}>FRONT &amp; BACK</Text>
                      </View>
                    </View>
                    <Title style={{ marginTop: 11 }} numberOfLines={1}>
                      {p.name}
                    </Title>
                    <View style={s.swatchRow}>
                      {colors.slice(0, 6).map((c) => (
                        <View key={c.name} style={[s.dot, { backgroundColor: c.hex }, !c.available && s.dotOff]} />
                      ))}
                      <Mono color={C.textMuted} style={{ marginLeft: 4 }}>
                        {formatPrice(p.price)}
                      </Mono>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ paddingHorizontal: S.gutter, marginTop: S.xl }}>
              <Button title="Open the studio" icon="draw" variant="dark" onPress={() => router.push("/(tabs)/design")} />
            </View>
          </View>
        ) : null}

        {/* ── 04 · From the journal ──────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHead
            index="04"
            eyebrow="From the journal"
            title="Notes from the ridge."
            actionLabel="All stories"
            onAction={() => router.push("/journal")}
            style={{ paddingHorizontal: S.gutter }}
          />

          <TouchableOpacity
            activeOpacity={0.94}
            onPress={() => router.push(`/journal/${featuredArticle.id}`)}
            style={{ paddingHorizontal: S.gutter, marginTop: S.xl }}
          >
            <View style={s.articleFrame}>
              <Image source={{ uri: featuredArticle.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} alt="" />
              <View style={s.articleTag}>
                <Text style={s.articleTagT}>{featuredArticle.tag.toUpperCase()}</Text>
              </View>
            </View>
            <Mono color={C.textMuted} style={{ marginTop: 14 }}>
              {featuredArticle.author.toUpperCase()} · {featuredArticle.readTime.toUpperCase()}
            </Mono>
            <Editorial style={{ marginTop: 8 }}>{featuredArticle.title}</Editorial>
            <Body color={C.textMid} style={{ marginTop: 8 }}>
              {featuredArticle.excerpt}
            </Body>
          </TouchableOpacity>

          <View style={{ paddingHorizontal: S.gutter, marginTop: S.xl }}>
            {JOURNAL.slice(1).map((a) => (
              <TouchableOpacity key={a.id} activeOpacity={0.7} onPress={() => router.push(`/journal/${a.id}`)}>
                <Rule weight="soft" />
                <View style={s.articleRow}>
                  <View style={{ flex: 1 }}>
                    <Mono color={C.clay}>{a.tag.toUpperCase()}</Mono>
                    <Title style={{ marginTop: 6 }} numberOfLines={2}>
                      {a.title}
                    </Title>
                    <Mono color={C.textFaint} style={{ marginTop: 6 }}>
                      {formatArticleDate(a.date).toUpperCase()}
                    </Mono>
                  </View>
                  <Image source={{ uri: a.image }} style={s.articleThumb} contentFit="cover" alt="" />
                </View>
              </TouchableOpacity>
            ))}
            <Rule weight="soft" />
          </View>
        </View>

        {/* ── 05 · Voices ────────────────────────────────────────────────── */}
        <View style={s.inkBand}>
          <SectionHead
            index="05"
            eyebrow="Voices"
            title="From people who took it up."
            tone="onDark"
            style={{ paddingHorizontal: S.gutter }}
          />
          {/* Each page is exactly one screen wide with the gutter INSIDE it.
              Sizing pages to the content width instead (screen − 2×gutter)
              desynchronises them from `pagingEnabled`'s stride, which is
              always the scroll view's own width — so every page settled a
              gutter short and the next quote bled in at the right edge. */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: S.xl }}
          >
            {TESTIMONIALS.map((t) => (
              <View key={t.name} style={{ width: SCREEN_W, paddingHorizontal: S.gutter }}>
                <PullQuote quote={t.quote} attribution={t.name} role={t.trail} tone="onDark" />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── 06 · Colophon ──────────────────────────────────────────────── */}
        <View style={[s.section, { paddingHorizontal: S.gutter }]}>
          <SectionHead index="06" eyebrow="Colophon" title="Made where it's tested." />
          <Body color={C.textMid} style={{ marginTop: 12 }}>
            Designed, sewn and shipped from Rajpur Road, Dehradun — a two-hour drive from the trailheads everything here
            was built for.
          </Body>
          <View style={s.colophonLinks}>
            <ColophonLink label="Our story" onPress={() => router.push("/about")} />
            <ColophonLink label="Sustainability" onPress={() => router.push("/sustainability")} />
            <ColophonLink label="The journal" onPress={() => router.push("/journal")} />
            <ColophonLink label="Collections" onPress={() => router.push("/collections")} last />
          </View>
          <Mono color={C.textFaint} style={{ marginTop: S.xl }}>
            DEWDROPZ · 30.3165° N, 78.0322° E
          </Mono>
        </View>
      </ScrollView>
    </View>
  );
}

function ColophonLink({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <>
      <Rule weight="soft" />
      <TouchableOpacity style={s.colophonRow} activeOpacity={0.6} onPress={onPress}>
        <Display3 style={{ flex: 1 }}>{label}</Display3>
        <Icon name="arrow_outward" size={20} color={C.textMuted} />
      </TouchableOpacity>
      {last ? <Rule weight="soft" /> : null}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },

  hero: { justifyContent: "flex-end", backgroundColor: C.ink },
  heroTop: { position: "absolute", top: S.md, left: S.gutter },
  heroBody: { padding: S.gutter, paddingBottom: S.xl },
  heroTagRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTag: { backgroundColor: C.ember, borderRadius: R.tag, paddingHorizontal: 7, paddingVertical: 3.5 },
  heroTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },
  heroActions: { flexDirection: "row", alignItems: "center", gap: S.md, marginTop: S.lg },
  heroAlt: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroAltT: { fontFamily: F.bodySemiBold, fontSize: 14, color: C.paper },

  section: { paddingTop: S.section },
  band: { backgroundColor: C.paperDeep, paddingBottom: S.section, marginTop: S.section, paddingTop: S.block },

  rail: { paddingHorizontal: S.gutter, gap: S.md, paddingTop: S.xl },

  collectionBlock: { paddingHorizontal: S.gutter, marginBottom: S.sm },
  collectionFrame: { height: 190, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand, justifyContent: "flex-end" },
  collectionBody: { padding: S.md },

  blankFrame: { width: "100%", aspectRatio: 4 / 5, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  blankTag: { position: "absolute", left: 8, top: 8, backgroundColor: "rgba(23,35,29,0.72)", paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: R.tag },
  blankTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1, color: C.paper },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 },
  dot: { width: 11, height: 11, borderRadius: 999, borderWidth: 1, borderColor: C.ruleMed },
  dotOff: { opacity: 0.3 },

  articleFrame: { width: "100%", aspectRatio: 3 / 2, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  articleTag: { position: "absolute", left: 10, top: 10, backgroundColor: "rgba(12,18,15,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.tag },
  articleTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },
  articleRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  articleThumb: { width: 76, height: 76, borderRadius: R.card, backgroundColor: C.sand },

  inkBand: { backgroundColor: C.ink, paddingVertical: S.band, marginTop: S.section },

  colophonLinks: { marginTop: S.xl },
  colophonRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
});
