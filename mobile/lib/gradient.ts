// Collections carry a CSS gradient string authored in admin, e.g.
//   "linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)"
// The web app hands that straight to `background`. Native needs the stops split
// out for expo-linear-gradient, so this parses them.
//
// It matters more than it looks: every collection has a gradient, but not every
// collection has a photograph. Falling back to art direction the merchandiser
// actually chose beats falling back to a grey rectangle.

export type ParsedGradient = {
  colors: [string, string, ...string[]];
  locations?: [number, number, ...number[]];
  /** Unit vector for expo-linear-gradient's start/end. */
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const DEFAULT: ParsedGradient = {
  colors: ["#1E3347", "#0B1520"],
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
};

/**
 * CSS gradient angles are clockwise from "to top". Converting to a start/end
 * pair on the unit square is enough for the near-vertical angles these use.
 */
function angleToVector(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return {
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}

export function parseGradient(css: string | null | undefined): ParsedGradient {
  if (!css) return DEFAULT;

  const body = /linear-gradient\(([\s\S]*)\)/i.exec(css.trim())?.[1];
  if (!body) return DEFAULT;

  // Split on commas that aren't inside a function call — rgb()/rgba() stops
  // contain their own commas and would otherwise be torn in half.
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  if (parts.length === 0) return DEFAULT;

  let deg = 180;
  let stops = parts;
  const first = parts[0];
  if (/^-?[\d.]+deg$/i.test(first)) {
    deg = parseFloat(first);
    stops = parts.slice(1);
  } else if (/^to\s/i.test(first)) {
    const dir = first.toLowerCase();
    deg = dir.includes("top") ? 0 : dir.includes("right") ? 90 : dir.includes("left") ? 270 : 180;
    stops = parts.slice(1);
  }

  const colors: string[] = [];
  const locations: number[] = [];
  for (const stop of stops) {
    const m = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(stop.trim());
    if (!m?.[1]) continue;
    colors.push(m[1].trim());
    if (m[2] !== undefined) locations.push(Math.min(1, Math.max(0, parseFloat(m[2]) / 100)));
  }
  if (colors.length < 2) return DEFAULT;

  const { start, end } = angleToVector(deg);
  return {
    colors: colors as ParsedGradient["colors"],
    // expo-linear-gradient requires locations to match colors exactly, or it
    // ignores them entirely — a partially-annotated CSS gradient would
    // otherwise silently lose its stop positions.
    locations:
      locations.length === colors.length
        ? (locations as ParsedGradient["locations"])
        : undefined,
    start,
    end,
  };
}
