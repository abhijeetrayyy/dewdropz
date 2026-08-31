import { calculateShippingCost } from '@/actions/shipping'
// The pure rules live in lib/rentalMath.ts so they can be tested without a
// database. This file composes them with the shipping and tax lookups.
import {
  longRentalDiscount, rentalDays, lateFee,
  couponDiscountOnRent, extensionCharge, settleDeposit, daysLate,
  type CouponRule,
} from '@/lib/rentalMath'

export { rentalDays, lateFee, extensionCharge, settleDeposit, daysLate }
export type { CouponRule }

/**
 * What a rental costs. One function, and it is the only one.
 *
 * This is the same rule `lib/checkoutPricing.ts` states for sales, applied to
 * rentals: the quote the customer approves and the booking that bills them call
 * the same code. Two implementations of the same pricing drift, and the day
 * they drift the shop either quotes less than it charges or charges more than
 * it quoted. Rentals get their own function rather than an extra branch inside
 * the sale pricer because almost every rule below is genuinely different —
 * sharing the function would mean a tangle of `if (isRental)` inside the one
 * piece of code in this repository that must stay obvious.
 *
 * THREE THINGS THAT ARE NOT LIKE A SALE
 *
 * 1. GST IS A SERVICE RATE, NOT AN HSN RATE. Renting equipment is a supply of
 *    service (SAC, commonly 18%), not a supply of goods. `priceCheckout` reads
 *    HSN per line and would charge a garment's 5%/12% on a tent rental. The rate
 *    lives on the item and is applied here.
 *
 * 2. THE DEPOSIT IS NOT TAXED AND NOT REVENUE. It is refundable security, not
 *    consideration for a supply. Taxing it would overcharge every renter and
 *    overstate output tax. It is collected, held, and given back — so it sits
 *    outside the taxable base and is reported separately from the total.
 *
 * 3. POSTED GEAR PAYS ITS RETURN LEG. A rented tent has to come back. Charging
 *    one-way delivery would mean the shop silently absorbing the return on
 *    every posted rental, which is exactly the kind of quiet leak the flat-₹150
 *    shipping constant turned out to be. Pickup pays nothing.
 */

export type RentalPricedLine = {
  itemId: string
  slug: string
  name: string
  /** Paise, per day, frozen from the item at quote time. */
  dailyRate: number
  deposit: number
  weeklyDiscountPct: number
  gstRate: number
  sacCode?: string | null
  minDays: number
  maxDays: number
  /** Grams, for the delivery calculation on a posted rental. */
  weightGrams?: number | null
  startsOn: string
  endsOn: string
  quantity: number
}

export type RentalPrice = {
  lines: {
    itemId: string
    slug: string
    name: string
    days: number
    quantity: number
    dailyRate: number
    /** Rent after any long-rental discount, for all units on this line. */
    rentAmount: number
    discountAmount: number
    /** This line's share of any coupon, apportioned by net rent. */
    couponShare: number
    /** Rent after EVERY discount — the value of supply, and what tax is on. */
    taxableValue: number
    depositAmount: number
    taxAmount: number
    gstRate: number
    sacCode: string | null
  }[]
  rentAmount: number
  discountAmount: number
  /** What a coupon took off, kept apart from the duration discount so a
   *  campaign's cost can be answered. */
  couponDiscount: number
  couponCode: string | null
  deliveryAmount: number
  taxAmount: number
  /** Held, refundable, and deliberately outside the taxable base. */
  depositAmount: number
  /** Rent + delivery + tax. What is actually charged for the rental. */
  totalAmount: number
  /** What the customer hands over in total at the counter, deposit included. */
  payableWithDeposit: number
  taxIsIgst: boolean
  errors: string[]
}



