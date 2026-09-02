import { ReactNode, useCallback, useEffect, useState } from "react";
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
  /**
   * The panel's full expanded height, reported whenever it changes.
   *
   * Only meaningful in collapsing mode, where the panel is lifted out of the
   * layout and floats over the list — so the list has to be told how much room
   * to leave at the top of its content. See the note on `collapsing` below.
   */
  onHeight?: (h: number) => void;
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

export function ScreenHeader({ title, eyebrow, lede, stats, scrollY, onHeight, onBack, right, style, tone = "ink", showBack = true }: Props) {
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

  // ── WHY THE PANEL FLOATS INSTEAD OF SITTING IN THE COLUMN ─────────────────
  //
  // This is the fix for the Android report: "wherever there is a header that
  // needs to be scrolled and it became small, it is flickering and also not
  // able to scroll very easily."
  //
  // The panel was a SIBLING ABOVE the list, and its collapse animated `height`.
  // `height` is a LAYOUT property, and this app runs Reanimated 4 on the New
  // Architecture — so every frame of the collapse committed a new layout to the
  // shadow tree, the list below was resized to match, and that happened WHILE
  // the finger was still dragging it. A list being resized mid-gesture is
  // exactly the two symptoms reported: the frame tears against the scroll
  // (flicker) and the scroller keeps having its viewport moved under it
  // (fighting back). Android feels it far more than iOS because its commit is
  // more expensive and is not synchronised with the scroll frame.
  //
  // Lifting the panel out of the flow breaks the link completely. It floats
  // over the list, the list's own frame never changes size, and the height
  // animation now costs nothing but the panel's own pixels. The list is told
  // how much room to leave at the top via `onHeight`.
  const collapsing = !!scrollY;

  // Everything above the collapsing block: the status-bar inset, the panel's
  // own top padding, and the 44pt control row. Constant, and the height the
  // panel settles at once collapsed.
  const chromeH = insets.top + 6 + 44;

  useEffect(() => {
    if (!collapsing) return;
    // `S.block` is the gap the panel owns below itself (see `marginBottom` in
    // the stylesheet). A floating panel has no margin anybody can see, so the
    // gap has to be handed to the list as padding instead or the first row
    // would sit hard against the panel's rounded edge.
    onHeight?.(chromeH + naturalH + S.lg + S.block);
  }, [collapsing, chromeH, naturalH, onHeight]);

  // Accept a measurement only when the content GREW.
  //
  // The measured view lives inside the block whose height is being animated, so
  // during a collapse Yoga re-lays it out at every intermediate size. Feeding
  // those back through `setState` re-rendered the header mid-scroll and
  // re-attached the animated style — a second, independent source of the
  // flicker, and one that got worse the faster you scrolled.
  //
  // Growth is the only direction that matters. The case this exists for is a
  // panel that renders before its data arrives and then gains a stats row —
  // the locker's "8 IN THE LOCKER" — which is always taller. Shrinking is
  // either the collapse itself (must be ignored) or content genuinely being
  // removed, which re-mounts the screen anyway.
  const measure = useCallback((h: number) => {
    if (h > 0) setNaturalH((prev) => (h > prev + 1 ? h : prev));
  }, []);

  // ── THE COLLAPSE IS TRANSFORMS ONLY. NO LAYOUT, EVER. ────────────────────
  //
  // The first version of this animated `height`, which is a layout property:
  // every frame committed a new layout to the shadow tree. On Reanimated 4 +
  // the New Architecture that is a commit per frame, and on Android it is not
  // synchronised with the scroll frame — so the panel tore against the scroll
  // (the flicker) and, while the panel still sat in the column, resized the
  // list under the finger (the fighting).
  //
  // Floating the panel fixed the second half. This fixes the first: nothing
  // here touches layout at all. `transform` and `opacity` are the two
  // properties Reanimated can drive entirely on the UI thread without asking
  // Yoga anything, so the collapse now costs a matrix multiply per frame.
  //
  // HOW IT LOOKS LIKE A COLLAPSE WITHOUT BEING ONE
  //
  // The panel keeps its full height for ever and simply SLIDES UP by exactly
  // the part that should disappear — the large block plus the padding under it.
  // What is left overlapping the screen is `chromeH`: the status inset and the
  // 44pt control row, which is precisely the collapsed bar. The control row is
  // then translated back DOWN by the same amount so it stays pinned at the top
  // while everything around it leaves. The rounded bottom edge rides up with
  // the panel and lands under the bar, which is what it did before.
  const collapsible = naturalH + S.lg;

  // The interpolation is written out in both worklets rather than shared
  // through a helper. A plain function declared in the component body lives on
  // the JS runtime, and calling it from inside `useAnimatedStyle` — which runs
  // on the UI runtime — throws "[Worklets] Tried to synchronously call a Remote
  // Function". Two identical lines is the cost of staying on one thread.
  const panelStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    return {
      transform: [
        { translateY: -interpolate(scrollY.value, [0, HANDOFF], [0, collapsible], Extrapolation.CLAMP) },
      ],
    };
  }, [collapsible]);

  const controlsStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    // Equal and opposite, so the back button and the bar title do not move.
    return {
      transform: [
        { translateY: interpolate(scrollY.value, [0, HANDOFF], [0, collapsible], Extrapolation.CLAMP) },
      ],
    };
  }, [collapsible]);

  const largeStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    // The fade finishes well before the block has finished travelling, so the
    // text is gone by the time it passes under the control row rather than
    // sliding visibly behind it.
    return {
      opacity: interpolate(scrollY.value, [0, HANDOFF * 0.55], [1, 0], Extrapolation.CLAMP),
    };
  }, []);

  const barTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [HANDOFF * 0.55, HANDOFF], [0, 1], Extrapolation.CLAMP) };
  });

  return (
    <Animated.View
      style={[
        s.panel,
        panelStyle,
        { paddingTop: insets.top + 6, backgroundColor: t.ground },
        // Out of the column, over the list. `marginBottom` is dropped with it:
        // the gap it used to create is handed to the list as padding instead,
        // through `onHeight`.
        collapsing ? s.floating : null,
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

      <Animated.View style={[s.controls, controlsStyle]}>
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
      </Animated.View>

      <Animated.View style={[s.large, largeStyle]}>
        {/* ── THREE VIEWS, AND EACH ONE HAS A DIFFERENT JOB ──────────────────
            The wrapper above animates HEIGHT, which is a LAYOUT property: every
            frame of the collapse runs a layout pass. When the content was free
            to size itself inside that shrinking box, the pass re-flowed it —
            captured mid-gesture, the stats row had vanished and the lede had
            jumped to the bottom of the panel. That is the flicker.

            So the content is PINNED to the height it naturally wants, and the
            wrapper clips a rigid block instead of squeezing a flexible one.

            But a pinned view cannot report that it needs to be taller, and
            these panels render before their data arrives — pinning the measured
            view directly would lock the locker's "8 IN THE LOCKER" figure out
            of existence the moment it appeared, which is the exact bug the
            re-measure below was written to fix.

            Hence the split: the MIDDLE view is rigid, and the INNER view is
            free and is what reports. If the content grows past the pin the
            inner still lays out at its true height, reports it, and the pin
            follows. ──────────────────────────────────────────────────────── */}
        <View style={naturalH ? { height: naturalH } : null}>
        <View
          style={s.largeInner}
          onLayout={(e) => {
            measure(e.nativeEvent.layout.height);
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
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  floating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // Above the list it covers, and DELIBERATELY BELOW `StatusCap` — which is
    // absolute at zIndex 20 and exists to keep the clock legible for the whole
    // life of the screen, so nothing may paint over it.
    zIndex: 10,
    // No `elevation`. On Android elevation is not a z-order knob, it is a
    // material shadow: setting it to lift the panel above the list would have
    // drawn a hard drop shadow under a flat ink plate on every one of these
    // screens. zIndex alone orders siblings correctly.
    marginBottom: 0,
  },
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
  // ── WHY THE WRAPPER CLIPS AND THE INNER VIEW IS ABSOLUTE ──────────────────
  //
  // The wrapper's HEIGHT is animated, and height is a layout property: every
  // frame of the collapse ran a full layout pass. With the inner view in normal
  // flow, that pass re-measured the header's own children through invalid
  // intermediate states — captured mid-gesture, the stats row had vanished and
  // the lede had jumped to the bottom of the panel. That is the flicker.
  //
  // Absolute inside a clipping wrapper breaks the link: the inner view lays out
  // once, at its natural height, against a parent whose height it no longer
  // depends on. The wrapper just reveals less of it. The measurement that feeds
  // `naturalH` is still taken from this view, and is still safe for the reason
  // above it — the measured view is not the animated one.
  // `overflow: hidden` so the wrapper CLIPS its content as its height animates
  // instead of letting it spill. The inner view stays in normal flow — an
  // earlier attempt made it absolute to stop it reflowing, and that deadlocked
  // the measurement: `naturalH` is read from that view, and a view absolutely
  // positioned inside a wrapper whose height is zero until `naturalH` arrives
  // reports zero forever. The panel came up 211pt instead of 308pt.
  large: { overflow: "hidden" },
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
