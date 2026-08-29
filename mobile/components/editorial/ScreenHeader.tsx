import { ReactNode, useState } from "react";
import { StyleSheet, Text, View, ViewStyle, useWindowDimensions } from "react-native";
import { goBack } from "@/lib/nav";
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

/**
 * FOUR HEADERS, NOT ONE.
 *
 * Every pushed screen shared a single ink panel. Seen together — and they are,
 * because a person moves between them in seconds — Collections, Saved, Orders,
 * Addresses, Designs, Notifications, Settings, About, Sustainability, Journal,
 * Trails and the gear locker were the same black slab with different words.
 * One component making twelve screens identical is not consistency, it is an
 * absence of design.
 *
 * So the panel takes a TONE, chosen by what kind of screen it is rather than
 * by decoration:
 *
 *   ink       the editorial voice — stories, guides, the company itself
 *   altitude  system and technical — notifications, settings (deep blue-black)
 *   forest    gear and the outdoors — the locker, rentals (deep green)
 *   warm      your own things — orders, saved, addresses, designs (light)
 *
 * `warm` is deliberately LIGHT. Three dark headers and one pale one reads as a
 * considered set; four dark ones would just be four slabs again.
 *
 * Every pairing below was measured, not eyeballed. paper-on-altitude is
 * 14.58:1, paper-on-forestDeep 12.84:1, ink-on-warmPaper 15.56:1, and the sage
 * eyebrow clears 4.5:1 on all three dark grounds. The combinations that failed
 * were dropped rather than nudged: clay as a ground gives 3.05:1 with paper
 * text, and sage on mid-forest is 3.63:1 — both unusable for text.
 */
export type HeaderTone = "ink" | "altitude" | "forest" | "warm";

const TONES: Record<HeaderTone, {
  ground: string; title: string; eyebrow: string; lede: string;
  statLabel: string; divider: string; texture: string; textureOpacity: number;
  button: "glass" | "quiet";
  /** Only the pale tone needs one: at 1.11:1 against the paper body it has no
   *  edge of its own and stops reading as a plate the page hangs from. */
  edge?: string;
}> = {
  ink: {
    ground: C.ink, title: C.paper, eyebrow: C.sage, lede: "rgba(251,247,239,0.72)",
    statLabel: "rgba(251,247,239,0.5)", divider: "rgba(251,247,239,0.14)",
    texture: C.sage, textureOpacity: 0.14, button: "glass",
  },
  altitude: {
    ground: C.altitude, title: C.paper, eyebrow: C.sage, lede: "rgba(251,247,239,0.74)",
    statLabel: "rgba(251,247,239,0.52)", divider: "rgba(251,247,239,0.16)",
    texture: "#4C7FA8", textureOpacity: 0.18, button: "glass",
  },
  forest: {
    ground: C.forestDeep, title: C.paper, eyebrow: C.sage, lede: "rgba(251,247,239,0.74)",
    statLabel: "rgba(251,247,239,0.52)", divider: "rgba(251,247,239,0.16)",
    texture: C.sage, textureOpacity: 0.2, button: "glass",
  },
  warm: {
    ground: C.warmPaper, title: C.ink, eyebrow: C.clayDeep, lede: C.textMid,
    statLabel: C.textMuted, divider: "rgba(138,90,63,0.22)",
    texture: C.clay, textureOpacity: 0.16, button: "quiet",
    edge: "rgba(138,90,63,0.20)",
  },
};

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
  /** Which of the four panel identities this screen belongs to. */
  tone?: HeaderTone;
  /** Tab roots have nothing behind them; a back arrow there is a dead control. */
  showBack?: boolean;
  style?: ViewStyle;
};

/** Scroll distance over which the large title hands off to the bar title. */
const HANDOFF = 90;