export async function priceRental(input: {
  lines: RentalPricedLine[]
  fulfilment: 'pickup' | 'ship'
  state?: string | null
  country?: string | null
  /** Already validated by the caller — this function prices, it does not decide
   *  whether a code is spendable. Keeping the check out here is what stops the
   *  quote path and the booking path drifting on eligibility. */
  coupon?: { code: string; rule: CouponRule } | null
}): Promise<RentalPrice> {
  const errors: string[] = []
  const lines: RentalPrice['lines'] = []

  let rentAmount = 0
  let discountAmount = 0
  let depositAmount = 0
  let taxAmount = 0
  let weightGrams = 0

  for (const l of input.lines) {
    const days = rentalDays(l.startsOn, l.endsOn)
    if (days <= 0) {
      errors.push(`${l.name}: those dates don’t make sense.`)
      continue
    }
    if (days < l.minDays) {
      errors.push(`${l.name} is rented for a minimum of ${l.minDays} day${l.minDays === 1 ? '' : 's'}.`)
      continue
    }
    if (days > l.maxDays) {
      errors.push(`${l.name} can be rented for at most ${l.maxDays} days.`)
      continue
    }

    const qty = Math.max(1, l.quantity)
    const gross = l.dailyRate * days * qty
    const discount = longRentalDiscount(gross, days, l.weeklyDiscountPct)
    const net = gross - discount
    const dep = l.deposit * qty

    // Tax is NOT computed here any more. A coupon comes off the rent, and tax
    // is charged on the value of supply AFTER every discount (s.15) — so the
    // rate cannot be applied until the coupon has been apportioned across the
    // lines below. Taxing here and discounting afterwards would over-collect.
    lines.push({
      itemId: l.itemId, slug: l.slug, name: l.name,
      days, quantity: qty, dailyRate: l.dailyRate,
      rentAmount: net, discountAmount: discount,
      couponShare: 0, taxableValue: net,
      depositAmount: dep,
      taxAmount: 0, gstRate: l.gstRate, sacCode: l.sacCode ?? null,
    })

    rentAmount += net
    discountAmount += discount
    depositAmount += dep
    weightGrams += (l.weightGrams ?? 0) * qty
  }

  // ── The coupon, applied to the rent and apportioned across the lines ──────
  //
  // Apportioned rather than taken off a total, because an invoice line has to
  // state its own discount (s.15(3)(a) only excludes a discount from value if
  // it is recorded in the invoice) and because tax is charged per line at that
  // line's own rate — a two-item rental at different rates cannot have one
  // pooled discount without deciding which rate it reduces.
  //
  // LARGEST REMAINDER, not naive rounding. Apportioning ₹100 across three equal
  // lines by rounding gives 33 + 33 + 33 and loses a paisa, and that paisa is
  // the difference between an invoice that reconciles and one that does not.
  let couponDiscount = 0
  const couponCode = input.coupon?.code ?? null
  if (input.coupon && rentAmount > 0) {
    couponDiscount = couponDiscountOnRent(rentAmount, input.coupon.rule)

    if (couponDiscount > 0) {
      const exact = lines.map((l) => (couponDiscount * l.rentAmount) / rentAmount)
      const floors = exact.map((v) => Math.floor(v))
      let remainder = couponDiscount - floors.reduce((a, b) => a + b, 0)

      // The lines with the largest fractional part get the spare paise.
      const order = exact
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac)

      const share = floors.slice()
      for (const { i } of order) {
        if (remainder <= 0) break
        share[i] += 1
        remainder -= 1
      }

      lines.forEach((l, i) => {
        l.couponShare = share[i]
        l.taxableValue = l.rentAmount - share[i]
      })
    }
  }

  // Now tax, on what is actually being supplied for.
  for (const l of lines) {
    l.taxAmount = Math.round((l.taxableValue * l.gstRate) / 100)
    taxAmount += l.taxAmount
  }

  // Delivery, both ways, and only when it is actually posted.
  let deliveryAmount = 0
  if (input.fulfilment === 'ship' && lines.length > 0) {
    const oneWay = await calculateShippingCost({
      state: input.state,
      country: input.country,
      // Deliberately NOT passing the rent as `subtotal`: free-shipping
      // thresholds are a sales promotion, and a rental that qualifies for free
      // delivery still has to be posted back at the shop's expense.
      subtotal: 0,
      weightGrams: weightGrams || 1000,
    })
    deliveryAmount = oneWay * 2
  }

  // Delivery is a supply too, taxed at the same service rate as the rental it
  // belongs to. Where lines disagree on rate, the highest is used rather than
  // an average — under-collecting tax is the worse error of the two.
  const deliveryRate = lines.length ? Math.max(...lines.map((l) => l.gstRate)) : 0
  const deliveryTax = Math.round((deliveryAmount * deliveryRate) / 100)
  taxAmount += deliveryTax

  // `rentAmount` is still the figure BEFORE the coupon, because that is what
  // the breakdown shows as the rental's own price — the coupon is then a visible
  // line under it rather than a silently smaller number. The total takes the
  // discount off, and the taxable values it was computed from already have.
  const totalAmount = rentAmount - couponDiscount + deliveryAmount + taxAmount

  return {
    lines,
    rentAmount,
    discountAmount,
    couponDiscount,
    couponCode,
    deliveryAmount,
    taxAmount,
    depositAmount,
    totalAmount,
    payableWithDeposit: totalAmount + depositAmount,
    // Place of supply: the shop is in Uttarakhand, so anywhere else is IGST.
    taxIsIgst: (input.state ?? '').trim().toLowerCase() !== 'uttarakhand',
    errors,
  }
}

