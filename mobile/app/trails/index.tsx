import { useMemo, useRef, useState } from "react";
import { useWindowDimensions, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Img as Image } from "@/components/ui/Img";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Display3, Meta, Mono } from "@/components/ui/Type";
import { MonthStrip } from "@/components/trails/MonthStrip";
import { MonthFilter } from "@/components/trails/MonthFilter";
import { AltitudeProfile } from "@/components/trails/AltitudeProfile";
import { EmptyState } from "@/components/ui/EmptyState";
import { MONTHS, TRAILS, altitudeMeters, currentMonth } from "@/lib/trails";
import { haptics } from "@/lib/haptics";
import { C, R, S } from "@/lib/theme";


// The trail guide, on the phone. Deliberately NOT a shop screen: no prices, no
// cart, nothing to buy. It's the reference half of the brand — the reason the
// gear exists — and giving it its own space is what stops the app from reading
// as a catalogue with a logo on it.
//
// It was a vertical list of eight cards. Every card carried the two numbers a
// walker actually decides on — how high, and when — and rendered both as prose,
// so comparing trails meant scrolling and holding figures in your head. It read
// as a blog, not a guide.
//
// Now it opens as a reference instrument:
//
//   • an altitude profile of the whole range, low to high, tappable
//   • a month filter that answers "what can I walk in October?" — the actual
//     first question, and one this data answers exactly
//   • the cards below, ordered by altitude so the list agrees with the profile
//
// It defaults to the CURRENT month. A guide that opens on "all eight" has
// answered nothing; opening on "these four, this month" is a position.
export default function TrailsScreen() {
  const { width: SCREEN_W } = useWindowDimensions();
  const CARD_H = Math.round((SCREEN_W - S.gutter * 2) * 0.62);
  const [month, setMonth] = useState<string | null>(currentMonth);
  // useScrollOffset reads the scroll position straight off the view rather
  // than writing to a shared value from a handler — same sticky-header effect,
  // but nothing mutates a hook's return value.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const pressed = useRef(false);

  // The profile always draws the full range — filtering it would change the
  // shape of the mountains under your finger, which is exactly the thing a
  // reference graphic must not do. Out-of-season trails recede instead.
  const byAltitude = useMemo(() => [...TRAILS].sort((a, b) => altitudeMeters(a) - altitudeMeters(b)), []);

  const walkable = useMemo(
    () => (month ? TRAILS.filter((t) => t.bestMonths.includes(month)) : TRAILS),
    [month],
  );
  const walkableSlugs = useMemo(() => new Set(walkable.map((t) => t.slug)), [walkable]);
  const dimmed = useMemo(
    () => new Set(TRAILS.filter((t) => !walkableSlugs.has(t.slug)).map((t) => t.slug)),
    [walkableSlugs],
  );

  // How busy the range is, month by month — shown on the filter chips.
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const m of MONTHS) acc[m] = TRAILS.filter((t) => t.bestMonths.includes(m)).length;
    return acc;
  }, []);

  // The list follows the profile's order so the two agree.
  const listed = useMemo(
    () => [...walkable].sort((a, b) => altitudeMeters(a) - altitudeMeters(b)),
    [walkable],
  );

  function open(slug: string) {
    if (pressed.current) return;
    pressed.current = true;
    haptics.select();
    router.push(`/trails/${slug}`);
    setTimeout(() => (pressed.current = false), 400);
  }

  return (
    <View style={s.root}>
      <StatusCap />
      <ScreenHeader
        title="Trail guide"
        eyebrow="Uttarakhand"
        lede="Where they are, how high they go, and when they're actually worth walking."
        stats={[
          { label: month ? `In ${month}` : "All year", value: String(listed.length) },
          { label: "Highest", value: TRAILS.reduce((hi, t) => (altitudeMeters(t) > altitudeMeters(hi) ? t : hi), TRAILS[0]).altitude },
          // NOT "Uttarakhand" — the eyebrow directly above already says it, and
          // at a third of the panel width it truncated to "Uttara…". A stat
          // slot is only worth having if it holds a short, non-redundant figure.
          { label: "In the guide", value: String(TRAILS.length) },
        ]}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.section }}
      >
        <AltitudeProfile trails={byAltitude} dimmed={dimmed} onSelect={open} />

        <Rule weight="soft" style={{ marginHorizontal: S.gutter, marginTop: S.lg }} />

        <View style={{ paddingTop: S.lg }}>
          <Mono color={C.textMuted} style={{ paddingHorizontal: S.gutter, marginBottom: S.sm }}>
            WHEN ARE YOU FREE?
          </Mono>
          <MonthFilter value={month} counts={counts} onChange={setMonth} />
        </View>

        <View style={s.stateRow}>
          <Mono color={C.textMuted}>
            {listed.length} {listed.length === 1 ? "TRAIL" : "TRAILS"}
            {month ? ` IN ${month.toUpperCase()}` : " · ALL YEAR"}
          </Mono>
          <Mono color={C.textFaint}>LOW → HIGH</Mono>
        </View>
        <Rule weight="ink" style={{ marginHorizontal: S.gutter }} />

        {listed.length === 0 ? (
          <View style={{ paddingHorizontal: S.gutter }}>
            <EmptyState
              eyebrow="Out of season"
              title="Nothing worth walking this month."
              body="The high routes are snow-bound and the valleys are under monsoon. Pick another month — or read ahead."
              ctaLabel="Show every trail"
              onPress={() => setMonth(null)}
            />
          </View>
        ) : null}

        {listed.map((t, i) => (
          <Animated.View key={t.slug} entering={FadeInDown.delay(Math.min(i, 6) * 55).duration(380)}>
            <Pressable onPress={() => open(t.slug)} style={({ pressed: p }) => [s.card, p && { opacity: 0.9 }]}>
              <View style={[s.plate, { height: CARD_H }]}>
                <Image source={{ uri: t.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={280} alt="" />
                <LinearGradient
                  colors={["rgba(12,18,15,0.10)", "rgba(12,18,15,0.00)", "rgba(12,18,15,0.86)"]}
                  locations={[0, 0.35, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.plateTop}>
                  <Mono color="rgba(255,255,255,0.78)">{String(i + 1).padStart(2, "0")}</Mono>
                  <View style={s.diffPill}>
                    <Meta color={C.paper}>{t.difficulty}</Meta>
                  </View>
                </View>
                <View style={s.plateFoot}>
                  <Display3 color={C.paper}>{t.name}</Display3>
                  <Mono color="rgba(255,255,255,0.75)" style={{ marginTop: 5 }}>
                    {t.altitude.toUpperCase()} · {t.region.toUpperCase()}
                  </Mono>
                </View>
              </View>

              <View style={s.body}>
                <MonthStrip months={t.bestMonths} />
                <Body color={C.textMid} style={{ marginTop: S.md }} numberOfLines={3}>
                  {t.why}
                </Body>
                <View style={s.more}>
                  <Meta color={C.forest}>Read the guide</Meta>
                  <Icon name="arrow_forward" size={15} color={C.forest} />
                </View>
              </View>
            </Pressable>
            {i < listed.length - 1 && <Rule weight="soft" style={{ marginHorizontal: S.gutter }} />}
          </Animated.View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  stateRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: S.gutter, paddingTop: S.block, paddingBottom: S.sm,
  },
  card: { paddingHorizontal: S.gutter, paddingTop: S.xl, paddingBottom: S.block },
  plate: { borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  plateTop: {
    position: "absolute", top: S.md, left: S.md, right: S.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  diffPill: {
    backgroundColor: "rgba(12,18,15,0.55)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.tag,
  },
  plateFoot: { position: "absolute", left: S.md, right: S.md, bottom: S.md },
  body: { marginTop: S.lg },
  more: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.md },
});
