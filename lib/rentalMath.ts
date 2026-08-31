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

// ── Phase two: coupons, extensions and settling the deposit ─────────────────

/** The shape of a coupon, reduced to only what pricing needs. Keeps this module
 *  free of database types, which is what makes it testable without a server. */
export type CouponRule = {
  type: 'percentage' | 'fixed'
  /** Percent (0-100) for a percentage coupon, paise for a fixed one. */
  value: number
  /** Cap on a percentage coupon, in paise. */
  maxDiscount?: number | null
}

/**
 * What a coupon takes off a rental.
 *
 * THREE RULES, AND EACH ONE IS A DECISION SOMEBODY COULD GET WRONG.
 *
 * 1. IT APPLIES TO THE RENT, AND ONLY THE RENT. Not the deposit — that is
 *    refundable security, and a percentage code applied to the payable-with-
 *    deposit figure would be giving away money the shop is only holding, then
 *    giving it back again at return. Not the delivery either: the return leg of
 *    a posted rental is a cost the shop cannot avoid, and discounting it means
 *    paying a courier out of a marketing budget.
 *
 * 2. IT APPLIES AFTER THE LONG-RENTAL DISCOUNT, to the net. Applying both to
 *    the gross would stack two percentages into more than either was authorised
 *    to give away.
 *
 * 3. IT CANNOT EXCEED THE RENT. A fixed ₹500 code on a ₹300 rental takes ₹300,
 *    not ₹500 — a negative line would turn a discount into a payment.
 */
export function couponDiscountOnRent(rentAfterLongDiscount: number, coupon: CouponRule): number {
  if (rentAfterLongDiscount <= 0) return 0

  let discount =
    coupon.type === 'percentage'
      ? Math.floor((rentAfterLongDiscount * coupon.value) / 100)
      : coupon.value

  if (coupon.type === 'percentage' && coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount)
  }

  return Math.max(0, Math.min(discount, rentAfterLongDiscount))
}

/**
 * What extra days cost on a rental that has already been agreed.
 *
 * A DELTA, NOT A RE-QUOTE, and this is the whole reason the function exists.
 *
 * Re-pricing the extended rental from scratch would re-apply the long-rental
 * discount across days that have already been paid for. On a rental that
 * crosses the seven-day threshold that makes the recomputed total LOWER than
 * what was already charged — so a customer asking to keep the gear longer would
 * end up owing less than before they asked. The clamp in `longRentalDiscount`
 * prevents a longer rental being cheaper than a shorter one at quote time; it
 * cannot prevent a re-quote being cheaper than a quote, because those are two
 * different agreements.
 *
 * So the extra days are charged at the rate frozen on the reservation, and the
 * original agreement is never reopened.
 *
 * The long-rental discount is deliberately NOT applied to the added days by
 * default. Whether it should is a commercial decision — see `discountPct`,
 * which the caller passes only when the shop has decided the answer is yes.
 */
export function extensionCharge(input: {
  dailyRate: number
  daysAdded: number
  quantity: number
  /** Only supplied when the shop has decided extensions earn the long-rental
   *  discount on their own days. Zero, and it does not. */
  discountPct?: number
}): { rent: number; discount: number; net: number } {
  const { dailyRate, daysAdded, quantity } = input
  if (daysAdded <= 0 || dailyRate <= 0 || quantity <= 0) {
    return { rent: 0, discount: 0, net: 0 }
  }

  const rent = dailyRate * daysAdded * quantity
  const pct = input.discountPct ?? 0
  // Reuses the clamped rule rather than a bare percentage, so an extension can
  // never be cheaper than a shorter extension either.
  const discount = longRentalDiscount(rent, daysAdded, pct)

  return { rent, discount, net: rent - discount }
}

/**
 * What happens to the deposit when the gear is back and inspected.
 *
 * Stated as one function because it was previously three expressions spread
 * across a server action, and the one thing a customer will check is that these
 * three numbers add up to what they lodged.
 *
 * `owed` is capped at the deposit before anything else, so the returned figures
 * always satisfy: refund + applied = deposit. Anything the shop believes it is
 * owed beyond the deposit is deliberately NOT represented here — it is a
 * conversation, not an automatic charge, and `unrecovered` reports it so the
 * conversation can be an informed one.
 */
export function settleDeposit(input: {
  deposit: number
  lateFee: number
  damageFee: number
}): { applied: number; refund: number; unrecovered: number; state: 'refunded' | 'forfeited' } {
  const deposit = Math.max(0, input.deposit)
  const owed = Math.max(0, input.lateFee) + Math.max(0, input.damageFee)

  const applied = Math.min(owed, deposit)
  const refund = deposit - applied
  const unrecovered = owed - applied

  return {
    applied,
    refund,
    unrecovered,
    // Forfeited means "none of it is coming back", which is only true when the
    // whole deposit was consumed. A partial deduction is still a refund.
    state: refund > 0 ? 'refunded' : 'forfeited',
  }
}

/**
 * Days late, counted the way a counter counts.
 *
 * `rentalDays` is inclusive, so a rental due back on the 14th and returned on
 * the 14th spans one day and is NOT late. Subtracting one is what turns an
 * inclusive span into an overrun, and it is done here rather than at each call
 * site because it was previously done at two of them and both had to be right.
 */
export function daysLate(dueOn: string, returnedOn: string): number {
  const span = rentalDays(dueOn, returnedOn)
  return span <= 0 ? 0 : span - 1
}
