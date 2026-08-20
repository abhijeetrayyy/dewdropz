import type { TrekPlanRow } from '@/actions/trekBuddy'

/**
 * The board, cut into the buckets people actually think in.
 *
 * A flat list ordered by date makes you read every row to answer "is there
 * anything this weekend?", which is the question almost everybody arrives
 * with. Buckets answer it before you read a card, and an empty one is not
 * drawn — a heading over nothing is worse than no heading.
 *
 * THE WINDOWS ARE CONTIGUOUS AND STRICTLY INCREASING, which the first version
 * was not, and both of its bugs came from that:
 *
 *   * "In the next few days" was written as "anything within seven days that
 *     is not the weekend", so it spanned BOTH sides of the weekend. From
 *     Tuesday on, a walk the following Monday landed in it and rendered above
 *     the Saturday one. Sorting the buckets by their earliest walk only
 *     reordered the headings; it could not fix a bucket that genuinely holds
 *     walks from either side of another bucket.
 *
 *   * On a Sunday, (6 - getDay() + 7) % 7 is 6, so "this weekend" jumped to
 *     the Saturday six days away and a walk happening TODAY was filed under
 *     "in the next few days".
 *
 * Now each window is [previous boundary, next boundary), so assignment is a
 * single ordered scan, the order is correct by construction, and no sort is
 * needed. Boundaries are IST days, because a walk starting 06:00 Saturday is
 * on Saturday regardless of where the server is standing.
 */
/**
 * Below this many walks the board is one grid rather than four shelves.
 *
 * Twelve is three full rows of a three-column grid — the point at which a
 * reader has to scan rather than glance, which is the first moment a heading
 * saves them anything.
 */
export const BUCKET_THRESHOLD = 12

export function bucketPlans(plans: TrekPlanRow[]) {
  const day = 86400000
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const today = new Date(istNow); today.setHours(0, 0, 0, 0)

  // getDay(): 0 Sun … 6 Sat. If today IS the weekend, the weekend is the one
  // we are standing in, not the next one.
  const dow = today.getDay()
  const weekendStart =
    dow === 0 ? today                                     // Sunday: today
    : dow === 6 ? today                                   // Saturday: today
    : new Date(today.getTime() + (6 - dow) * day)         // Mon–Fri: this Saturday
  // The Monday after that weekend. From a Sunday that is tomorrow.
  const weekendEnd = dow === 0
    ? new Date(today.getTime() + day)
    : new Date(weekendStart.getTime() + 2 * day)
  const nextWeekEnd = new Date(weekendEnd.getTime() + 7 * day)

  const windows: { key: string; label: string; until: number }[] = [
    { key: 'soon',    label: 'In the next few days', until: weekendStart.getTime() },
    { key: 'weekend', label: 'This weekend',         until: weekendEnd.getTime() },
    { key: 'next',    label: 'Next week',            until: nextWeekEnd.getTime() },
    { key: 'later',   label: 'Further out',          until: Infinity },
  ]

  // ONE SHELF UNTIL THERE IS ENOUGH TO SHELVE.
  //
  // Buckets earn their keep by answering "is there anything this weekend?"
  // before you read a card. Below a certain size they stop answering anything
  // and start costing: measured on a real board of ten walks, four headings
  // each held one or two cards in a three-column grid, so every shelf was a
  // card and two card-widths of nothing, and the page ran to 5,900px to show
  // ten things. A heading over a single item is not an index, it is a caption —
  // and four of them in a column read as a board with less on it than there is.
  //
  // So under the threshold the board is one grid, in date order, which is what
  // the buckets were sorting into anyway. The whole mechanism comes back
  // untouched the moment there is enough on the board for it to be a shortcut
  // rather than a decoration.
  if (plans.length < BUCKET_THRESHOLD) {
    const sorted = [...plans].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )
    return sorted.length > 0
      ? [{ key: 'all', label: 'Soonest first', until: Infinity, plans: sorted }]
      : []
  }

  const buckets = windows.map((w) => ({ ...w, plans: [] as TrekPlanRow[] }))
  for (const p of plans) {
    const at = new Date(
      new Date(p.starts_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    ).getTime()
    // First window whose end is after this walk. Windows ascend, so the first
    // match is the right one.
    const b = buckets.find((w) => at < w.until) ?? buckets[buckets.length - 1]
    b.plans.push(p)
  }
  return buckets.filter((b) => b.plans.length > 0)
}
