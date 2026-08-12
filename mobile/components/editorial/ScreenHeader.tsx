import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { Rule } from "./Rule";
import { IconButton } from "@/components/ui/IconButton";
import { Display1, Eyebrow, Lede, Meta } from "@/components/ui/Type";
import { C, F, S } from "@/lib/theme";

// One header for every pushed screen, so back/title/action land in the same
// place on all 30 of them. v4 had each screen hand-roll its own row, which is
// why the back button sat at four different heights depending on where you
// came from.
//
// Two modes:
//   • static  — eyebrow + big Display1 title, sitting in the scroll
//   • sticky  — pass `scrollY` and the big title cross-fades into a compact
//               bar title as it scrolls under the status bar
//
// The compact bar is always mounted (not conditionally rendered) so the
// cross-fade runs on the UI thread with no re-render.

type Props = {
  title: string;
  eyebrow?: string;
  lede?: string;
  /** Drives the large→compact cross-fade. Omit for a static header. */
  scrollY?: SharedValue<number>;
  onBack?: () => void;
  /** Rendered at the right of the control row. */
  right?: ReactNode;
  style?: ViewStyle;
};

/** Scroll distance over which the large title hands off to the bar title. */
const HANDOFF = 56;

export function ScreenHeader({ title, eyebrow, lede, scrollY, onBack, right, style }: Props) {
  const insets = useSafeAreaInsets();

  const largeStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    return {
      opacity: interpolate(scrollY.value, [0, HANDOFF], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(scrollY.value, [0, HANDOFF], [0, -10], Extrapolation.CLAMP) }],
    };
  });

  const barTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [HANDOFF * 0.6, HANDOFF], [0, 1], Extrapolation.CLAMP) };
  });

  const barRuleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [HANDOFF * 0.6, HANDOFF], [0, 1], Extrapolation.CLAMP) };
  });

  return (
    <View style={[{ paddingTop: insets.top + 6, backgroundColor: C.paper }, style]}>
      <View style={s.controls}>
        <IconButton name="arrow_back" tone="quiet" onPress={onBack ?? (() => router.back())} />
        <Animated.View style={[s.barTitle, barTitleStyle]} pointerEvents="none">
          <Meta color={C.ink} numberOfLines={1} style={s.barTitleText}>
            {title}
          </Meta>
        </Animated.View>
        <View style={s.right}>{right}</View>
      </View>

      <Animated.View style={[s.large, largeStyle]}>
        {eyebrow ? <Eyebrow style={{ marginBottom: 8 }}>{eyebrow}</Eyebrow> : null}
        <Display1>{title}</Display1>
        {lede ? <Lede style={{ marginTop: 10 }}>{lede}</Lede> : null}
      </Animated.View>

      {scrollY ? (
        <Animated.View style={barRuleStyle}>
          <Rule weight="soft" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: S.gutter,
    height: 44,
  },
  // Absolutely positioned so the compact title is optically centred in the bar
  // regardless of how many controls sit on either side of it.
  barTitle: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  // Fraunces, matching Display1 above it — the large title cross-fades into
  // this one on scroll, and swapping typeface mid-fade would read as a glitch.
  barTitleText: { fontFamily: F.displayRegular, fontSize: 16 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  large: { paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: S.lg },
});
