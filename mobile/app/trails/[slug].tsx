import { useWindowDimensions, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { Img as Image } from "@/components/ui/Img";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionHead } from "@/components/editorial/SectionHead";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Rule } from "@/components/editorial/Rule";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/Button";
import { Body, BodyLarge, Display1, Meta, Micro, Mono, Title } from "@/components/ui/Type";
import { MonthStrip } from "@/components/trails/MonthStrip";
import { TRAILS } from "@/lib/trails";
import { C, R, S } from "@/lib/theme";


// One trail, in full. Reference content — nothing here is for sale, and the
// only outbound action is to the shop, phrased as "what to carry" rather than
// a product pitch, because arriving at a guide and being sold to is exactly
// what makes a brand's editorial content feel dishonest.
export default function TrailDetailScreen() {
  const { height: SCREEN_H } = useWindowDimensions();
  const HERO_H = Math.round(SCREEN_H * 0.46);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const trail = TRAILS.find((t) => t.slug === slug);

  if (!trail) {
    return (
      <View style={s.root}>
        <StatusBar style="dark" />
        <EmptyState
          icon="explore_off"
          title="Trail not found"
          body="That guide entry doesn't exist."
          ctaLabel="Back to the guide"
          onPress={() => router.replace("/trails")}
        />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.section }}>
        {/* Hero */}
        <View style={[s.hero, { height: HERO_H }]}>
          <Image source={{ uri: trail.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} alt="" />
          <LinearGradient
            colors={["rgba(12,18,15,0.55)", "rgba(12,18,15,0.05)", "rgba(12,18,15,0.90)"]}
            locations={[0, 0.38, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[s.back, { top: insets.top + 6 }]}>
            <IconButton name="arrow_back" onPress={() => goBack("/trails")} tone="glass" />
          </View>
          <View style={s.heroFoot}>
            <Mono color="rgba(255,255,255,0.78)">{trail.region.toUpperCase()}</Mono>
            <Display1 color={C.paper} style={{ marginTop: 8 }}>
              {trail.name}
            </Display1>
          </View>
        </View>

        {/* Facts */}
        <View style={s.block}>
          <SpecTable
            rows={[
              { key: "Altitude", value: trail.altitude },
              { key: "Difficulty", value: trail.difficulty },
              { key: "On foot", value: trail.duration },
              { key: "Base", value: trail.base },
            ]}
          />
        </View>

        {/* Why */}
        <View style={s.block}>
          <BodyLarge color={C.ink}>{trail.why}</BodyLarge>
        </View>

        <Rule weight="soft" style={{ marginHorizontal: S.gutter }} />

        {/* Season */}
        <View style={s.block}>
          <MonthStrip months={trail.bestMonths} />
          <Body color={C.textMid} style={{ marginTop: S.md }}>
            {trail.season}
          </Body>
        </View>

        <Rule weight="soft" style={{ marginHorizontal: S.gutter }} />

        {/* Sights */}
        <View style={s.block}>
          <SectionHead eyebrow="Along the way" title="What you pass." />
          <View style={{ marginTop: S.lg, gap: S.md }}>
            {trail.sights.map((sight) => (
              <View key={sight.name} style={s.sight}>
                <View style={s.dot} />
                <View style={{ flex: 1 }}>
                  <Title>{sight.name}</Title>
                  <Body color={C.textMid} style={{ marginTop: 3 }}>
                    {sight.note}
                  </Body>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Restrictions are never collapsed or footnoted. */}
        {trail.access ? (
          <View style={[s.block, { paddingTop: 0 }]}>
            <View style={s.access}>
              <Micro color={C.clayDeep}>BEFORE YOU GO</Micro>
              <Body color={C.ink} style={{ marginTop: 6 }}>
                {trail.access}
              </Body>
            </View>
          </View>
        ) : null}

        <Rule weight="soft" style={{ marginHorizontal: S.gutter }} />

        <View style={s.block}>
          <Meta color={C.textMuted}>
            Everything we make is tested on trails like this one.
          </Meta>
          <Button
            title="What to carry"
            variant="outline"
            size="md"
            onPress={() => router.push("/(tabs)/shop")}
            style={{ marginTop: S.md }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  hero: { backgroundColor: C.sand },
  back: { position: "absolute", left: S.gutter },
  heroFoot: { position: "absolute", left: S.gutter, right: S.gutter, bottom: S.xl },
  block: { paddingHorizontal: S.gutter, paddingVertical: S.xl },
  sight: { flexDirection: "row", gap: S.sm },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.sage, marginTop: 8 },
  access: {
    borderLeftWidth: 2,
    borderLeftColor: C.clay,
    backgroundColor: C.clay12,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    borderRadius: R.tag,
  },
});
