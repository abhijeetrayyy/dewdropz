import { ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { IconButton } from "@/components/ui/IconButton";
import { Topography } from "./Topography";
import { C, F, R, S } from "@/lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// One header, nine screens.
// ─────────────────────────────────────────────────────────────────────────────
// This used to render a paper bar with an ink title — correct, and the single
// biggest reason Settings, Saved, Orders, Notifications, Collections, Journal,
// Trails, About and Sustainability all looked like the same screen with
// different words. Nine surfaces, one flat cream rectangle.
//
// It is now an ink panel: contour texture behind, sage eyebrow, paper display
// title, and a rounded bottom edge so it reads as a plate the page hangs from
// rather than a bar stuck to the top. Because every pushed screen shares this
// component, changing it here re-skins all nine at once and they cannot drift
// apart later.
//
// `stats` is the other half of the idea. A header that can carry two or three
// real figures — pieces saved, orders on the way, trails in season — turns a
// title bar into a summary, which is the difference between decoration and
// information.
//
// Sticky mode (`scrollY`) collapses the large title into a compact bar title
// AND collapses its height, so the panel shrinks to a slim ink bar as you
// scroll instead of leaving a dead band behind.
// ─────────────────────────────────────────────────────────────────────────────

type Stat = { label: string; value: string };

type Props = {
  title: string;
  eyebrow?: string;
  lede?: string;
  /** Up to three figures shown along the bottom of the panel. */
  stats?: Stat[];
  /** Drives the large→compact cross-fade and the height collapse. */
  scrollY?: SharedValue<number>;
  onBack?: () => void;
  /** Rendered at the right of the control row. */
  right?: ReactNode;
  style?: ViewStyle;
};

/** Scroll distance over which the large title hands off to the bar title. */
const HANDOFF = 90;

export function ScreenHeader({ title, eyebrow, lede, stats, scrollY, onBack, right, style }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const largeStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const t = interpolate(scrollY.value, [0, HANDOFF], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * -12 }],
    };
  });

  const barTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [HANDOFF * 0.55, HANDOFF], [0, 1], Extrapolation.CLAMP) };
  });

  return (
    <View style={[s.panel, { paddingTop: insets.top + 6 }, style]}>
      {/* Contour texture, the same instrument-panel motif the season window and
          collection screens use. Anchored off-centre so it never reads as a
          symmetrical pattern. */}
      <Topography
        width={width}
        height={340}
        color={C.sage}
        opacity={0.14}
        lines={10}
        seed={6.4}
        originX={0.82}
        originY={0.2}
      />

      <View style={s.controls}>
        <IconButton
          name="arrow_back"
          tone="glass"
          accessibilityLabel="Back"
          onPress={onBack ?? (() => router.back())}
        />
        <Animated.View style={[s.barTitle, barTitleStyle]} pointerEvents="none">
          <Text style={s.barTitleText} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        <View style={s.right}>{right}</View>
      </View>

      <Animated.View style={[s.large, largeStyle]}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={s.title}>{title}</Text>
        {lede ? <Text style={s.lede}>{lede}</Text> : null}

        {stats && stats.length > 0 ? (
          <View style={s.stats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[s.stat, i > 0 && s.statDivided]}>
                <Text style={s.statValue} numberOfLines={1}>
                  {st.value}
                </Text>
                <Text style={s.statLabel} numberOfLines={1}>
                  {st.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: C.ink,
    overflow: "hidden",
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
    // The gap below the panel belongs to the panel, not to each screen.
    // The header this replaced ended in a hairline rule and its own padding,
    // so screens were written assuming the separation already existed and
    // none of the nine added any of their own. Against a hard rounded ink edge
    // that reads as content colliding with the header. Owning it here means
    // every screen gets the same gap and no screen can forget it.
    marginBottom: S.block,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: S.gutter,
    height: 44,
  },
  barTitle: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  barTitleText: { fontFamily: F.displayRegular, fontSize: 16, color: C.paper },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },

  large: { paddingHorizontal: S.gutter, paddingTop: S.md },
  eyebrow: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.9, color: C.sage, marginBottom: 9 },
  title: { fontFamily: F.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.2, color: C.paper },
  lede: { fontFamily: F.body, fontSize: 16, lineHeight: 25, color: "rgba(251,247,239,0.72)", marginTop: 10 },

  stats: { flexDirection: "row", marginTop: S.lg },
  stat: { flex: 1 },
  statDivided: { borderLeftWidth: 1, borderLeftColor: "rgba(251,247,239,0.14)", paddingLeft: S.md, marginLeft: S.md },
  statValue: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: C.paper },
  statLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, color: "rgba(251,247,239,0.5)", marginTop: 4 },
});
