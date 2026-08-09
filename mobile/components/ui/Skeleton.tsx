import { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { C, R, S } from "@/lib/theme";

// Loading placeholders shaped like the thing that's coming, not like generic
// grey bars. The product-grid skeleton mirrors ProductCard's exact caption
// block (eyebrow / name / price) so the layout doesn't jump when data lands —
// v4's skeleton was a 3:4 box plus two bars, and the real card is 4:5 plus
// three lines, so every list visibly reflowed on load.

type Props = { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle };

export function Skeleton({ width = "100%", height = 14, radius = R.tag, style }: Props) {
  const o = useSharedValue(0.45);

  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.9, { duration: 720 }), withTiming(0.45, { duration: 720 })), -1, true);
  }, [o]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: o.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: C.sand }, animatedStyle, style]} />;
}

export function SkeletonProductCard({ width }: { width?: number }) {
  return (
    <View style={width ? { width } : { width: "48%" }}>
      <Skeleton height={undefined} style={{ aspectRatio: 4 / 5, width: "100%" }} radius={R.card} />
      <View style={{ marginTop: 11, gap: 6 }}>
        <Skeleton height={9} width="45%" />
        <Skeleton height={14} width="85%" />
        <Skeleton height={11} width="35%" />
      </View>
    </View>
  );
}

export function SkeletonProductGrid({ count = 4 }: { count?: number }) {
  return (
    <View style={s.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </View>
  );
}

/** Matches the ruled list rows used on Orders, Saved, Search results. */
export function SkeletonRows({ count = 4, height = 76 }: { count?: number; height?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: C.ruleHair }]}>
          <Skeleton width={64} height={height} radius={R.card} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={9} width="30%" />
            <Skeleton height={15} width="70%" />
            <Skeleton height={11} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl },
  row: { flexDirection: "row", gap: S.md, paddingVertical: S.md },
});
