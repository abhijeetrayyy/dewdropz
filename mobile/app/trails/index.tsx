import { useRef } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Display3, Meta, Mono } from "@/components/ui/Type";
import { MonthStrip } from "@/components/trails/MonthStrip";
import { TRAILS } from "@/lib/trails";
import { haptics } from "@/lib/haptics";
import { C, R, S } from "@/lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_H = Math.round((SCREEN_W - S.gutter * 2) * 0.62);

// The trail guide, on the phone. Deliberately NOT a shop screen: no prices, no
// cart, nothing to buy. It's the reference half of the brand — the reason the
// gear exists — and giving it its own space is what stops the app from reading
// as a catalogue with a logo on it.
//
// Each card leads with the month strip rather than the photograph's caption,
// because season is the one thing that decides whether a trail is a good idea
// at all, and it's the first question anyone asks.
export default function TrailsScreen() {
  // useScrollOffset reads the scroll position straight off the view rather
  // than writing to a shared value from a handler — same sticky-header effect,
  // but nothing mutates a hook's return value.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const pressed = useRef(false);

  function open(slug: string) {
    if (pressed.current) return;
    pressed.current = true;
    haptics.select();
    router.push(`/trails/${slug}`);
    setTimeout(() => (pressed.current = false), 400);
  }

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ScreenHeader
        title="Trail guide"
        eyebrow="Uttarakhand"
        lede="Where they are, how high they go, and when they're actually worth walking."
        scrollY={scrollY}
      />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.section }}
      >
        {TRAILS.map((t, i) => (
          <Animated.View key={t.slug} entering={FadeInDown.delay(Math.min(i, 6) * 55).springify().damping(18)}>
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
            {i < TRAILS.length - 1 && <Rule weight="soft" style={{ marginHorizontal: S.gutter }} />}
          </Animated.View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
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
