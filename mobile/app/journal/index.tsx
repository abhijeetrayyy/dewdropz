import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Img as Image } from "@/components/ui/Img";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Editorial, Mono, Title } from "@/components/ui/Type";
import { JOURNAL, formatArticleDate } from "@/lib/editorial";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

// New on mobile. The web app has published a journal since launch and the app
// had no long-form content at all — which is the real reason it read as a
// catalogue rather than a brand.
//
// Structure is the oldest one in publishing: one lead story given the full
// width and a display headline, then the rest as ruled rows. Making every
// article equally sized is what makes a blog index look like a list of files.
export default function JournalIndexScreen() {
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  // How much room the floating header needs at the top of the scroll
  // content. The panel is out of the layout so its collapse cannot resize
  // this list mid-drag — see ScreenHeader. It reports its height here.
  const [headerH, setHeaderH] = useState(0);
  const [lead, ...rest] = JOURNAL;

  return (
    <View style={s.root}>
      <StatusCap />
      {/* These are paper screens pushed from dark-hero ones (product,
          collection, article). expo-status-bar is last-mount-wins, so
          without an explicit dark style here the light glyphs set by the
          pushing screen persist and the clock vanishes into the paper. */}
      <ScreenHeader
        eyebrow="The journal"
        title="Stories from the trail."
        lede="Field notes, packing guides, and the people who keep coming back to altitude."
        scrollY={scrollY}
        onHeight={setHeaderH}
      />

      <Animated.ScrollView contentContainerStyle={{ paddingTop: headerH, paddingBottom: S.section }} showsVerticalScrollIndicator={false} ref={scrollRef}>

        <View style={{ paddingHorizontal: S.gutter }}>
          {/* ── Lead ──────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(380)}>
            <TouchableOpacity
              activeOpacity={0.94}
              onPress={() => {
                haptics.tap();
                router.push(`/journal/${lead.id}`);
              }}
            >
              <View style={s.leadFrame}>
                <Image source={{ uri: lead.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={240} alt="" />
                <LinearGradient colors={["rgba(12,18,15,0.35)", "transparent"]} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
                <View style={s.leadTag}>
                  <Text style={s.leadTagT}>{lead.tag.toUpperCase()}</Text>
                </View>
              </View>

              <Mono color={C.textMuted} style={{ marginTop: 16 }}>
                LATEST · {lead.author.toUpperCase()} · {lead.readTime.toUpperCase()}
              </Mono>
              <Editorial style={{ marginTop: 10 }}>{lead.title}</Editorial>
              <Body color={C.textMid} style={{ marginTop: 10 }}>
                {lead.excerpt}
              </Body>
              <View style={s.readRow}>
                <Text style={s.readT}>Read the story</Text>
                <Icon name="arrow_forward" size={17} color={C.ink} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── The rest ──────────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block }}>
            <Mono color={C.textMuted}>MORE STORIES</Mono>
            <Rule weight="ink" style={{ marginTop: 9 }} />

            {rest.map((a, i) => (
              <Animated.View key={a.id} entering={FadeInDown.delay((i + 1) * 70).duration(380)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.tap();
                    router.push(`/journal/${a.id}`);
                  }}
                  style={s.row}
                >
                  <View style={{ flex: 1 }}>
                    <Mono color={C.clayDeep}>{a.tag.toUpperCase()}</Mono>
                    <Title style={{ marginTop: 7 }}>{a.title}</Title>
                    <Body color={C.textMid} style={{ marginTop: 6 }} numberOfLines={2}>
                      {a.excerpt}
                    </Body>
                    <Mono color={C.textFaint} style={{ marginTop: 9 }}>
                      {formatArticleDate(a.date).toUpperCase()} · {a.readTime.toUpperCase()}
                    </Mono>
                  </View>
                  <Image source={{ uri: a.image }} style={s.thumb} contentFit="cover" transition={200} alt="" />
                </TouchableOpacity>
                <Rule weight="soft" />
              </Animated.View>
            ))}
          </View>

          <Mono color={C.textFaint} style={{ marginTop: S.block }}>
            NEW FIELD NOTES ROUGHLY EVERY SIX WEEKS
          </Mono>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  leadFrame: { width: "100%", aspectRatio: 3 / 2, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  leadTag: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(12,18,15,0.6)",
    borderRadius: R.tag,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leadTagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper },
  readRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.md },
  readT: { fontFamily: F.bodyBold, fontSize: 15, color: C.ink },
  row: { flexDirection: "row", alignItems: "flex-start", gap: S.md, paddingVertical: S.lg },
  thumb: { width: 92, height: 108, borderRadius: R.card, backgroundColor: C.sand },
});
