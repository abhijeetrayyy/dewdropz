// A design is a flat, ordered list of layers — index 0 renders first, so the
// last entry is visually on top. Transforms are stored in the zone's own
// canonical pixel space (not screen pixels), so a design looks identical on a
// phone, a tablet, and in the exported print file.
export type DesignLayer =
  | {
      kind: "text";
      id: string;
      text: string;
      fontFamily: string;
      fontSize: number;
      color: string;
      bold: boolean;
      italic: boolean;
      x: number;
      y: number;
      scale: number;
      rotation: number;
    }
  | {
      kind: "image";
      id: string;
      uri: string;
      width: number;
      height: number;
      x: number;
      y: number;
      scale: number;
      rotation: number;
    };

export type SideKey = "front" | "back";

export type DesignState = Record<SideKey, DesignLayer[]>;

export const EMPTY_DESIGN: DesignState = { front: [], back: [] };

// Ink that stays legible on the chosen blank. Mirrors the web studio's
// defaultInkFor so a black garment doesn't get invisible near-black text.
export function defaultInkFor(garmentHex: string | undefined): string {
  if (!garmentHex) return "#1A1A1A";
  const m = /^#?([0-9a-f]{6})$/i.exec(garmentHex.trim());
  if (!m) return "#1A1A1A";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.5 ? "#1A1A1A" : "#FFFFFF";
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
