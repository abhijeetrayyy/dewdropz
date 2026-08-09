import { useState } from "react";
import { Dimensions, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "@/components/ui/IconButton";
import { OverlayHeader } from "@/components/editorial/OverlayHeader";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { EmptyState } from "@/components/ui/EmptyState";
import { BodyLarge, Display1, Mono, Title } from "@/components/ui/Type";
import { JOURNAL, formatArticleDate, journalById } from "@/lib/editorial";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");
const PLATE_H = Math.round(SCREEN_H * 0.44);

// The reader. This is the one screen in the app where typography is the entire
// interface, so it gets the widest measure, the largest body size (17/28), and
// nothing else competing:
//
//   • The first paragraph is a lede — larger, ink, no indent.
//   • Subsequent paragraphs are set at reading size with a real first-line
//     indent instead of paragraph spacing, which is how print actually does
//     continuous prose.
//   • A drop-cap-ish mono paragraph index runs down the left margin, matching
//     the numbered furniture used everywhere else in the app.
export default function JournalArticleScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = journalById(id ?? "");
  // Threshold flip rather than a per-frame value: the header only has two
  // states, so this re-renders twice for the whole screen.
  const [scrolled, setScrolled] = useState(false);

  if (!article) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 20, paddingHorizontal: S.gutter }]}>
        <IconButton name="arrow_back" onPress={() => router.back()} />
        <EmptyState
          eyebrow="Not found"
          title="That story isn't here."
          body="It may have been unpublished or the link is out of date."
          ctaLabel="Back to the journal"
          ctaHref="/journal"
          style={{ marginTop: S.xl }}
        />
      </View>
    );
  }

  const [lede, ...paragraphs] = article.body;
  const more = JOURNAL.filter((a) => a.id !== article.id);

  return (
    <View style={s.root}>
      {/* Follows the header: light glyphs over the dark plate, dark once the
          paper bar takes over — otherwise the clock is white-on-cream. */}
      <StatusBar style={scrolled ? "dark" : "light"} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: S.section }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > PLATE_H - 100;
          if (past !== scrolled) setScrolled(past);
        }}
      >
        {/* ── Plate ───────────────────────────────────────────────────────── */}
        <View style={[s.plate, { height: PLATE_H }]}>
          <Image source={{ uri: article.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={280} alt="" />
          <LinearGradient
            colors={["rgba(12,18,15,0.55)", "rgba(12,18,15,0.1)", "rgba(12,18,15,0.55)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.plateFoot}>
            <View style={s.plateTag}>
              <Text style={s.plateTagT}>{article.tag.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Byline block ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.xl }}>
          <Display1>{article.title}</Display1>

          <Rule weight="ink" style={{ marginTop: S.lg }} />
          <View style={s.byline}>
            <View style={{ flex: 1 }}>
              <Mono color={C.textMuted}>WORDS</Mono>
              <Title style={{ marginTop: 4 }}>{article.author}</Title>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Mono color={C.textMuted}>{formatArticleDate(article.date).toUpperCase()}</Mono>
              <Mono color={C.textFaint} style={{ marginTop: 4 }}>
                {article.readTime.toUpperCase()}
              </Mono>
            </View>
          </View>
          <Rule weight="soft" />

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <Text style={s.lede}>{lede}</Text>

          {paragraphs.map((para, i) => (
            <View key={i} style={s.paraRow}>
              <Text style={s.paraNum}>{String(i + 2).padStart(2, "0")}</Text>
              <BodyLarge color={C.textMid} style={{ flex: 1 }}>
                {para}
              </BodyLarge>
            </View>
          ))}

          {/* ── End mark ──────────────────────────────────────────────────── */}
          <View style={s.endMark} />

          <TouchableOpacity
            style={s.share}
            activeOpacity={0.7}
            onPress={() => {
              haptics.tap();
              Share.share({ message: `${article.title} — DEWDROPZ Journal` });
            }}
          >
            <Icon name="ios_share" size={18} color={C.ink} />
            <Text style={s.shareT}>Share this story</Text>
          </TouchableOpacity>

          {/* ── Keep reading ──────────────────────────────────────────────── */}
          <View style={{ marginTop: S.section }}>
            <Mono color={C.textMuted}>KEEP READING</Mono>
            <Rule weight="ink" style={{ marginTop: 9 }} />
            {more.map((a) => (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.7}
                onPress={() => {
                  haptics.tap();
                  router.replace(`/journal/${a.id}`);
                }}
              >
                <View style={s.moreRow}>
                  <Image source={{ uri: a.image }} style={s.moreThumb} contentFit="cover" alt="" />
                  <View style={{ flex: 1 }}>
                    <Mono color={C.clay}>{a.tag.toUpperCase()}</Mono>
                    <Title style={{ marginTop: 5 }} numberOfLines={2}>
                      {a.title}
                    </Title>
                  </View>
                  <Icon name="arrow_forward" size={18} color={C.faintIcon} />
                </View>
                <Rule weight="soft" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <OverlayHeader
        scrolled={scrolled}
        title={article.title}
        onBack={() => router.back()}
        renderRight={(tone) => (
          <IconButton
            name="ios_share"
            tone={tone}
            onPress={() => Share.share({ message: `${article.title} — DEWDROPZ Journal` })}
          />
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  plate: { backgroundColor: C.ink, justifyContent: "flex-end" },
  plateFoot: { padding: S.gutter },
  plateTag: { alignSelf: "flex-start", backgroundColor: "rgba(12,18,15,0.6)", borderRadius: R.tag, paddingHorizontal: 8, paddingVertical: 4 },
  plateTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },

  byline: { flexDirection: "row", alignItems: "flex-start", gap: S.md, paddingVertical: S.md },

  // The lede is ink and one step larger than the body — the paragraph that
  // has to earn the next four.
  lede: { fontFamily: F.body, fontSize: 19, lineHeight: 30, color: C.ink, marginTop: S.xl, letterSpacing: -0.2 },
  paraRow: { flexDirection: "row", gap: S.md, marginTop: S.xl },
  // Hanging paragraph index in the left margin, same convention as IndexList.
  paraNum: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.textFaint, width: 20, marginTop: 9 },

  // A printer's end mark — the little filled square that closes a feature.
  endMark: { width: 9, height: 9, backgroundColor: C.ink, marginTop: S.block, marginLeft: 36 },

  share: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: S.block },
  shareT: { fontFamily: F.bodySemiBold, fontSize: 15, color: C.ink },

  moreRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  moreThumb: { width: 60, height: 72, borderRadius: R.card, backgroundColor: C.sand },
});
