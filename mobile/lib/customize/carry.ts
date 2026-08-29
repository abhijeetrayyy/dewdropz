import type { CustomizationZone } from "../data";
import type { DesignState } from "./types";

/**
 * Carrying a design from one blank to another.
 *
 * Changing garment inside the studio is a route change — each blank is its own
 * `/customize/[slug]` screen with its own product, zones and variants — so the
 * work in progress has to survive the navigation.
 *
 * WHY A MODULE SINGLETON AND NOT A STORE OR A ROUTE PARAM. A design with a
 * photograph in it is far too large for route params, which end up in a URL.
 * And unlike the cart or the wishlist there is nothing to persist: this is a
 * handoff that lives for one navigation and is consumed immediately. A zustand
 * store would give it a lifetime it should not have — a design silently
 * reappearing an hour later is worse than losing it.
 *
 * MIRRORS lib/customize/carryDesign.ts ON THE WEB, which does the same job with
 * sessionStorage because a browser navigation tears down the JS context and a
 * React Native one does not. The geometry below is deliberately identical.
 *
 * THE GEOMETRY IS THE POINT. Layer coordinates live in the zone's own pixel
 * space, and zones differ per garment: the tee's front is 212.37 x 283.17px
 * standing for 12 x 16in, the hoodie's is 219.83 x 292.48px for the same
 * 12 x 16in. Moving numbers across unchanged silently shifts and rescales
 * every layer, so the carry records the zone it came from and everything is
 * re-fitted on arrival.
 */

export interface Carried {
  fromSlug: string;
  fromName: string;
  fromZone: Pick<CustomizationZone, "widthPx" | "heightPx" | "widthIn" | "heightIn">;
  design: DesignState;
  /** Source pixel dimensions per image layer id — without these the arriving
   *  studio cannot recompute print quality for what it just received. */
  srcDims: Record<string, { width: number; height: number }>;
}

let pending: Carried | null = null;

export function putCarry(c: Carried): void {
  pending = c;
}

/** Reads and CLEARS — a one-shot handoff, not a document. */
export function takeCarry(): Carried | null {
  const c = pending;
  pending = null;
  return c;
}

export function clearCarry(): void {
  pending = null;
}

/**
 * The factor every carried coordinate and size is multiplied by.
 *
 * Matched by INCHES, not pixels. Both zones stand for a physical rectangle, so
 * the inch basis is what keeps artwork the same real-world size on the new
 * garment. Using the pixel ratio would resize the design whenever two mockups
 * happened to be photographed at different scales — a bug that would look like
 * the studio randomly shrinking people's work.
 */
export function refitScale(
  from: Carried["fromZone"],
  to: CustomizationZone,
): number {
  const fromPxPerIn = from.widthPx / from.widthIn;
  const toPxPerIn = to.widthPx / to.widthIn;
  if (!isFinite(fromPxPerIn) || !isFinite(toPxPerIn) || fromPxPerIn <= 0) return 1;
  return toPxPerIn / fromPxPerIn;
}

/**
 * Re-fit a carried design for a destination zone.
 *
 * Position and size move by the same factor so relative composition survives —
 * a mark that sat top-left stays top-left. Anything that would land outside the
 * new print area is pulled back inside, because a layer the shopper cannot
 * reach is a layer they cannot delete.
 */
export function refitDesign(
  design: DesignState,
  from: Carried["fromZone"],
  zones: Partial<Record<keyof DesignState, CustomizationZone | undefined>>,
): { design: DesignState; scale: number } {
  let applied = 1;

  const out = {} as DesignState;
  for (const side of Object.keys(design) as (keyof DesignState)[]) {
    const zone = zones[side];
    const layers = design[side];
    if (!zone || layers.length === 0) {
      out[side] = layers;
      continue;
    }
    const k = refitScale(from, zone);
    applied = Math.max(applied, k);

    out[side] = layers.map((l) => {
      const width = "width" in l ? l.width * k : undefined;
      const height = "height" in l ? l.height * k : undefined;
      const next = {
        ...l,
        x: l.x * k,
        y: l.y * k,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        // Text has no width/height of its own — its size IS the font size, so
        // that is what has to scale for the words to stay the same size on
        // the body rather than the same number of pixels.
        ...(l.kind === "text" ? { fontSize: l.fontSize * k } : {}),
      } as typeof l;

      // Clamp inside the destination zone.
      const w = "width" in next ? next.width * next.scale : 0;
      const h = "height" in next ? next.height * next.scale : 0;
      return {
        ...next,
        x: Math.max(0, Math.min(next.x, Math.max(0, zone.widthPx - w))),
        y: Math.max(0, Math.min(next.y, Math.max(0, zone.heightPx - h))),
      } as typeof l;
    });
  }

  return { design: out, scale: applied };
}
