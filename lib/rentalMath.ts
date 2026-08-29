/**
 * The arithmetic a rental is built on, with no dependencies of any kind.
 *
 * These rules used to live inside `lib/rentalPricing.ts`, which imports
 * `calculateShippingCost` and therefore the database. That made the money
 * rules — inclusive day counting, the long-rental discount, the late fee and
 * its cap — untestable without standing up a server, which is why they had no
 * tests at all despite being the part of this system most expensive to get
 * wrong.
 *
 * Nothing here imports anything. `rentalPricing.ts` composes these with the
 * shipping and tax lookups; `lib/rentalMath.test.ts` pins them.
 */

/** Inclusive day count: the 12th to the 14th is three days of rental, not two. */
export function rentalDays(startsOn: string, endsOn: string): number {
  const a = Date.parse(`${startsOn}T00:00:00Z`)
  const b = Date.parse(`${endsOn}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/** A discount starts once a rental reaches this many days. */
export const LONG_RENTAL_DAYS = 7

/**
 * A long rental earns a discount rather than a second price.
 *
 * One rate to reason about, so a seven-day rental can never come out cheaper in
 * total than a six-day one — which is what happens the moment a shop keeps a
 * separate "weekly price" beside a daily one and the two drift apart.
 *
 * THE COMMENT ABOVE WAS ASPIRATIONAL AND THE CODE BROKE IT. A flat percentage
 * applied at a threshold is a cliff: at 15% a seven-day rental of a ₹450 tent
 * came to ₹2,677.50 while six days cost ₹2,700. Longer was cheaper. On the
 * weekend bundle at 20% the gap was ₹340. Every rate above about 14.3% has this
 * hole, and all three discounted items are above it.
 *
 * The discount is now clamped so it can never take the total below the last
 * undiscounted duration. That guarantees the invariant the comment claims —
 * the total never decreases as days increase — without inventing a new pricing
 * policy, which is the shop's decision and not this function's.
 *
 * A consequence worth knowing: at 15% the seventh day is now free rather than
 * profitable-in-reverse, and the saving only starts to grow from day eight. If
 * the intent is a real saving at exactly seven days, the threshold or the
 * percentage wants revisiting — see `daysToBreakEven` below.
 */
export function longRentalDiscount(rent: number, days: number, pct: number): number {
  if (days < LONG_RENTAL_DAYS || pct <= 0) return 0
  const raw = Math.round((rent * pct) / 100)

  // `rent` is the gross for `days` at the daily rate, so the rate divides out.
  const dailyRate = rent / days
  const lastUndiscountedTotal = dailyRate * (LONG_RENTAL_DAYS - 1)
  const mostWeCanTakeOff = Math.max(0, Math.round(rent - lastUndiscountedTotal))

  return Math.min(raw, mostWeCanTakeOff)
}

/**
 * The first day count at which a discounted rental actually costs the customer
 * less than stopping at the threshold. Useful for saying "cheaper from day N"
 * honestly rather than advertising a saving that starts as zero.
 */
export function daysToBreakEven(pct: number): number {
  if (pct <= 0) return Infinity
  let days = LONG_RENTAL_DAYS
  const rate = 1000 // any rate; the answer is rate-independent
  const base = rate * (LONG_RENTAL_DAYS - 1)
  while (days < 400) {
    const gross = rate * days
    if (gross - longRentalDiscount(gross, days, pct) > base) return days
    days++
  }
  return Infinity
}

/**
 * A late return is charged at the day rate and capped at the deposit.
 *
 * The cap matters: without it a forgotten tent could run up a bill larger than
 * anything we are holding, and we would be invoicing a customer rather than
 * deducting from money already in hand.
 */
export function lateFee(dailyRate: number, daysLate: number, depositHeld: number): number {
  if (daysLate <= 0) return 0
  const raw = dailyRate * daysLate
  return depositHeld > 0 ? Math.min(raw, depositHeld) : raw
}

/**
 * What GST applies to.
 *
 * The deposit is NOT consideration — it is refundable money held against
 * damage, and taxing it would both overcharge the customer and misstate the
 * shop's liability. Delivery IS a supply and is taxed with the rental.
 */
export function taxableBase(rentAfterDiscount: number, delivery: number): number {
  return rentAfterDiscount + delivery
}

export function gstOn(base: number, ratePct: number): number {
  return Math.round((base * ratePct) / 100)
}
