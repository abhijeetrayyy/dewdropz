import type { CustomizationZone } from '@/types/database'

// The one definition of what a print file has to be.
//
// This exists because there were two renderers and they disagreed. The web
// studio derived its export scale from the zone's physical size and hit 300
// DPI; the server renderer behind the mobile design API used a hardcoded
// `PRINT_SCALE = 4`, which on the tee's 212px zone produced an 849px file for a
// 12-inch print — 71 DPI, and unusable. Nothing in either file made that
// visible, because neither one mentioned DPI at the point the number was
// chosen.
//
// Both now import from here, so the rule cannot drift again.

/** What a DTG print needs. Below this, edges and small text visibly soften. */
export const TARGET_DPI = 300

/** The floor we will still ship a file at, telling the caller the real number. */
export const MIN_DPI = 150

// Browsers refuse to rasterise a canvas past a few thousand px per side (Safari
// is the strictest), and node-canvas allocates width × height × 4 bytes, so an
// unbounded scale is an out-of-memory waiting to happen on the server too.
export const MAX_EDGE_PX = 8192

/**
 * How much to scale a zone's canvas pixels by to reach a given DPI.
 *
 * A zone records both its canvas size (widthPx — arbitrary, tied to the 800px
 * reference mockup) and its real-world size (widthIn). The print resolution
 * follows from the physical size alone: 12 inches at 300 DPI is 3600 pixels,
 * whatever the canvas happens to be.
 */
export function scaleForZone(zone: CustomizationZone, dpi: number = TARGET_DPI): number {
  const byPhysicalSize = (zone.widthIn * dpi) / zone.widthPx
  const byEdgeLimit = MAX_EDGE_PX / Math.max(zone.widthPx, zone.heightPx)
  return Math.min(byPhysicalSize, byEdgeLimit)
}

/** The DPI a given scale actually achieves — reported rather than assumed,
 *  because the edge clamp above can land it below what was asked for. */
export function dpiForScale(zone: CustomizationZone, scale: number): number {
  return Math.round((zone.widthPx * scale) / zone.widthIn)
}

/** Output dimensions at a scale, for logging and for the admin's file report. */
export function outputSize(zone: CustomizationZone, scale: number) {
  return {
    widthPx: Math.round(zone.widthPx * scale),
    heightPx: Math.round(zone.heightPx * scale),
  }
}

/**
 * The DPI a file of a given pixel width represents when printed at a zone's
 * physical width. Used by the admin to judge a file that already exists —
 * including ones produced before this rule was centralised.
 */
export function dpiForWidth(widthPx: number, widthIn: number): number {
  if (!widthIn) return 0
  return Math.round(widthPx / widthIn)
}
