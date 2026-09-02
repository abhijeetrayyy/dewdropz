/**
 * Month-grid arithmetic for the web's rental calendar.
 *
 * WHY THIS IS A SECOND COPY, DELIBERATELY
 *
 * `mobile/lib/rent/dates.ts` already contains this arithmetic, tested, and has
 * since the app's date picker shipped. The web had none of it — its date fields
 * were two bare `<input type="date">` you filled in blind — so the choice was
 * to import across the package boundary or to port.
 *
 * Importing loses. `mobile/` is a separate package with its own `package.json`,
 * its own `node_modules` and Metro rather than webpack; a web build reaching
 * into it makes the storefront's module graph depend on the phone app's
 * bundler configuration, and the dependency points the wrong way besides.
 *
 * So it is a port — of forty lines of pure arithmetic with no imports — and the
 * drift that would normally make that a bad idea is closed by a test:
 * `lib/calendarGrid.test.ts` imports BOTH implementations and asserts they
 * agree, over four years of months. If somebody fixes a leap-year bug in one,
 * the other fails until it is fixed too.
 *
 * Every date in and out is a plain `YYYY-MM-DD` string, which is what Postgres
 * `daterange` stores and what `rentalDays` counts in. No timezone travels with
 * a rental — see `lib/shopTime.ts` for what happened when one did.
 */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Step a `{year, month}` cursor by whole months, carrying across December.
 *  `Math.floor` rather than a truncating divide, so stepping back from January
 *  lands in the previous year instead of month −1 of this one. */
export function stepMonth(c: { year: number; month: number }, delta: number) {
  const m = c.month + delta
  return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
}

/**
 * One month's cells: leading nulls so the 1st lands under the right weekday,
 * then every day of the month as an ISO string. Monday-first, matching the app.
 *
 * Built at UTC throughout. Using local `Date` constructors here would put the
 * 1st under the wrong weekday for anybody whose offset crosses midnight, which
 * is invisible until the month it breaks in.
 */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1))
  const lead = (first.getUTCDay() + 6) % 7 // getUTCDay is Sunday-first
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const out: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= count; d++) {
    out.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}

/** The `{year, month}` a `YYYY-MM-DD` falls in, read as characters rather than
 *  parsed — a Date would reintroduce the timezone this module exists to avoid. */
export function monthOf(iso: string): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 }
}

/** Inclusive, matching `rentalDays` on the server: the 12th to the 14th is 3. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/** The last day of the month a cursor points at — the right end of the window
 *  to ask the database for. */
export function lastDayOf(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month + 1, 0))
  return d.toISOString().slice(0, 10)
}

export function firstDayOf(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

/** `12 Sep` — read at UTC so the label cannot disagree with the cell it sits in. */
export function prettyDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`
}
