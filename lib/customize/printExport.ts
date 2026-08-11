import type { Canvas } from 'fabric'
import type { CustomizationZone } from '@/types/database'

// What a print file actually has to be. The studio canvas is only ~220px wide
// (the zone's canonical size), so exporting it at multiplier 1 — which is what
// this used to do — handed the printer a 220px file for a 12-inch print: 18 DPI.
// The real export resolution comes from the zone's physical size instead, which
// is exactly what widthIn/heightIn are recorded for.
const TARGET_DPI = 300

// Below this a DTG print visibly softens; if we can't hit it within the size
// budget we still export, but the caller is told the real number.
const MIN_DPI = 150

// design-uploads caps objects at 10MB, so a print PNG has to land under that
// with headroom for the base64/multipart overhead of the upload itself.
const MAX_BYTES = 8.5 * 1024 * 1024

// Browsers refuse to rasterise a canvas past a few thousand px per side
// (Safari is the strictest). Staying well inside that avoids toDataURL
// silently returning a blank or throwing.
const MAX_EDGE_PX = 8192

function approxBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  // 4 base64 chars encode 3 bytes; padding '=' costs a byte each.
  return Math.floor(base64.length * 0.75) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
}

function multiplierFor(zone: CustomizationZone, dpi: number): number {
  const byWidth = (zone.widthIn * dpi) / zone.widthPx
  const byEdge = MAX_EDGE_PX / Math.max(zone.widthPx, zone.heightPx)
  return Math.min(byWidth, byEdge)
}

export type PrintExport = { dataUrl: string; dpi: number; widthPx: number; heightPx: number }

// Exports the print-ready artwork (design only, on transparency) at the highest
// resolution that still fits the upload budget. Steps the DPI down rather than
// failing outright, so a photo-heavy design still produces a usable file
// instead of erroring at checkout — the achieved DPI comes back so the UI can
// be honest about it.
export function exportPrintArtwork(canvas: Canvas, zone: CustomizationZone): PrintExport {
  let last: PrintExport | null = null

  for (let dpi = TARGET_DPI; dpi >= MIN_DPI; dpi -= 50) {
    const multiplier = multiplierFor(zone, dpi)
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier })
    const result: PrintExport = {
      dataUrl,
      // Report what the file actually is, not what we asked for — the
      // MAX_EDGE_PX clamp can land it below the requested DPI.
      dpi: Math.round((zone.widthPx * multiplier) / zone.widthIn),
      widthPx: Math.round(zone.widthPx * multiplier),
      heightPx: Math.round(zone.heightPx * multiplier),
    }
    if (approxBytes(dataUrl) <= MAX_BYTES) return result
    last = result
  }

  // Everything down to MIN_DPI was still too big — hand back the smallest we
  // produced rather than nothing, and let the caller decide what to say.
  return last!
}

// The preview composite doesn't go to a printer, so it only needs to look right
// in the cart and order emails. Kept modest deliberately: this gets uploaded on
// every "add to bag" and a print-resolution preview would be pure waste.
export const PREVIEW_MULTIPLIER = 2
