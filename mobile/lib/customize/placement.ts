import type { CustomizationZone } from "../data";

/**
 * Where a freshly added image lands on the garment.
 *
 * MIRRORS THE WEB STUDIO'S RULE in components/customize/Toolbar.tsx. The two
 * cannot share code — separate packages — so if one changes, change both. The
 * reason it is worth keeping identical: a shopper who designs a tee on the
 * phone and opens the same blank on the laptop should not see the artwork jump.
 *
 * The rule this replaced scaled the image's LONGEST edge to 70% of the zone's
 * SHORTEST edge and centred it. That is wrong twice over with real artwork:
 *
 *   · a wide design (a ridgeline is ~3.5:1) got sized against the 16in height
 *     while being limited by the 12in width, so it landed far smaller than the
 *     space available;
 *   · a tall design filled barely half the height it could have;
 *   · and everything sat in the vertical middle of a 16in box, which on a body
 *     is the navel rather than the chest.
 *
 * Contain-fit with a margin sizes every aspect ratio correctly, and the upper
 * third is where a chest print actually goes.
 */

/** Leaves a little air inside the print area rather than butting the edge. */
const MARGIN = 0.9;

/** How far down the zone the top of the artwork sits, before clamping. */
const TOP_BIAS = 0.12;

export function placeInZone(
  zone: CustomizationZone,
  source: { width: number; height: number },
): { width: number; height: number; x: number; y: number } {
  const srcW = source.width > 0 ? source.width : zone.widthPx;
  const srcH = source.height > 0 ? source.height : zone.heightPx;

  // Never upscale past 1:1. Blowing a 100px file up to fill a 12in zone looks
  // fine on a phone and prints at single-digit DPI — printQuality would flag
  // it, but not creating the problem is better than warning about it.
  const fit = Math.min(1, (zone.widthPx * MARGIN) / srcW, (zone.heightPx * MARGIN) / srcH);
  const width = srcW * fit;
  const height = srcH * fit;

  // Sit it high, but never push a tall design past the bottom edge — the clamp
  // is what makes one rule safe for every shape.
  const y = Math.min(zone.heightPx * TOP_BIAS, Math.max(0, zone.heightPx - height));

  return { width, height, x: (zone.widthPx - width) / 2, y };
}
