import type { CustomizationZone } from "../data";
import type { DesignLayer } from "./types";

// Whether the artwork somebody picked is good enough to print.
//
// The studio captured `asset.width` and `asset.height` from the picker and then
// used them only to fit the image into the zone — the numbers that decide
// whether a print is sharp or a blur were read, used for layout, and thrown
// away. A shopper could take a 400px screenshot, stretch it across a 12-inch
// front, approve a preview that looks perfect at phone scale, and receive a
// garment printed at roughly 33 DPI. Nothing anywhere said a word.
//
// The server already knows the rule — lib/customize/printSpec.ts on the web
// defines TARGET_DPI 300 and MIN_DPI 150, and records the achieved figure per
// side in `custom_designs.front_print_dpi`. What was missing was telling the
// person while they can still do something about it.
//
// These constants are duplicated deliberately rather than imported: the app
// cannot import from the web package, and a wrong number here is a warning
// threshold rather than a print file. If printSpec's values change, change
// these — that is what the comment in both files is for.

/** What a DTG print needs. Mirrors printSpec.TARGET_DPI. */
export const TARGET_DPI = 300;
/** Below this, edges and small text visibly soften. Mirrors printSpec.MIN_DPI. */
export const MIN_DPI = 150;

export type Quality = "good" | "soft" | "poor";

/**
 * The DPI this image will actually be printed at.
 *
 * A zone records both its canvas size (`widthPx`, tied to the 800px reference
 * mockup) and its real size (`widthIn`). A layer covers `width × scale` canvas
 * pixels, so the physical width it occupies is a straight proportion — and the
 * resolution is the source pixels spread over those inches. The canvas number
 * never enters it, which is the same reasoning printSpec uses.
 */
export function effectiveDpi(
  layer: Extract<DesignLayer, { kind: "image" }>,
  zone: CustomizationZone,
  source: { width: number; height: number } | undefined,
): number | null {
  if (!source?.width || !zone.widthPx || !zone.widthIn) return null;
  const printedInches = ((layer.width * layer.scale) / zone.widthPx) * zone.widthIn;
  if (printedInches <= 0) return null;
  return Math.round(source.width / printedInches);
}

export function qualityOf(dpi: number | null): Quality | null {
  if (dpi == null) return null;
  if (dpi >= TARGET_DPI) return "good";
  if (dpi >= MIN_DPI) return "soft";
  return "poor";
}

/** One sentence, written for somebody deciding whether to shrink their image. */
export function qualityNote(dpi: number | null): string | null {
  const q = qualityOf(dpi);
  if (!q || dpi == null) return null;
  if (q === "good") return `Sharp — ${dpi} DPI at this size.`;
  if (q === "soft") {
    return `A little soft at this size (${dpi} DPI). Making it smaller will sharpen it.`;
  }
  return `Too low to print well (${dpi} DPI). Make it much smaller, or pick a larger image.`;
}
