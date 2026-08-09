import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { SectionHead } from "@/components/editorial/SectionHead";
import { IndexList } from "@/components/editorial/IndexList";
import { SpecTable } from "@/components/editorial/SpecTable";
import { PullQuote } from "@/components/editorial/PullQuote";
import { Figure } from "@/components/editorial/Figure";
import { Rule } from "@/components/editorial/Rule";
import { Button } from "@/components/Button";
import { Body, Mono } from "@/components/ui/Type";
import { SUSTAINABILITY_COMMITMENTS, SUSTAINABILITY_INTRO, SUSTAINABILITY_IMAGE } from "@/lib/editorial";
import { C, S } from "@/lib/theme";

// New on mobile. The web copy leads with an admission ("we're not a
// zero-impact company") rather than a claim, so the page opens on that as a
// pull quote — putting the caveat first is the whole reason the rest of the
// page is believable.
const FACTS = [
  { key: "Fabric sourced within", value: "200 km" },
  { key: "Typical batch size", value: "200–500 units" },
  { key: "Plastic polybags used", value: "None" },
  { key: "Repair guide included", value: "Every pack" },
];

export default function SustainabilityScreen() {
  return (
    <View style={s.root}>
      {/* These are paper screens pushed from dark-hero ones (product,
          collection, article). expo-status-bar is last-mount-wins, so
          without an explicit dark style here the light glyphs set by the
          pushing screen persist and the clock vanishes into the paper. */}
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: S.section }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Sustainability"
          title="What we'll actually claim."
          lede="No badges, no offsets we can't trace. Just the decisions behind how this gear gets made."
        />

        <View style={{ paddingHorizontal: S.gutter }}>
          <PullQuote quote={SUSTAINABILITY_INTRO} attribution="DEWDROPZ" />

          <Figure
            uri={SUSTAINABILITY_IMAGE}
            aspect={3 / 2}
            caption="Mill visits, not certificates — we've been to every one of them."
            credit="LUDHIANA · PANIPAT"
            style={{ marginTop: S.block }}
          />

          {/* ── The commitments ───────────────────────────────────────────── */}
          <View style={{ marginTop: S.section }}>
            <SectionHead
              index="01"
              eyebrow="The commitments"
              title="Four decisions we stand behind."
              size="d3"
            />
            <IndexList items={SUSTAINABILITY_COMMITMENTS} style={{ marginTop: S.sm }} />
          </View>

          {/* ── The facts ─────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.section }}>
            <SectionHead index="02" eyebrow="At a glance" title="The numbers." size="d3" />
            <Rule weight="soft" style={{ marginTop: S.md }} />
            <SpecTable rows={FACTS} />
            <Rule weight="soft" />
          </View>

          {/* ── What we're not claiming ───────────────────────────────────── */}
          <View style={{ marginTop: S.section }}>
            <SectionHead
              index="03"
              eyebrow="Still working on it"
              title="What we haven't solved."
              size="d3"
            />
            <Body color={C.textMid} style={{ marginTop: S.md }}>
              Our ripstop nylon is still virgin petroleum-based — recycled alternatives we&apos;ve tested haven&apos;t
              survived a monsoon ridge yet, and shipping a shell that fails is worse than shipping one that lasts a
              decade. We&apos;re re-testing every season and we&apos;ll say so here the moment that changes.
            </Body>
            <Body color={C.textMid} style={{ marginTop: S.md }}>
              Freight is the other one. Small batches mean more frequent shipments, and we haven&apos;t found an honest
              way to net that out yet.
            </Body>
          </View>

          <Rule weight="soft" style={{ marginTop: S.section }} />
          <View style={{ paddingTop: S.lg }}>
            <Mono color={C.textMuted}>QUESTIONS ABOUT ANY OF THIS?</Mono>
            <Button
              title="Read our story"
              variant="link"
              onPress={() => router.push("/about")}
              style={{ marginTop: S.sm }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
});
