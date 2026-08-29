import { calculateShippingCost } from '@/actions/shipping'
// The pure rules live in lib/rentalMath.ts so they can be tested without a
// database. This file composes them with the shipping and tax lookups.
import { longRentalDiscount, rentalDays, lateFee } from '@/lib/rentalMath'

export { rentalDays, lateFee }

/**
 * What a hire costs. One function, and it is the only one.
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
 * 1. GST IS A SERVICE RATE, NOT AN HSN RATE. Hiring equipment is a supply of
 *    service (SAC, commonly 18%), not a supply of goods. `priceCheckout` reads
 *    HSN per line and would charge a garment's 5%/12% on a tent hire. The rate
 *    lives on the item and is applied here.
 *
 * 2. THE DEPOSIT IS NOT TAXED AND NOT REVENUE. It is refundable security, not
 *    consideration for a supply. Taxing it would overcharge every renter and
 *    overstate output tax. It is collected, held, and given back — so it sits
 *    outside the taxable base and is reported separately from the total.
 *
 * 3. POSTED GEAR PAYS ITS RETURN LEG. A hired tent has to come back. Charging
 *    one-way delivery would mean the shop silently absorbing the return on
 *    every posted hire, which is exactly the kind of quiet leak the flat-₹150
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
  minDays: number
  maxDays: number
  /** Grams, for the delivery calculation on a posted hire. */
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
    /** Rent after any long-hire discount, for all units on this line. */
    rentAmount: number
    discountAmount: number
    depositAmount: number
    taxAmount: number
    gstRate: number
  }[]
  rentAmount: number
  discountAmount: number
  deliveryAmount: number
  taxAmount: number
  /** Held, refundable, and deliberately outside the taxable base. */
  depositAmount: number
  /** Rent + delivery + tax. What is actually charged for the hire. */
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

    // Tax on the hire only. Never on the deposit — see the header.
    const tax = Math.round((net * l.gstRate) / 100)

    lines.push({
      itemId: l.itemId, slug: l.slug, name: l.name,
      days, quantity: qty, dailyRate: l.dailyRate,
      rentAmount: net, discountAmount: discount, depositAmount: dep,
      taxAmount: tax, gstRate: l.gstRate,
    })

    rentAmount += net
    discountAmount += discount
    depositAmount += dep
    taxAmount += tax
    weightGrams += (l.weightGrams ?? 0) * qty
  }

  // Delivery, both ways, and only when it is actually posted.
  let deliveryAmount = 0
  if (input.fulfilment === 'ship' && lines.length > 0) {
    const oneWay = await calculateShippingCost({
      state: input.state,
      country: input.country,
      // Deliberately NOT passing the rent as `subtotal`: free-shipping
      // thresholds are a sales promotion, and a hire that qualifies for free
      // delivery still has to be posted back at the shop's expense.
      subtotal: 0,
      weightGrams: weightGrams || 1000,
    })
    deliveryAmount = oneWay * 2
  }

  // Delivery is a supply too, taxed at the same service rate as the hire it
  // belongs to. Where lines disagree on rate, the highest is used rather than
  // an average — under-collecting tax is the worse error of the two.
  const deliveryRate = lines.length ? Math.max(...lines.map((l) => l.gstRate)) : 0
  const deliveryTax = Math.round((deliveryAmount * deliveryRate) / 100)
  taxAmount += deliveryTax

  const totalAmount = rentAmount + deliveryAmount + taxAmount

  return {
    lines,
    rentAmount,
    discountAmount,
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
