/**
 * The day arc, declared once.
 *
 * WHY THIS EXISTS
 *
 * The homepage's organising conceit — one day on the mountain — was written
 * down in two places that had no idea about each other:
 *
 *   1. `app/page.tsx` wrapped each section in
 *      `data-trail-time` / `data-trail-alt` / `data-trail-label`, which is what
 *      the fixed rail reads.
 *   2. Each section ALSO printed its own time in its eyebrow, as a string
 *      literal.
 *
 * They drifted, and four of the eight sections that print a time ended up
 * contradicting the wrapper directly above them:
 *
 *   CollectionsRow   wrapper 05:50   printed "11:00 · The Ridge"     +5h10
 *   ShopByCategory   wrapper 06:40   printed "13:00 · Pack Check"    +6h20
 *   TheClimb         wrapper 11:00   printed "08:30 · The Climb"     −2h30
 *   Community        wrapper 18:30   printed "16:30 · The Way Down"  −2h
 *
 * On a wide screen both are legible in one glance: the rail saying 05:50 while
 * the heading twenty pixels away says 11:00. And the sequence a phone can
 * actually read — the rail is `hidden lg:flex` — runs 11:00 → 13:00 → 08:30 →
 * 14:30, so the sun goes backwards four and a half hours in the middle of the
 * page.
 *
 * The wrapper values were the correct ones: they ascend monotonically from
 * 05:50 to 21:00 and their altitudes descend, which is the descent the page
 * describes. So they win, and they now live here. A section receives its stop
 * and renders it; it may not invent one. Drift is a type error rather than
 * something a customer reads.
 *
 * Nothing about the page's structure, order or content changes — this is the
 * same eleven stops in the same order, with one copy of them instead of two.
 */

export interface TrailStop {
  /** Clock time. Ascends down the page. */
  time: string
  /** Altitude. Descends down the page — the page is a descent. */
  alt: string
  /** The human-readable name of the stop. */
  label: string
}

export const TRAIL_STOPS = {
  collections: { time: '05:50', alt: '5,200M', label: 'First light' },
  categories:  { time: '06:40', alt: '4,980M', label: 'Pack check' },
  trust:       { time: '08:30', alt: '4,600M', label: 'Made to order' },
  kit:         { time: '09:40', alt: '4,400M', label: 'The kit' },
  climb:       { time: '11:00', alt: '4,200M', label: 'The climb' },
  workbench:   { time: '14:30', alt: '3,800M', label: 'The workbench' },
  trails:      { time: '15:30', alt: '3,600M', label: 'Golden hour' },
  trekBuddy:   { time: '17:30', alt: '3,500M', label: 'Last light' },
  community:   { time: '18:30', alt: '3,400M', label: 'The way down' },
  basecamp:    { time: '19:30', alt: '2,900M', label: 'Basecamp' },
  dispatch:    { time: '21:00', alt: '2,700M', label: 'Radio check' },
} as const satisfies Record<string, TrailStop>

/** How a section prints its stop. One format, everywhere. */
export function stopEyebrow(stop: TrailStop): string {
  return `${stop.time} · ${stop.label}`
}