/**
 * What is owed when gear comes back late.
 *
 * Charged per day at the full daily rate, because a late unit is a unit the
 * next person could not book. Capped at the deposit so a forgotten return
 * cannot generate an unbounded bill — a shop chasing someone for more than the
 * security they lodged is a legal argument, not a rental business.
 */

// ── Extending a rental already under way ───────────────────────────────────

export type ExtensionQuote = {
  ok: true
  previousEnd: string
  newEnd: string
  daysAdded: number
  /** Per reservation, so the caller can widen each held period and charge for
   *  exactly the units it is widening. */
  lines: { reservationId: string; unitId: string; itemName: string; rent: number; discount: number; taxableValue: number; taxAmount: number; gstRate: number }[]
  rentAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
}

/**
 * What extending to a new end date costs.
 *
 * Deliberately does NOT check availability — that is the caller's job, and it
 * has to be done against the database with the reservation excluded. Splitting
 * them keeps this function pure enough to reason about, and stops a quote and a
 * commit disagreeing because one of them re-read the shelf.
 *
 * No delivery is charged. The gear is already with the customer; extending does
 * not move it. If the return leg was paid for at booking it is still paid for.
 */
export function priceRentalExtension(input: {
  newEnd: string
  reservations: {
    id: string
    unitId: string
    itemName: string
    endsOn: string
    dailyRate: number
    gstRate: number
    /** Only when the shop has decided extensions earn the duration discount. */
    discountPct?: number
  }[]
}): ExtensionQuote | { ok: false; error: string } {
  if (!input.reservations.length) {
    return { ok: false, error: 'There is nothing on this rental to extend.' }
  }

  // Every line on a booking shares an end date today, and the extension moves
  // all of them together — a rental where one tent goes back on Tuesday and
  // another on Friday is a different product, and pretending to support it here
  // would mean a screen that cannot express what it just did.
  const currentEnd = input.reservations.reduce((a, r) => (r.endsOn > a ? r.endsOn : a), input.reservations[0].endsOn)

  const daysAdded = rentalDays(currentEnd, input.newEnd) - 1
  if (daysAdded <= 0) {
    return { ok: false, error: 'Pick a date after the one the rental already runs to.' }
  }

  const lines = input.reservations.map((r) => {
    const { rent, discount, net } = extensionCharge({
      dailyRate: r.dailyRate,
      daysAdded,
      quantity: 1, // one reservation is one unit, by construction
      discountPct: r.discountPct,
    })
    return {
      reservationId: r.id,
      unitId: r.unitId,
      itemName: r.itemName,
      rent,
      discount,
      taxableValue: net,
      taxAmount: Math.round((net * r.gstRate) / 100),
      gstRate: r.gstRate,
    }
  })

  const rentAmount = lines.reduce((a, l) => a + l.rent, 0)
  const discountAmount = lines.reduce((a, l) => a + l.discount, 0)
  const taxAmount = lines.reduce((a, l) => a + l.taxAmount, 0)

  return {
    ok: true,
    previousEnd: currentEnd,
    newEnd: input.newEnd,
    daysAdded,
    lines,
    rentAmount,
    discountAmount,
    taxAmount,
    totalAmount: rentAmount - discountAmount + taxAmount,
  }
}
