import type { Canvas } from 'fabric'
import type { CustomizationZone } from '@/types/database'

/**
 * Carrying a design from one blank to another.
 *
 * Switching garment inside the studio is a page navigation — each blank is its
 * own product with its own zones, mockups and variants, and the studio is
 * server-rendered per product. So the work in progress has to survive the trip.
 *
 * WHY sessionStorage AND NOT THE URL. A canvas with one photograph on it
 * serialises to hundreds of kilobytes; a URL cannot hold that, and neither can
 * a cookie. sessionStorage is per-tab, cleared when the tab closes, and never
 * sent to the server — which is right for artwork the shopper has not committed
 * to buying yet.
 *
 * THE HARD PART IS NOT THE TRANSPORT, IT IS THE GEOMETRY. Layer coordinates are
 * stored in the zone's own pixel space, and zones differ per garment: the tee's
 * front is 212.37 x 283.17px standing for 12 x 16in, the hoodie's is
 * 219.83 x 292.48px for the same 12 x 16in. Dropping the same numbers onto a
 * different zone silently shifts and rescales every layer. So the carry records
 * the zone it came from and everything is re-fitted proportionally on arrival.
 *
 * AND THE PART THAT COSTS MONEY: print resolution is a function of the ZONE, not
 * the image. The same photograph that prints at 300 DPI across a 10in placement
 * drops below the 150 DPI floor when the new garment lets it be spread wider.
 * `refitScale` returns the factor so the caller can re-run the DPI check and
 * warn — silently carrying a design onto a bigger garment is exactly how a
 * shopper ends up approving a blurry print.
 */

const KEY = 'dewdropz:carry-design'

/** How long a carry stays valid. Long enough to switch garment, short enough
 *  that a tab left open overnight does not resurrect yesterday's artwork. */
const TTL_MS = 30 * 60 * 1000

export interface CarriedDesign {
  /** Which blank it came from, so the arriving studio can say so. */
  fromSlug: string
  fromName: string
  /** The zone it was authored against — the basis for the re-fit. */
  fromZone: { widthPx: number; heightPx: number; widthIn: number; heightIn: number }
  /** fabric `canvas.toJSON()` per side. Absent side = nothing on it. */
  front?: unknown
  back?: unknown
  savedAt: number
}

/**
 * The factor to multiply every carried coordinate and scale by.
 *
 * Both zones stand for a physical rectangle, so matching them by INCHES rather
 * than pixels is what keeps a design the same real-world size on the new
 * garment. Using the pixel ratio instead would resize the artwork whenever the
 * two mockups happened to be photographed at different scales — which is the
 * bug this function exists to prevent.
 */
export function refitScale(from: CarriedDesign['fromZone'], to: CustomizationZone): number {
  const fromPxPerIn = from.widthPx / from.widthIn
  const toPxPerIn = to.widthPx / to.widthIn
  if (!Number.isFinite(fromPxPerIn) || !Number.isFinite(toPxPerIn) || fromPxPerIn <= 0) return 1
  return toPxPerIn / fromPxPerIn
}

export function saveCarry(payload: Omit<CarriedDesign, 'savedAt'>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...payload, savedAt: Date.now() }))
  } catch {
    // Private mode, or a canvas too large to serialise. The switch still
    // happens; the shopper starts clean on the new garment rather than the
    // studio refusing to navigate.
  }
}

/** Reads and CLEARS the carry — it is a one-shot handoff, not a document. */
export function takeCarry(): CarriedDesign | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const parsed = JSON.parse(raw) as CarriedDesign
    if (!parsed?.fromZone || Date.now() - (parsed.savedAt ?? 0) > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function clearCarry(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

/**
 * Load carried objects onto a canvas, re-fitted for the destination zone.
 *
 * Every object's position AND scale move by the same factor, so relative
 * composition is preserved — a design that sat in the top-left third still sits
 * in the top-left third. Anything that ends up outside the new zone is pulled
 * back inside, because a layer the shopper cannot reach is a layer they cannot
 * delete.
 *
 * Returns the scale applied, so the caller can re-check DPI against it.
 */
export async function applyCarry(
  canvas: Canvas,
  json: unknown,
  from: CarriedDesign['fromZone'],
  to: CustomizationZone,
): Promise<number> {
  const k = refitScale(from, to)
  await canvas.loadFromJSON(json as object)

  for (const obj of canvas.getObjects()) {
    obj.set({
      left: (obj.left ?? 0) * k,
      top: (obj.top ?? 0) * k,
      scaleX: (obj.scaleX ?? 1) * k,
      scaleY: (obj.scaleY ?? 1) * k,
    })
    obj.setCoords()

    // Clamp back inside the destination zone. The studio's own gesture layer
    // does this on drag; a carried layer has never been dragged, so it has to
    // be done here or a design from a wider garment can land off-canvas.
    const b = obj.getBoundingRect()
    let dx = 0
    let dy = 0
    if (b.left < 0) dx = -b.left
    if (b.top < 0) dy = -b.top
    if (b.left + b.width > to.widthPx) dx = Math.min(dx, to.widthPx - (b.left + b.width))
    if (b.top + b.height > to.heightPx) dy = Math.min(dy, to.heightPx - (b.top + b.height))
    if (dx || dy) {
      obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
      obj.setCoords()
    }
  }

  canvas.requestRenderAll()
  return k
}
