import { View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "@/lib/theme";

// A layered mountain silhouette used as a section divider — the visual full
// stop between a light section and a dark one.
//
// Three ranges at decreasing opacity fake atmospheric perspective (distant
// ridges wash out), which is what makes a flat two-colour graphic read as
// depth rather than as a jagged border. Authored by hand rather than
// generated: a ridgeline is a silhouette people recognise, and procedural
// noise reliably produces peaks that look wrong — too even, too spiky, or
// symmetrical in a way real terrain never is.
//
// The viewBox is 1000×220 and `preserveAspectRatio="none"` lets it stretch to
// any screen width. Distortion is invisible on a silhouette this abstract, and
// it means no letterboxing on a tablet.

const FAR =
  "M0,150 L70,120 L120,138 L190,86 L245,118 L300,96 L360,130 L430,88 L500,124 L560,100 L640,140 L700,112 L780,146 L850,120 L920,150 L1000,128 L1000,220 L0,220 Z";
const MID =
  "M0,178 L60,156 L140,182 L210,132 L280,166 L340,144 L410,180 L480,150 L540,174 L620,138 L690,172 L760,152 L840,184 L910,160 L1000,186 L1000,220 L0,220 Z";
const NEAR =
  "M0,206 L80,190 L160,208 L240,178 L320,200 L400,184 L470,206 L550,182 L630,202 L710,186 L790,208 L870,190 L940,204 L1000,196 L1000,220 L0,220 Z";

type Props = {
  height?: number;
  /** Silhouette colour — usually the colour of the section BELOW the divider. */
  color?: string;
  /** Flip vertically, for a ridge hanging from the top of a section. */
  flipped?: boolean;
  style?: ViewStyle;
};

export function Ridgeline({ height = 64, color = C.ink, flipped, style }: Props) {
  return (
    <View
      style={[{ height, width: "100%" }, flipped && { transform: [{ scaleY: -1 }] }, style]}
      pointerEvents="none"
    >
      <Svg width="100%" height={height} viewBox="0 0 1000 220" preserveAspectRatio="none">
        <Path d={FAR} fill={color} opacity={0.35} />
        <Path d={MID} fill={color} opacity={0.6} />
        <Path d={NEAR} fill={color} />
      </Svg>
    </View>
  );
}

/**
 * A single-stroke elevation profile — the line a GPS watch draws for a day's
 * walk. Used as a small inline graphic next to altitude figures, where a full
 * silhouette would be too heavy.
 */
export function ElevationTrace({
  width = 120,
  height = 28,
  color = C.sage,
  style,
}: {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 240 56" preserveAspectRatio="none">
        <Path
          d="M0,48 L24,40 L44,44 L70,22 L92,30 L118,10 L142,20 L166,6 L192,18 L216,12 L240,26"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
