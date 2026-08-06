import { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { C, R } from "@/lib/theme";

type Props = { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle };

export function Skeleton({ width = "100%", height = 16, radius = R.sm, style }: Props) {
  const o = useSharedValue(0.5);

  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1, true);
  }, [o]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: o.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: C.rule }, animatedStyle, style]} />;
}

export function SkeletonProductCard() {
  return (
    <View style={{ width: "48%", marginBottom: 24 }}>
      <Skeleton height={undefined} style={{ aspectRatio: 3 / 4, width: "100%" }} radius={R.sm} />
      <Skeleton height={13} width="80%" style={{ marginTop: 10 }} />
      <Skeleton height={13} width="40%" style={{ marginTop: 6 }} />
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

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 24 },
});
