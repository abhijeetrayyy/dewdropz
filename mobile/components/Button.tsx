import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { C, F, M, R, SHADOW_CTA } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/ui/Icon";

// Five variants, each with exactly one job — the discipline that keeps the
// ember accent meaningful:
//
//   primary   ember pill, elevated  — buy actions ONLY (add to pack, pay)
//   dark      ink pill              — the second-most-important action
//   quiet     cream pill            — tertiary (track, buy again, clear)
//   outline   ruled, transparent    — sits on photography or colored bands
//   link      text + arrow, no fill — inline navigation
//
// v4 had `secondary`/`outline`/`ghost` all collapsing to the same white pill,
// which meant three names for one look and no way to express a real hierarchy
// when a screen needed two buttons side by side.

type Variant = "primary" | "dark" | "quiet" | "outline" | "link";

type Props = {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: string;
  /** Icon after the label instead of before — for "continue"-style actions. */
  iconRight?: string;
  /** Right-aligned secondary text inside the pill, e.g. a price. */
  trailing?: string;
  size?: "md" | "lg";
  onPress: () => void;
  style?: ViewStyle;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// `secondary`/`ghost` are v4 names still present at a few call sites.
const ALIASES: Record<string, Variant> = { secondary: "quiet", ghost: "link" };

export function Button({
  title,
  loading,
  disabled,
  variant = "primary",
  icon,
  iconRight,
  trailing,
  size = "lg",
  onPress,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const isDisabled = loading || disabled;
  const v = (ALIASES[variant] ?? variant) as Variant;

  const bg =
    v === "primary" ? C.forest : v === "dark" ? C.ink : v === "quiet" ? C.creamDeep : "transparent";
  const fg = v === "primary" || v === "dark" ? C.white : C.ink;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (v === "link") {
    return (
      <Pressable
        onPress={() => {
          if (isDisabled) return;
          haptics.select();
          onPress();
        }}
        disabled={isDisabled}
        style={[s.link, isDisabled && { opacity: 0.5 }, style]}
      >
        {icon ? <Icon name={icon} size={18} color={C.ink} /> : null}
        <Text style={s.linkText}>{title}</Text>
        <Icon name={iconRight ?? "arrow_forward"} size={17} color={C.ink} />
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={() => (scale.value = withTiming(0.975, { duration: M.fast }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: M.base }))}
      disabled={isDisabled}
      style={[
        s.base,
        size === "lg" ? s.lg : s.md,
        { backgroundColor: bg },
        v === "outline" && s.outline,
        v === "primary" && !isDisabled && SHADOW_CTA,
        isDisabled && { opacity: 0.45 },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={[s.label, size === "md" && s.labelMd, { color: fg }]}>{title}</Text>
          {trailing ? (
            <>
              {/* A hairline divider rather than a gap, so "Pay · ₹2,340" reads
                  as one control with two parts instead of two labels that
                  happen to share a pill. */}
              <View style={[s.trailingRule, { backgroundColor: fg, opacity: 0.28 }]} />
              <Text style={[s.trailing, { color: fg }]}>{trailing}</Text>
            </>
          ) : null}
          {iconRight ? <Icon name={iconRight} size={20} color={fg} /> : null}
        </>
      )}
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 26,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: { height: 54 },
  md: { height: 44, paddingHorizontal: 20 },
  outline: { borderWidth: 1.5, borderColor: C.ruleStrong },
  label: { fontFamily: F.bodyBold, fontSize: 16, letterSpacing: -0.1 },
  labelMd: { fontSize: 14 },
  trailingRule: { width: 1, height: 18, marginHorizontal: 2 },
  trailing: { fontFamily: F.monoBold, fontSize: 13, letterSpacing: 0.2 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 },
  linkText: { fontFamily: F.bodyBold, fontSize: 15, color: C.ink, letterSpacing: -0.1 },
});
