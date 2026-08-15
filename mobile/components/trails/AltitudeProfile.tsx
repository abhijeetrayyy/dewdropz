import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Mono } from "@/components/ui/Type";
import { type Trail, altitudeMeters } from "@/lib/trails";
import { haptics } from "@/lib/haptics";
import { C, F, S } from "@/lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// The range, as a profile
// ─────────────────────────────────────────────────────────────────────────────
// The trail guide's data has always contained the two numbers a walker
// actually chooses on — how high, and when — and rendered both as prose. You
// could read that Nag Tibba is 3,022m and Roopkund is 5,029m, but nothing let
// you *see* that gap, and comparing eight trails meant scrolling eight cards
// and holding numbers in your head.
//
// This plots every trail on one shared altitude axis, ordered low to high, so
// the guide opens on the shape of the range rather than a list of it. Reading
// left to right is a climb; the profile is the index.
//
// It scrolls horizontally on purpose. Eight labelled peaks will not fit across
// a phone, and squeezing them to fit would make the one genuinely useful
// graphic in the app illegible — so you traverse it, which is the right verb.
//
// Everything is real: `altitudeMeters` parses the authored strings, and the
// vertical scale is the true min–max of the set. No peak is drawn taller than
// its data.
// ─────────────────────────────────────────────────────────────────────────────

const STEP = 92;
const CHART_H = 132;
/** Headroom above the tallest peak and below the lowest, in px. */
const PAD_TOP = 26;
const PAD_BOTTOM = 30;
/** Fixed height of the altitude label above each marker. */
const ALT_LABEL_H = 12;
const DOT = 9;

export function AltitudeProfile({
  trails,
  dimmed,
  onSelect,
}: {
  /** Every trail, ordered low to high. Drawn in full so the range never changes shape. */
  trails: Trail[];
  /** Slugs currently filtered out — drawn, but recessed. */
  dimmed: Set<string>;
  onSelect: (slug: string) => void;
}) {
  if (trails.length < 2) return null;

  const alts = trails.map(altitudeMeters);
  const min = Math.min(...alts);
  const max = Math.max(...alts);
  const span = Math.max(1, max - min);

  const width = trails.length * STEP;
  const usable = CHART_H - PAD_TOP - PAD_BOTTOM;
  // Higher altitude → smaller y. The lowest trail still sits above the baseline
  // so the profile reads as terrain rather than as bars off the floor.
  const yFor = (m: number) => PAD_TOP + (1 - (m - min) / span) * usable;

  const points = trails.map((t, i) => ({
    trail: t,
    x: i * STEP + STEP / 2,
    y: yFor(altitudeMeters(t)),
  }));

  // A single polyline through the peaks, closed to the baseline for the fill.
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `M0,${CHART_H} L${points[0].x},${points[0].y} ${points
    .slice(1)
    .map((p) => `L${p.x},${p.y}`)
    .join(" ")} L${width},${CHART_H} Z`;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: S.gutter }}
      >
        <View style={{ width, height: CHART_H }}>
          <Svg width={width} height={CHART_H}>
            <Defs>
              <LinearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.forest} stopOpacity="0.22" />
                <Stop offset="1" stopColor={C.forest} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#ridge)" />
            <Path d={line} stroke={C.forest} strokeWidth={1.5} fill="none" />
          </Svg>

          {/* Markers and labels are RN views, not SVG text: they get the app's
              real typefaces, and each one is a proper touch target. */}
          {points.map((p) => {
            const off = dimmed.has(p.trail.slug);
            return (
              <TouchableOpacity
                key={p.trail.slug}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${p.trail.name}, ${p.trail.altitude}${off ? ", out of season" : ""}`}
                onPress={() => {
                  haptics.select();
                  onSelect(p.trail.slug);
                }}
                style={[s.peak, { left: p.x - STEP / 2, width: STEP }]}
              >
                <Text style={[s.alt, off && s.dim]} numberOfLines={1}>
                  {p.trail.altitude}
                </Text>
                {/* The marker must sit ON the polyline, so its offset backs out
                    everything stacked above it: the altitude label's fixed
                    height, then half the dot to centre it on the vertex rather
                    than hang it from the top. Eyeballing this leaves the dots
                    floating off the ridge, which is the one thing that would
                    make the graphic look decorative rather than plotted. */}
                <View
                  style={[s.dot, off && s.dotOff, { marginTop: p.y - ALT_LABEL_H - DOT / 2 }]}
                />
                <Text style={[s.name, off && s.dim]} numberOfLines={2}>
                  {p.trail.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.axis}>
        <Mono color={C.textFaint}>
          {min.toLocaleString("en-IN")}M — {max.toLocaleString("en-IN")}M
        </Mono>
        <Mono color={C.textFaint}>SCROLL THE RANGE →</Mono>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  peak: { position: "absolute", top: 0, height: CHART_H, alignItems: "center" },
  // The altitude sits at a fixed height so the numbers form a readable row;
  // only the marker tracks the real elevation.
  alt: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 0.8, color: C.forestDeep, height: ALT_LABEL_H },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: 999,
    backgroundColor: C.forest,
    borderWidth: 2,
    borderColor: C.paper,
  },
  dotOff: { backgroundColor: C.textFaint },
  name: {
    position: "absolute",
    bottom: 0,
    fontFamily: F.bodyMedium,
    fontSize: 10,
    lineHeight: 12,
    color: C.textMid,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  dim: { opacity: 0.35 },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: S.gutter,
    marginTop: S.sm,
  },
});
