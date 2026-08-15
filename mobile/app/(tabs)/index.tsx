import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
} from "react-native-reanimated";
import { useCollectionsQuery, useCustomizableProductsQuery, useHomeQuery, useOrdersQuery, useProductsQuery } from "@/lib/queries";
import { usePullToRefresh } from "@/lib/hooks";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { ProductCard } from "@/components/ProductCard";
import { useTabBarSpace } from "@/components/TabBar";
import { Button } from "@/components/Button";
import { Masthead } from "@/components/editorial/Masthead";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Marquee } from "@/components/editorial/Marquee";
import { Ridgeline } from "@/components/editorial/Ridgeline";
import { Topography } from "@/components/editorial/Topography";
import { SeasonWindow } from "@/components/home/SeasonWindow";
import { ContinueBand, hasContinueContent } from "@/components/home/ContinueBand";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Display3, Editorial, Meta, Mono, Serif, Title } from "@/components/ui/Type";
import { SkeletonProductGrid } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatPrice } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/customize/assetUrl";
import { HERO_IMAGE, JOURNAL, TRUST_POINTS, formatArticleDate } from "@/lib/editorial";
import { TRAILS } from "@/lib/trails";
import type { CollectionRow } from "@/lib/data";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";


// ─────────────────────────────────────────────────────────────────────────────
// Home — "the issue"
// ─────────────────────────────────────────────────────────────────────────────
// v4's home was hero → 3 cards → banner: three blocks, no through-line, and
// no reason to reach the bottom. This is built as a paginated issue instead,
// numbered from 01, so a long scroll has structure and a reader always knows
// how far in they are.
//
//   masthead · hero · trust marquee   (unnumbered furniture)
//   01 THE SEASON WINDOW — what the weather is doing, and the kit for it
//   ·· NEW THIS WEEK    — the arrivals rail
//   ·· CMS rails        — 0..n admin-defined rails, numbered as they appear
//   ·· THE COLLECTIONS  — serif-titled full-bleed blocks
//   ·· THE WORKBENCH    — design-your-own, the store's actual core feature
//   ·· FROM THE JOURNAL — long-form, previously mobile-only-missing
//   ·· THE TRAILS       — the trail guide, on an ink band
//   ·· colophon         — where it's made, links to About/Sustainability
//
// The numbers after 01 are deliberately not written down here: several of
// these sections drop out when they have nothing to show (no blanks, no
// featured collections), and the CMS rails vary in count, so the sequence is
// counted at render time by `idx()` below rather than hardcoded.
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
  const tabSpace = useTabBarSpace();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  // The hero is taller than it was and now runs from the very top of the
  // window, status bar included — the masthead floats over it rather than
  // sitting on paper above it. That one change is most of the difference
  // between "an app with a picture on it" and a screen you fall into.
  const HERO_H = Math.round(SCREEN_H * 0.72);
  const CONTENT_W = SCREEN_W - S.gutter * 2;
  const RAIL_CARD_W = Math.round(CONTENT_W * 0.52);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);

  // Reanimated already routes withTiming/withSpring/withRepeat and every
  // layout animation through the system Reduce Motion setting by default, so
  // the app's entrances and presses need no per-call-site opt-in. Scroll-driven
  // styles are the exception: they aren't "animations" as far as the library is
  // concerned, they're styles derived from a finger position, so nothing
  // downgrades them and this hero has to do it itself.
  //
  // The hero is also the one place in the app worth downgrading. It runs three
  // layers at three different rates against a photograph that fills 72% of the
  // screen — differential motion at that scale is the textbook vestibular
  // trigger, not a stylistic flourish. The crossfades below stay exactly as
  // they are: fading is what you're supposed to substitute FOR motion, so
  // reduced motion keeps the same choreography and only removes the sliding.
  const reduceMotion = useReducedMotion();

  // Parallax: the photograph drifts at ~40% of scroll speed, so the hero text
  // separates from the image instead of the whole block sliding as one card.
  // Pulling DOWN past the top scales the image up from its centre rather than
  // exposing background — the standard "stretch" that makes the top of a feed
  // feel physical.
  const heroImgStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const y = scrollY.value;
    return {
      transform: [
        { translateY: y > 0 ? y * 0.4 : 0 },
        { scale: y < 0 ? 1 + (-y / HERO_H) * 1.6 : 1 },
      ],
    };
  });
  // Foreground copy fades out faster than the image moves, so it clears the
  // masthead before the two could collide.
  const heroCopyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_H * 0.45], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: reduceMotion ? 0 : scrollY.value * 0.12 }],
  }));
  // The paper masthead crosses in as the hero leaves.
  const paperHeadStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H * 0.55, HERO_H * 0.8], [0, 1], Extrapolation.CLAMP),
  }));
  const darkHeadStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H * 0.55, HERO_H * 0.8], [1, 0], Extrapolation.CLAMP),
  }));
  const { data: products = [], isLoading, isError, refetch } = useProductsQuery();
  const { data: collections = [] } = useCollectionsQuery();
  const { data: blanks = [] } = useCustomizableProductsQuery();
  const { data: home } = useHomeQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const user = useAuthStore((s) => s.user);
  const { data: orders = [] } = useOrdersQuery(user?.id);
  const packCount = useCartStore((s) => s.itemCount());
  const packTotal = useCartStore((s) => s.subtotal());
  const savedCount = useWishlistStore((s) => s.count());

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

  // Which collections lead, and in which order, is the admin's call — the same
  // `featured_collection_slugs` the website reads. Empty means "show them all",
  // matching the web behaviour rather than rendering nothing.
  const featuredCollections = useMemo<CollectionRow[]>(() => {
    const picks = home?.featuredCollectionSlugs ?? [];
    if (picks.length === 0) return collections.slice(0, 3);
    return picks
      .map((slug) => collections.find((c) => c.slug === slug))
      .filter((c): c is CollectionRow => Boolean(c));
  }, [collections, home?.featuredCollectionSlugs]);

  const featuredArticle = JOURNAL[0];

  // Section numbers are counted in render order rather than hardcoded. They
  // were written by hand as "02"…"07" — so the issue opened at 02 with no 01
  // anywhere, and the admin-defined CMS rails (a variable number of sections,
  // sitting in the middle of the run) carried no number at all, breaking the
  // sequence in the one place a reader would notice it. `n` resets every
  // render, which is exactly the pass that emits the numbers.
  let n = 0;
  const idx = () => String(++n).padStart(2, "0");

  const showContinue = hasContinueContent(orders, packCount, savedCount);

  return (
    <View style={s.root}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.block + tabSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.paper} progressViewOffset={40} />}
      >

        {/* ── Hero ───────────────────────────────────────────────────────────
            Not a product shot, and not a link to a product. A phone home
            screen that opens on a garment on white is a catalogue; this opens
            on two people leaving the treeline by headlamp, which is the thing
            anyone is actually buying gear in order to go and do.

            The photograph is fixed brand imagery rather than "whatever product
            happened to be added last" — the old version pulled the newest
            arrival's image, so the emotional opening beat of the whole app
            changed silently every time the catalogue did, and rendered a grey
            box whenever the shop was empty. ──────────────────────────────── */}
        <View style={[s.hero, { height: HERO_H }]}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImgStyle]}>
            <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} alt="" />
          </Animated.View>
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

          {/* Two nested animated views on purpose. The entrance animation
              (`entering`) and the scroll-driven style both write `opacity`, and
              Reanimated warns that a layout animation may overwrite an animated
              style on the same node — the hero copy would flicker or stick.
              Outer owns the entrance; inner owns the scroll. */}
          <Animated.View entering={FadeIn.duration(600)}>
          <Animated.View style={[s.heroBody, heroCopyStyle]}>
            <Mono color="rgba(255,255,255,0.8)" style={{ marginBottom: 14 }}>
              {greeting().toUpperCase()}
              {firstName ? `, ${firstName.toUpperCase()}` : ""}
            </Mono>
            <View style={s.heroRule} />
            {/* Serif, not the 800-weight display. The line is a thought, not a
                announcement — setting it in the brand's quiet voice is what
                keeps it from reading as ad copy. */}
            <Serif color={C.paper} style={{ marginTop: 16 }}>
              Nobody remembers{"\n"}the jacket.
            </Serif>
            <Body color="rgba(255,255,255,0.84)" style={{ marginTop: 14, maxWidth: 310 }}>
              They remember the cold, the dark, and the light coming over the ridge. We just make sure the gear never
              becomes the story.
            </Body>
            <View style={s.heroActions}>
              <Button title="Find your trail" variant="primary" size="md" onPress={() => router.push("/trails")} />
              <TouchableOpacity style={s.heroAlt} onPress={() => router.push("/(tabs)/shop")} activeOpacity={0.7}>
                <Text style={s.heroAltT}>The gear</Text>
                <Icon name="arrow_outward" size={16} color={C.paper} />
              </TouchableOpacity>
            </View>
          </Animated.View>
          </Animated.View>
        </View>

        {/* One slot, two audiences. A returning customer with an order in
            flight or a loaded pack gets answered here, above everything else;
            everyone else gets the trust marquee, which is what a first-time
            visitor needs in the same position. ContinueBand returns null when
            it has nothing true to say, so this is never an empty box. */}
        {showContinue ? (
          <ContinueBand orders={orders} packCount={packCount} packTotal={packTotal} savedCount={savedCount} />
        ) : (
          <Marquee items={TRUST_POINTS} tone="ink" />
        )}

        {/* ── The season window ────────────────────────────────────────── */}
        <SeasonWindow index={idx()} />

        {/* ── New this week ──────────────────────────────────────────────────
            Suppressed entirely when the rail would be empty. Studio blanks are
            filtered out of arrivals (see `newArrivals`), so a catalogue that is
            all blanks — or simply empty — used to render this heading and its
            lede above nothing at all, while the CMS rails below already knew to
            drop out in that case. ──────────────────────────────────────────── */}
        {isError || isLoading || newArrivals.length > 0 ? (
        <View style={s.section}>
          <SectionHead
            index={idx()}
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
                <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 5) * 60).duration(380)}>
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
        ) : null}

        {/* ── CMS rails ──────────────────────────────────────────────────────
            Defined in the web admin (Settings → Product rails) and resolved
            live against the catalogue, so "Just added" and "Most ordered" fill
            themselves in as real products and orders arrive. A rail with
            nothing in it never reaches here, which is why an almost-empty shop
            shows fewer sections rather than empty headings. ───────────────── */}
        {(home?.rails ?? []).map((rail) => (
          <View key={rail.id} style={s.section}>
            <SectionHead
              index={idx()}
              eyebrow={rail.kind === "best_sellers" ? "Most ordered" : "Fresh"}
              title={rail.title}
              size="d3"
              actionLabel="All gear"
              onAction={() => router.push("/(tabs)/shop")}
              style={{ paddingHorizontal: S.gutter }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={RAIL_CARD_W + S.md}
              contentContainerStyle={s.rail}
            >
              {rail.products.map((p) => (
                <ProductCard
                  key={p.id}
                  width={RAIL_CARD_W}
                  productId={p.id}
                  slug={p.slug}
                  name={p.name}
                  price={p.price}
                  imageUri={p.images?.[0] ?? ""}
                  meta={p.collection?.name}
                  compareAtPrice={p.compare_at_price}
                  createdAt={p.created_at}
                />
              ))}
            </ScrollView>
          </View>
        ))}

        {/* ── 02 · The collections ───────────────────────────────────────── */}
        {featuredCollections.length > 0 ? (
          <View style={s.section}>
            <SectionHead
              index={idx()}
              eyebrow="The collections"
              title="Three kinds of weather."
              lede="Each collection is built around one set of conditions, and tested in them."
              actionLabel="Index"
              onAction={() => router.push("/collections")}
              style={{ paddingHorizontal: S.gutter }}
            />
            <View style={{ marginTop: S.xl }}>
              {featuredCollections.map((c, i) => (
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
                      {/* Serif, not Display: the collection names are the one
                          place the brand speaks in its own voice rather than
                          shouting a product claim — same weight web uses for
                          collection names (CollectionsRow.tsx). */}
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
              index={idx()}
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
            index={idx()}
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
                    <Mono color={C.clayDeep}>{a.tag.toUpperCase()}</Mono>
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

        {/* ── 06 · Voices ────────────────────────────────────────────────── */}
        {/* Silhouette hand-off: the ridge is drawn in the colour of the
            section BELOW it, so the light page appears to end at a skyline
            rather than at a straight edge. */}
        <Ridgeline height={72} color={C.ink} style={{ marginTop: S.section }} />
        <View style={s.inkBand}>
          <Topography width={SCREEN_W} height={420} color={C.sage} opacity={0.13} seed={9.1} originX={0.24} originY={0.6} />
          <SectionHead
            index={idx()}
            eyebrow="The trails"
            title="Where all of this is for."
            lede="Real routes across Uttarakhand — how high, how hard, and the season that makes them worth it."
            tone="onDark"
            style={{ paddingHorizontal: S.gutter }}
          />
          {/* Was a carousel of four invented customers ("Karan M.", "Priya S.")
              quoting products that no longer exist in the catalogue — fake
              social proof, and stale fake social proof at that. Replaced with
              the trail guide: real places, real seasons, and the actual reason
              this brand exists. When real reviews land, they belong here. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={RAIL_CARD_W + S.md}
            contentContainerStyle={s.rail}
            style={{ marginTop: S.xl }}
          >
            {TRAILS.slice(0, 5).map((t) => (
              <TouchableOpacity
                key={t.slug}
                activeOpacity={0.9}
                onPress={() => router.push(`/trails/${t.slug}`)}
                style={{ width: RAIL_CARD_W }}
              >
                <View style={[s.trailPlate, { height: Math.round(RAIL_CARD_W * 1.25) }]}>
                  <Image source={{ uri: t.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={260} alt="" />
                  <LinearGradient
                    colors={["rgba(12,18,15,0.05)", "rgba(12,18,15,0.82)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.trailFoot}>
                    <Mono color="rgba(255,255,255,0.72)">{t.altitude.toUpperCase()}</Mono>
                    <Title color={C.paper} style={{ marginTop: 3 }}>{t.name}</Title>
                  </View>
                </View>
                <Meta color="rgba(255,255,255,0.55)" style={{ marginTop: 10 }} numberOfLines={2}>
                  {t.season}
                </Meta>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => router.push("/trails")}
            activeOpacity={0.7}
            style={[s.guideLink, { marginHorizontal: S.gutter }]}
          >
            <Text style={s.guideLinkT}>Open the full trail guide</Text>
            <Icon name="arrow_forward" size={16} color={C.sage} />
          </TouchableOpacity>
        </View>

        {/* ── 07 · Colophon ──────────────────────────────────────────────── */}
        <View style={[s.section, { paddingHorizontal: S.gutter }]}>
          <SectionHead index={idx()} eyebrow="Colophon" title="Made where it's tested." />
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
      </Animated.ScrollView>

      {/* ── Masthead, floating ──────────────────────────────────────────────
          Outside the scroll view and pinned, so the wordmark stays put while
          the issue moves under it. Two copies stacked and cross-faded: the
          on-dark one reads over the hero photograph, the paper one takes over
          once the hero has gone. Cross-fading two real mastheads beats
          animating a colour, because every glyph, rule and badge changes
          together and the whole thing runs on the UI thread.
          `box-none` so only the buttons themselves take touches — the bar's
          empty space must not block the hero's CTAs underneath. ─────────── */}
      <Animated.View style={[s.head, darkHeadStyle]} pointerEvents="box-none">
        {/* The masthead carries its own scrim rather than trusting the
            photograph. A hero image is art-directed for its lower half, where
            the headline sits; the top is whatever the sky was that day, and on
            this one it is near-white cloud. Without this the mono dateline
            disappeared completely. A short top-down ramp costs nothing and
            makes the bar legible over any image that ever ships here. */}
        <LinearGradient
          colors={["rgba(12,18,15,0.62)", "rgba(12,18,15,0.28)", "rgba(12,18,15,0)"]}
          locations={[0, 0.6, 1]}
          style={s.headScrim}
          pointerEvents="none"
        />
        <Masthead tone="onDark" />
      </Animated.View>
      <Animated.View style={[s.head, paperHeadStyle]} pointerEvents="box-none">
        <Masthead />
      </Animated.View>
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
  trailPlate: { borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  trailFoot: { position: "absolute", left: 12, right: 12, bottom: 12 },
  guideLink: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: S.xl },
  guideLinkT: { fontFamily: F.bodyBold, fontSize: 13, letterSpacing: 0.2, color: C.sage },
  heroRule: { width: 46, height: 2, backgroundColor: C.sage },
  root: { flex: 1, backgroundColor: C.paper },
  head: { position: "absolute", top: 0, left: 0, right: 0 },
  headScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: -28 },

  hero: { justifyContent: "flex-end", backgroundColor: C.ink },
  heroTop: { position: "absolute", top: S.md, left: S.gutter },
  heroBody: { padding: S.gutter, paddingBottom: S.xl },
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
  // rgba of the CURRENT ink. This was rgba(23,35,29,…) — the v5 ink — while
  // every other scrim on the screen was already rgba(12,18,15,…).
  blankTag: { position: "absolute", left: 8, top: 8, backgroundColor: "rgba(12,18,15,0.72)", paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: R.tag },
  blankTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1, color: C.paper },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 },
  dot: { width: 11, height: 11, borderRadius: 999, borderWidth: 1, borderColor: C.ruleMed },
  dotOff: { opacity: 0.3 },

  articleFrame: { width: "100%", aspectRatio: 3 / 2, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  articleTag: { position: "absolute", left: 10, top: 10, backgroundColor: "rgba(12,18,15,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.tag },
  articleTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },
  articleRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  articleThumb: { width: 76, height: 76, borderRadius: R.card, backgroundColor: C.sand },

  inkBand: { backgroundColor: C.ink, paddingTop: S.block, paddingBottom: S.band, overflow: "hidden" },

  colophonLinks: { marginTop: S.xl },
  colophonRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
});
