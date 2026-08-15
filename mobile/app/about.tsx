import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { SectionHead } from "@/components/editorial/SectionHead";
import { IndexList } from "@/components/editorial/IndexList";
import { StatBand } from "@/components/editorial/StatBand";
import { PullQuote } from "@/components/editorial/PullQuote";
import { Figure } from "@/components/editorial/Figure";
import { Rule } from "@/components/editorial/Rule";
import { Button } from "@/components/Button";
import { Body, BodyLarge, Mono } from "@/components/ui/Type";
import {
  FOUNDER_QUOTE,
  PHILOSOPHY_VALUES,
  SITE,
  STORY_IMAGE,
  TIMELINE,
} from "@/lib/editorial";
import { C, S } from "@/lib/theme";

// New on mobile. Mirrors the web /about page's sequence — story, stats,
// founder note, values, timeline, sustainability link — which is a well-built
// narrative that mobile simply never had access to.
export default function AboutScreen() {
  return (
    <View style={s.root}>
      <StatusCap />
      {/* These are paper screens pushed from dark-hero ones (product,
          collection, article). expo-status-bar is last-mount-wins, so
          without an explicit dark style here the light glyphs set by the
          pushing screen persist and the clock vanishes into the paper. */}
      <ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Our story"
          title="Built on a foggy ridgeline."
          lede="DEWDROPZ started as three trekking guides fixing the gear that kept failing their clients. Seven years later, the philosophy hasn't moved an inch."
        />

        <View style={{ paddingHorizontal: S.gutter }}>
          <Figure
            uri={STORY_IMAGE}
            aspect={3 / 2}
            caption="The approach above Mussoorie, where most of it was decided."
            credit="UTTARAKHAND"
          />

          <BodyLarge color={C.textMid} style={{ marginTop: S.xl }}>
            We were guiding in the Garhwal Himalaya, watching people spend serious money on gear that gave up somewhere
            around day two. Packs that soaked through. Layers that held sweat. Caps that lost their shape in a week.
          </BodyLarge>
          <BodyLarge color={C.textMid} style={{ marginTop: S.md }}>
            So we started making the pieces we wished we could hand our clients at the trailhead — and we tested every
            one of them on the same routes we were already walking.
          </BodyLarge>

          {/* The "By the numbers" band lived here. Its four figures ("12,000+
              trekkers geared up", "40+ trails mapped") were invented, and an
              about page is the last place a brand should be guessing about
              itself — so it's gone rather than rounded down. The web app now
              takes these from store_settings.home_config; when real figures
              are entered there, this block comes back reading from the same
              source. */}

          {/* ── Founder ───────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.section }}>
            <SectionHead index="02" eyebrow="From the founder" title="Why any of this exists." size="d3" />
            <PullQuote
              quote={FOUNDER_QUOTE.quote}
              attribution={FOUNDER_QUOTE.name}
              role={FOUNDER_QUOTE.role}
              style={{ marginTop: S.xl }}
            />
          </View>

          {/* ── Values ────────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.section }}>
            <SectionHead
              index="03"
              eyebrow="What we hold to"
              title="Four things we don't trade away."
              size="d3"
            />
            <IndexList items={PHILOSOPHY_VALUES} style={{ marginTop: S.sm }} />
          </View>
        </View>

        {/* ── Timeline, on an ink band ──────────────────────────────────────── */}
        <View style={s.band}>
          <SectionHead
            index="04"
            eyebrow="The route so far"
            title="How we got here."
            tone="onDark"
            size="d3"
            style={{ paddingHorizontal: S.gutter }}
          />
          <IndexList
            items={TIMELINE.map((t) => ({ title: t.year, body: t.label }))}
            numbered={false}
            tone="onDark"
            style={{ paddingHorizontal: S.gutter, marginTop: S.sm }}
          />
        </View>

        {/* ── Onward ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.section }}>
          <SectionHead
            index="05"
            eyebrow="Next"
            title="Where the materials come from."
            lede="Every sourcing and manufacturing decision we're willing to put our name to, written plainly."
            size="d3"
          />
          <Button
            title="Read our commitments"
            variant="dark"
            onPress={() => router.push("/sustainability")}
            style={{ marginTop: S.xl, alignSelf: "flex-start" }}
          />

          <Rule weight="soft" style={{ marginTop: S.section }} />
          <View style={{ paddingTop: S.lg, gap: 6 }}>
            <Mono color={C.textMuted}>DEWDROPZ · EST. 2019</Mono>
            <Body color={C.textMid}>{SITE.address}</Body>
            <Mono color={C.textFaint}>{SITE.coords}</Mono>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  band: { backgroundColor: C.ink, marginTop: S.section, paddingVertical: S.band },
});
