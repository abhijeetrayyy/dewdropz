/**
 * Calendar arithmetic for hires, kept apart from the component that draws it.
 *
 * Separated so it can be tested without a renderer. A month grid that puts the
 * 1st on the wrong weekday, or a "next month" that loses December, is invisible
 * until the month it breaks in — which is the wrong time to find out.
 *
 * Every date in and out is a plain YYYY-MM-DD string. That is what Postgres
 * `daterange` stores and what the server's `rentalDays` counts, so no timezone
 * ever travels with a hire.
 */

/** The LOCAL calendar's today. `toISOString()` is UTC and reports yesterday
 *  for anybody in IST before 05:30 — which would show today as unbookable. */
export function todayLocal(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Inclusive, matching `rentalDays` on the server: the 12th to the 14th is 3. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** Step a {year, month} cursor by whole months, carrying across December. */
export function stepMonth(c: { year: number; month: number }, delta: number) {
  const m = c.month + delta;
  return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

/**
 * One month's cells: leading nulls so the 1st lands under the right weekday,
 * then every day of the month as an ISO string. Monday-first.
 */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // getUTCDay is Sunday-first
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) {
    out.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}
