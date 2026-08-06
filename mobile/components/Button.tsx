import { ActivityIndicator, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Pressable } from "react-native-gesture-handler";
import { C, F, R } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

type Props = {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ title, loading, disabled, variant = "primary", onPress }: Props) {
  const scale = useSharedValue(1);
  const isDisabled = loading || disabled;
  const bg = variant === "primary" ? C.forest : "transparent";
  const tx = variant === "primary" ? "#FFFFFF" : variant === "outline" ? C.text : C.forest;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
      disabled={isDisabled}
      style={[
        s.b,
        { backgroundColor: bg },
        variant === "outline" && { borderWidth: 1.5, borderColor: C.rule },
        variant === "ghost" && { paddingHorizontal: 0, minWidth: 0 },
        isDisabled && { opacity: 0.5 },
        animatedStyle,
      ]}
    >
      {loading ? <ActivityIndicator color={tx} size="small" /> : <Text style={[s.t, { color: tx }]}>{title}</Text>}
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  b: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: R.md, alignItems: "center", justifyContent: "center", minWidth: 120 },
  t: { fontFamily: F.bodyBold, fontSize: 14, letterSpacing: 0.6, fontWeight: "600" },
});
