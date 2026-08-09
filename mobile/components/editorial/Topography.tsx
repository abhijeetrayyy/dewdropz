import { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// Contour-line texture — the app's one piece of ownable ornament.
// ─────────────────────────────────────────────────────────────────────────────
//
// A trekking brand has exactly one graphic language available to it that no
// generic commerce template will ever reach for: the topographic map. Nested
// irregular closed curves reading outward from a summit are instantly legible
// as "mountain" without a single literal illustration of one.
//
// Generated rather than shipped as an asset, for three reasons:
//   • It adapts to any band height without tiling seams or stretching.
//   • Changing the seed gives a different "peak" per section, so the same
//     texture never repeats identically down a scroll.
//   • It costs a few hundred bytes instead of a PNG.
//
// Determinism matters: `seed` drives a closed-form wobble function (sums of
// sines), NOT Math.random. A random texture would resample on every re-render
// and the whole background would shimmer as you scrolled.

/**
 * Radius of one contour at angle θ. Three summed harmonics give a shape that
 * reads as organic without ever self-intersecting — a single sine looks like
 * a bean, five or more looks like noise.
 */
function radiusAt(theta: number, base: number, wobble: number, seed: number) {
  const n =
    Math.sin(3 * theta + seed) * 0.5 +
    Math.sin(5 * theta + seed * 1.7) * 0.3 +
    Math.sin(7 * theta + seed * 2.3) * 0.2;
  return base * (1 + wobble * n);
}

/**
 * A closed, smooth path through polar samples.
 *
 * Uses the midpoint-quadratic trick: move to the midpoint of the last→first
 * edge, then for each vertex emit a quadratic with the vertex as the control
 * point and the next midpoint as the endpoint. Every join lands mid-segment,
 * so the curve is continuous everywhere with no corner artefacts and no
 * Catmull-Rom conversion needed.
 */
function contourPath(
  cx: number,
  cy: number,
  base: number,
  wobble: number,
  seed: number,
  squash: number,
  samples = 44,
) {
  const pts: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const r = radiusAt(t, base, wobble, seed);
    pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * squash]);
  }

  const mid = (a: [number, number], b: [number, number]) =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];

  const start = mid(pts[pts.length - 1], pts[0]);
  let d = `M${start[0].toFixed(1)},${start[1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const end = mid(cur, pts[(i + 1) % pts.length]);
    d += `Q${cur[0].toFixed(1)},${cur[1].toFixed(1)} ${end[0].toFixed(1)},${end[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

type Props = {
  width: number;
  height: number;
  /** Line colour. Pass the paper tone when drawing on ink. */
  color: string;
  /** 0–1. Keep low — this is texture, not content. */
  opacity?: number;
  /** How many contour rings. */
  lines?: number;
  /** Changes the shape of the "peak". Any number; same number = same shape. */
  seed?: number;
  /** Summit position as a fraction of width/height. */
  originX?: number;
  originY?: number;
  style?: ViewStyle;
};

export function Topography({
  width,
  height,
  color,
  opacity = 0.16,
  lines = 11,
  seed = 1,
  originX = 0.72,
  originY = 0.42,
  style,
}: Props) {
  const paths = useMemo(() => {
    const cx = width * originX;
    const cy = height * originY;
    // Reach past the frame so contours bleed off every edge — a texture that
    // politely fits inside its box reads as a logo, not a map.
    const outer = Math.max(width, height) * 0.72;
    const out: { d: string; w: number }[] = [];

    for (let i = 0; i < lines; i++) {
      // Span 0.22→1.0 of the outer radius rather than 1/n→1. Starting at
      // (i+1)/n crushed the first rings into a dot at the origin and pushed
      // the last ones entirely off-frame, so only three or four arcs ever
      // landed in the visible band — it read as stray curves, not a map.
      const t = 0.22 + (i / Math.max(1, lines - 1)) * 0.78;
      out.push({
        d: contourPath(
          cx,
          cy,
          outer * t,
          // Inner rings wobble more: on a real map the tight contours around a
          // summit are the ragged ones, and the outer ones smooth out.
          0.1 + (1 - t) * 0.14,
          seed + i * 0.6,
          0.78,
        ),
        // Every third line heavier, mirroring the index contours a real
        // topographic sheet prints every fifth interval.
        w: i % 3 === 0 ? 1.4 : 0.8,
      });
    }
    return out;
  }, [width, height, lines, seed, originX, originY]);

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }, style]} pointerEvents="none">
      <Svg width={width} height={height} opacity={opacity}>
        {paths.map((p, i) => (
          <Path key={i} d={p.d} stroke={color} strokeWidth={p.w} fill="none" />
        ))}
      </Svg>
    </View>
  );
}