export function ScreenHeader({ title, eyebrow, lede, stats, scrollY, onBack, right, style, tone = "ink", showBack = true }: Props) {
  const t = TONES[tone];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // The panel has to give its HEIGHT back, not just fade.
  //
  // This animated opacity and nothing else, so a collapsed header left a tall
  // band of empty ink sitting under a one-line title — on the rental locker,
  // roughly a third of the screen showing nothing at all. The comment at the
  // top of this file claimed the height collapsed; it never did.
  //
  // The natural height is measured from an inner view that keeps its own size,
  // and the wrapper animates between that and zero. The measurement and the
  // animation sit on DIFFERENT views on purpose: animating the height of the
  // very element being measured would feed back into itself and oscillate.
  const [naturalH, setNaturalH] = useState(0);

  const largeStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const t = interpolate(scrollY.value, [0, HANDOFF], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * -12 }],
      ...(naturalH ? { height: naturalH * t } : null),
    };
  }, [naturalH]);

  const barTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [HANDOFF * 0.55, HANDOFF], [0, 1], Extrapolation.CLAMP) };
  });

  return (
    <View
      style={[
        s.panel,
        { paddingTop: insets.top + 6, backgroundColor: t.ground },
        t.edge ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.edge } : null,
        style,
      ]}
    >
      {/* Contour texture, the same instrument-panel motif the season window and
          collection screens use. Anchored off-centre so it never reads as a
          symmetrical pattern. */}
      <Topography
        width={width}
        height={340}
        color={t.texture}
        opacity={t.textureOpacity}
        lines={10}
        seed={6.4}
        originX={0.82}
        originY={0.2}
      />

      <View style={s.controls}>
        {showBack ? (
          <IconButton
            name="arrow_back"
            tone={t.button}
            accessibilityLabel="Back"
            onPress={onBack ?? (() => goBack())}
          />
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Animated.View style={[s.barTitle, barTitleStyle]} pointerEvents="none">
          <Text style={[s.barTitleText, { color: t.title }]} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        <View style={s.right}>{right}</View>
      </View>

      <Animated.View style={[s.large, largeStyle]}>
        <View
          style={s.largeInner}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            // Re-measure whenever the content's own height changes, not once.
            //
            // Measuring once looked safe and was not: these panels render
            // before their data arrives, so the first measurement is of a
            // header with no `stats` yet. The locker's "8 AVAILABLE" figure
            // then appeared, the panel was still locked to the pre-data
            // height, and the whole stats row was clipped out of existence.
            //
            // This is safe because the measured view is NOT the one whose
            // height is animated — the wrapper is — so its layout height is
            // always its true content height and cannot feed back into itself.
            if (h > 0 && Math.abs(h - naturalH) > 1) setNaturalH(h);
          }}
        >
        {eyebrow ? <Text style={[s.eyebrow, { color: t.eyebrow }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[s.title, { color: t.title }]}>{title}</Text>
        {lede ? <Text style={[s.lede, { color: t.lede }]}>{lede}</Text> : null}

        {stats && stats.length > 0 ? (
          <View style={s.stats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[s.stat, i > 0 && [s.statDivided, { borderLeftColor: t.divider }]]}>
                <Text style={[s.statValue, { color: t.title }]} numberOfLines={1}>
                  {st.value}
                </Text>
                <Text style={[s.statLabel, { color: t.statLabel }]} numberOfLines={1}>
                  {st.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    overflow: "hidden",
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
    // NB: `large` owns the padding that disappears with it — see `largeStyle`.
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
  barTitleText: { fontFamily: F.displayRegular, fontSize: 16 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },

  // No padding here: it belongs to the inner measured view, or the natural
  // height would come back short by exactly the padding and clip the lede.
  large: {},
  largeInner: { paddingHorizontal: S.gutter, paddingTop: S.md },
  eyebrow: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.9, marginBottom: 9 },
  title: { fontFamily: F.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.2 },
  lede: { fontFamily: F.body, fontSize: 16, lineHeight: 25, marginTop: 10 },

  stats: { flexDirection: "row", marginTop: S.lg },
  stat: { flex: 1 },
  statDivided: { borderLeftWidth: 1, paddingLeft: S.md, marginLeft: S.md },
  statValue: { fontFamily: F.display, fontSize: 26, lineHeight: 30 },
  statLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, marginTop: 4 },
});
