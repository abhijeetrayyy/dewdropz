/**
 * The shop's day.
 *
 * THE BUG THIS ENDS
 *
 * The rental system asked an IST question of a UTC clock in about a dozen
 * places, all of them spelled `new Date().toISOString().slice(0, 10)`. The
 * server is UTC; the shop is UTC+05:30. So between 00:00 and 05:30 IST every one
 * of those reads yesterday, and the consequences were not cosmetic:
 *
 *   · `bookingNumber()` stamped yesterday's date on the number staff read out
 *     and file by, for every booking taken on the early shift.
 *   · `returnBooking` measured lateness against yesterday, so gear checked in at
 *     01:00 got a free day — and the same date shrank the reservation, so the
 *     shelf lost a day it should have got back.
 *   · The reminder sweep matched `ends_on === tomorrow` on exact string
 *     equality, so a run in the wrong window claimed the wrong cohort and — the
 *     claim being one-shot — the right one was never warned at all.
 *
 * The repo already knew: `lib/trekBuckets.ts` and `lib/invoice/documentShell.ts`
 * both use `Asia/Kolkata`, the latter with the comment "IST, because the
 * business is in India and the server is not". `mobile/lib/rent/dates.ts` has a
 * passing test named "THE BUG THIS GUARDS: today is the LOCAL date, not UTC".
 * The rental server path was the one place that never got it.
 *
 * `en-CA` because it formats as YYYY-MM-DD, which is the shape every DATE column
 * and every comparison in this system already speaks.
 */

const SHOP_TZ = 'Asia/Kolkata'

/** Today, in the shop's timezone, as `YYYY-MM-DD`. */
export function shopToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: SHOP_TZ })
}

/** A plain `YYYY-MM-DD` shifted by whole days. Parses at UTC midnight so the
 *  arithmetic cannot pick up an offset of its own — the same technique
 *  `lib/rentalMath.ts` uses, and the reason its day counts are correct. */
export function shopAddDays(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString().slice(0, 10)
}

/** Tomorrow, in the shop's timezone. */
export function shopTomorrow(now: Date = new Date()): string {
  return shopAddDays(shopToday(now), 1)
}

/** Is this `YYYY-MM-DD` before the shop's today? Used as the floor on a booking:
 *  the quote endpoint would otherwise price a hire starting in January 2025,
 *  cleanly, with no error — which then arrives already overdue, gets chased by
 *  the reminder sweep, and accrues a late fee capped only by the deposit. */
export function isPastShopDay(iso: string, now: Date = new Date()): boolean {
  return iso < shopToday(now)
}
