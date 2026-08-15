// Turns the studio's saved canvas into something a human at a printer can read.
//
// `custom_designs.front_design` / `back_design` hold a Fabric.js serialisation —
// a few hundred lines of matrices, stroke-dash arrays and composite operations
// per object. It is exactly right for reloading the editor and useless to the
// person who has to reproduce the thing. This extracts the handful of facts
// that actually affect what gets printed: what the text says, in what font, at
// what size and colour, and where each element sits.
//
// Pure and defensive: the JSON comes from a client-side editor and may be from
// an older version of it, so every field is treated as possibly absent.

export type DesignElement = {
  kind: 'text' | 'image' | 'shape'
  /** The words, for text. The source URL, for an image. */
  content: string
  /** Font, colour, dimensions — only what is set. */
  details: string[]
  /** Position on the canvas, in the studio's own units. */
  position: string | null
}

type FabricObject = {
  type?: string
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  textAlign?: string
  fill?: string | Record<string, unknown>
  stroke?: string | null
  src?: string
  left?: number
  top?: number
  width?: number
  height?: number
  scaleX?: number
  scaleY?: number
  angle?: number
  opacity?: number
}

const round = (n: number) => Math.round(n * 10) / 10

/** A colour is only useful printed as a colour; anything non-string (a gradient
 *  or pattern object) is reported as such rather than as "[object Object]". */
function describeFill(fill: FabricObject['fill']): string | null {
  if (!fill) return null
  if (typeof fill === 'string') return fill
  return 'gradient or pattern'
}

export function parseDesign(design: unknown): DesignElement[] {
  const objects = (design as { objects?: unknown[] } | null)?.objects
  if (!Array.isArray(objects)) return []

  return objects.flatMap((raw): DesignElement[] => {
    const o = raw as FabricObject
    const type = (o.type ?? '').toLowerCase()

    const position =
      o.left != null && o.top != null ? `x ${round(o.left)}, y ${round(o.top)}` : null

    // Rendered size, not authored size: a 160px box at scaleX 2 prints at 320.
    const w = o.width != null ? round(o.width * (o.scaleX ?? 1)) : null
    const h = o.height != null ? round(o.height * (o.scaleY ?? 1)) : null
    const size = w != null && h != null ? `${w} × ${h}` : null

    if (type.includes('text')) {
      const details = [
        o.fontFamily ? `${o.fontFamily}${o.fontWeight && o.fontWeight !== 'normal' ? ` ${o.fontWeight}` : ''}` : null,
        o.fontSize != null ? `${round(o.fontSize * (o.scaleX ?? 1))}px` : null,
        describeFill(o.fill),
        o.fontStyle && o.fontStyle !== 'normal' ? o.fontStyle : null,
        o.textAlign && o.textAlign !== 'left' ? `${o.textAlign} aligned` : null,
        o.angle ? `rotated ${round(o.angle)}°` : null,
      ].filter((x): x is string => Boolean(x))
      return [{ kind: 'text', content: o.text ?? '(empty text)', details, position }]
    }

    if (type === 'image' || o.src) {
      const details = [
        size,
        o.angle ? `rotated ${round(o.angle)}°` : null,
        o.opacity != null && o.opacity < 1 ? `${Math.round(o.opacity * 100)}% opacity` : null,
      ].filter((x): x is string => Boolean(x))
      return [{ kind: 'image', content: o.src ?? '(embedded image)', details, position }]
    }

    // Rectangles, circles and the rest: worth listing so the sheet accounts for
    // everything on the canvas, but there is little to say about them.
    return [{
      kind: 'shape',
      content: o.type ?? 'shape',
      details: [size, describeFill(o.fill), o.stroke ? `stroke ${o.stroke}` : null]
        .filter((x): x is string => Boolean(x)),
      position,
    }]
  })
}

/** Whether there is anything on this side at all — an untouched back should not
 *  print a blank sheet. */
export function hasArtwork(design: unknown): boolean {
  return parseDesign(design).length > 0
}
