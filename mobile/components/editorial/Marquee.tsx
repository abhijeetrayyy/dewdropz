import { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { C, F, S } from "@/lib/theme";

// The running band — a scrolling strip of short claims, set in mono with a
// diamond between each. Mirrors the web app's MarqueeBand so the two products
// share at least one piece of motion vocabulary.
//
// Implementation note: the strip is rendered twice and translated by exactly
// one strip's width, so the loop point is invisible. The width is measured on
// layout rather than estimated, because estimating it is how marquees end up
// with a visible stutter every cycle.

type Props = {
  items: string[];
  tone?: "ink" | "paper" | "meadow";
  speed?: number; // px per second
  style?: ViewStyle;
};

const TONES = {
  ink: { bg: C.ink, fg: C.paper, dot: C.marigold },
  paper: { bg: C.paperDeep, fg: C.ink, dot: C.ember },
  meadow: { bg: C.meadow, fg: C.paper, dot: C.marigold },
} as const;

export function Marquee({ items, tone = "ink", speed = 34, style }: Props) {
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const colors = TONES[tone];

  useEffect(() => {
    if (width.value === 0) return;
    const duration = (width.value / speed) * 1000;
    x.value = 0;
    x.value = withRepeat(withTiming(-width.value, { duration, easing: Easing.linear }), -1, false);
  }, [items, speed, width, x]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const strip = (key: string) => (
    <View
      key={key}
      style={s.strip}
      onLayout={
        key === "a"
          ? (e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && w !== width.value) {
                width.value = w;
                const duration = (w / speed) * 1000;
                x.value = 0;
                x.value = withRepeat(withTiming(-w, { duration, easing: Easing.linear }), -1, false);
              }
            }
          : undefined
      }
    >
      {items.map((item, i) => (
        <View key={`${key}-${i}`} style={s.item}>
          <View style={[s.diamond, { backgroundColor: colors.dot }]} />
          <Animated.Text style={[s.text, { color: colors.fg }]}>{item.toUpperCase()}</Animated.Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }, style]}>
      <Animated.View style={[s.track, animatedStyle]}>
        {strip("a")}
        {strip("b")}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: "hidden", paddingVertical: 13 },
  track: { flexDirection: "row" },
  strip: { flexDirection: "row", alignItems: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingRight: S.lg },
  // Rotated square rather than a bullet — reads as a typographic ornament
  // instead of a list marker.
  diamond: { width: 5, height: 5, transform: [{ rotate: "45deg" }] },
  text: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.6 },
});
