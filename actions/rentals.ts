'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminSupabaseClient, createPublicSupabaseClient } from '@/lib/supabase'
import { getUser, requireAdmin } from './auth'
import { rateLimit } from '@/lib/rateLimit'
import { shopToday, shopAddDays, isPastShopDay } from '@/lib/shopTime'
import { cancellationRefund } from '@/lib/rentalPolicy'
import { sendSlackAlert } from '@/lib/slack'
import { claimGuestRentalBookingsFor } from '@/lib/rentalClaim'
import { sendRentalConfirmationEmail } from '@/lib/email'
import {
  priceRental, rentalDays, lateFee, settleDeposit, daysLate,
  type RentalPrice, type RentalPricedLine, type CouponRule,
} from '@/lib/rentalPricing'
import { couponDiscountOnRent } from '@/lib/rentalMath'
import type { RentalItem, RentalUnit, RentalBooking, RentalReservation } from '@/types/database'

/**
 * Renting gear.
 *
 * The shape of this module follows the one rule the sale path already lives by:
 * nothing the browser sends is trusted with a price or with availability. A
 * request carries slugs, dates and quantities; every rupee is resolved from
 * `rental_items`, and every unit is resolved from
 * `rental_available_units(...)` — the same database function the storefront
 * calendar and the admin view read, so the shelf a customer is shown and the
 * shelf they book against cannot be two different opinions.
 *
 * AVAILABILITY IS CHECKED TWICE, ON PURPOSE. Once here, to give a sentence a
 * person can act on ("only one left for those dates"), and once by the
 * exclusion constraint in migration 096, which is what actually makes a double
 * booking impossible when two people check out for the last tent in the same
 * second. The check is for the message; the constraint is for the truth.
 */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

const rentalLineSchema = z
  .object({
    slug: z.string().min(1),
    startsOn: DATE,
    endsOn: DATE,
    quantity: z.number().int().min(1).max(10),
  })
  // A hire cannot start in the past. Nothing checked this anywhere: the quote
  // endpoint would price `2025-01-10 → 2025-01-12` cleanly, with `errors: []`,
  // and report four units free — and `book` runs the same code and inserts. The
  // resulting booking is overdue the moment it exists, gets chased by the
  // reminder sweep, and accrues a late fee capped only by the deposit.
  //
  // The only floor was the `min` attribute on a date input, which is a
  // suggestion to a browser, not a rule. In the shop's timezone, because a UTC
  // "today" is yesterday for the first five and a half hours of every IST day.
  .refine((l) => !isPastShopDay(l.startsOn), {
    message: 'That start date has already passed.',
    path: ['startsOn'],
  })
  // A booking a year out is almost always a typo in the year, and a unit
  // reserved for 2031 is gear the shop will have retired.
  .refine((l) => l.startsOn <= shopAddDays(shopToday(), 365), {
    message: 'We take bookings up to a year ahead. For anything further out, call the shop.',
    path: ['startsOn'],
  })

const bookingSchema = z.object({
  lines: z.array(rentalLineSchema).min(1).max(10),
  fulfilment: z.enum(['pickup', 'ship']),
  // Normalised on the way in, and this is load-bearing rather than tidy:
  // `claimGuestRentalBookingsFor` matches with `.eq('email', …)` in SQL, so a
  // booking stored as "Abhi.Ray@Gmail.com" would never be claimed by the
  // account that made it. (It used to match with `.ilike`, which papered over
  // this and cost far more than it hid — see lib/rentalClaim.ts.)
  // `findRentalBooking` lowercases both sides in JS and is immune either way.
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().max(20).optional(),
  address: z.record(z.string(), z.unknown()).nullish(),
  pickupSlot: z.string().datetime().nullish(),
  notes: z.string().max(500).optional(),
  couponCode: z.string().trim().max(40).optional().nullable(),
})

export type RentalQuoteInput = z.infer<typeof bookingSchema>

// ── Public reads ────────────────────────────────────────────────────────────

export async function getRentalItems(): Promise<RentalItem[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('rental_items')
    .select('*')
    .eq('is_active', true)
    .order('sort', { ascending: true })
    .order('name', { ascending: true })
  if (error) return []
  return (data ?? []) as RentalItem[]
}

/**
 * Can this product also be rented, and from how much a day?
 *
 * The link lives on `rental_items.product_id` rather than on the product,
 * because renting is the narrower case — most products will never be rentable,
 * and every product listing in the shop would otherwise pay for a join it never
 * uses. So the product page asks separately, for the one product it shows.
 */
export async function getRentalForProduct(
  productId: string,
): Promise<{ slug: string; daily_rate: number; deposit: number } | null> {
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from('rental_items')
    .select('slug,daily_rate,deposit')
    .eq('product_id', productId)
    .eq('is_active', true)
    .maybeSingle()
  return (data as { slug: string; daily_rate: number; deposit: number }) ?? null
}

export async function getRentalItem(slug: string): Promise<RentalItem | null> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from('rental_items')
    // The sellable product rides along, so the page can offer "own it instead"
    // without a second round trip.
    .select('*, product:products(slug,name,price,inventory_quantity)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) return null
  return (data as RentalItem) ?? null
}

/**
 * How many units of an item are free for a window.
 *
 * Answered by the database function so the buffer between rentals is applied by
 * the same code the booking write uses. A unit due back the morning somebody
 * wants it is correctly reported as unavailable.
 */
export async function getRentalAvailability(
  itemId: string,
  startsOn: string,
  endsOn: string,
): Promise<{ available: number; unitIds: string[] }> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.rpc('rental_available_units', {
    p_item_id: itemId,
    p_start: startsOn,
    p_end: endsOn,
  })
  if (error) return { available: 0, unitIds: [] }
  const rows = (data ?? []) as { unit_id: string }[]
  return { available: rows.length, unitIds: rows.map((r) => r.unit_id) }
}

/** What a rental would cost. Public — a shopper deserves the real figure while deciding. */
export async function quoteRental(input: RentalQuoteInput): Promise<
  { ok: true; price: RentalPrice } | { ok: false; error: string }
> {
  // Unauthenticated and it resolves coupon codes, which makes it a coupon
  // oracle: `checkRentalCoupon` next door is limited to 20/10min for exactly
  // that reason and this was not limited at all. Generous, because the quote
  // legitimately re-fires as a shopper edits dates and an address.
  const limited = await rateLimit('rental-quote', { limit: 60, windowSeconds: 600 })
  if (!limited.ok) return { ok: false, error: 'Too many price checks just now. Give it a minute.' }

  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) {
    // Surface the schema's own sentence when it has one — "That start date has
    // already passed" is worth saying, and "Check the dates and try again" for
    // a date in 2025 sent a shopper back to look at dates that were fine.
    const first = parsed.error.issues[0]?.message
    return { ok: false, error: first ?? 'Check the dates and try again.' }
  }

  const priced = await buildPricedLines(parsed.data)
  if (!priced.ok) return { ok: false, error: priced.error }

  const state =
    parsed.data.fulfilment === 'ship'
      ? ((parsed.data.address?.state as string | undefined) ?? null)
      : 'Uttarakhand'

  // The coupon is resolved BEFORE pricing rather than applied after, so the
  // quote a shopper sees and the booking they pay for run through one function
  // with the same inputs. A discount applied afterwards is a second pricer.
  const coupon = parsed.data.couponCode
    ? await resolveRentalCoupon(parsed.data.couponCode)
    : null

  const price = await priceRental({
    lines: priced.lines,
    fulfilment: parsed.data.fulfilment,
    state,
    country: 'India',
    coupon: coupon && coupon.ok ? { code: coupon.code, rule: coupon.rule } : null,
  })

  // A code that was typed and refused is reported, because silently pricing
  // without it is how somebody comes to believe a discount was applied.
  if (parsed.data.couponCode && coupon && !coupon.ok) {
    price.errors.push(coupon.error)
  }

  return { ok: true, price }
}

// ── Coupons on a rental ─────────────────────────────────────────────────────

type ResolvedCoupon =
  | { ok: true; id: string; code: string; rule: CouponRule }
  | { ok: false; error: string }

/**
 * Is this code spendable on a rental, and what does it do?
 *
 * SEPARATE FROM `validateCoupon` IN actions/cart.ts, deliberately, and the
 * reason is the `applies_to` column that migration 100 added. A code written
 * for the shop is not automatically valid on the gear locker — the two have
 * different margins, and a rental carries a return-postage leg the shop cannot
 * avoid, so "20% off everything" meaning both was never a decision anybody
 * made. The column defaults to 'sale', so every code that existed before
 * rentals stays a shop code until somebody deliberately says otherwise.
 *
 * Read with the service-role client for the same reason the sale path is: the
 * public read policy on coupons was dropped in migration 093 after it turned
 * out to let anyone enumerate every live code with its value. This looks up the
 * ONE code the customer typed and returns a yes/no.
 */
async function resolveRentalCoupon(rawCode: string): Promise<ResolvedCoupon> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { ok: false, error: 'Enter a code.' }

  const supabase = createAdminSupabaseClient()
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) return { ok: false, error: 'That code is not valid.' }

  if (coupon.applies_to === 'sale') {
    // Named plainly rather than "invalid", because the code IS real and the
    // customer may have just used it in the shop an hour ago.
    return { ok: false, error: 'That code works in the shop, but not on rentals.' }
  }
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    return { ok: false, error: 'That code is not live yet.' }
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, error: 'That code has expired.' }
  }
  if (coupon.usage_limit && (coupon.usage_count ?? 0) >= coupon.usage_limit) {
    return { ok: false, error: 'That code has been fully used.' }
  }

  return {
    ok: true,
    id: coupon.id as string,
    code,
    rule: {
      type: coupon.type as 'percentage' | 'fixed',
      value: coupon.value as number,
      maxDiscount: coupon.max_discount_amount as number | null,
    },
  }
}

/**
 * Public check, for the field on the booking form.
 *
 * Returns what the code would take off THIS rental rather than a bare valid/
 * invalid, because "SUMMER20 is valid" and "SUMMER20 saves you ₹270" are
 * different amounts of help and only one of them is the answer to the question
 * somebody typed the code to ask.
 */
export async function checkRentalCoupon(input: {
  code: string
  rentAmount: number
}): Promise<{ ok: true; code: string; discount: number } | { ok: false; error: string }> {
  const limited = await rateLimit('rental-coupon', { limit: 20, windowSeconds: 600 })
  if (!limited.ok) return { ok: false, error: limited.error }

  const resolved = await resolveRentalCoupon(input.code)
  if (!resolved.ok) return resolved

  const discount = couponDiscountOnRent(Math.max(0, input.rentAmount), resolved.rule)
  if (discount <= 0) {
    return { ok: false, error: 'That code takes nothing off this rental.' }
  }
  return { ok: true, code: resolved.code, discount }
}

/** Resolve slugs to real items, refusing anything the shop does not offer. */
type PricedLines =
  | { ok: false; error: string }
  | { ok: true; lines: RentalPricedLine[]; bySlug: Map<string, RentalItem> }

async function buildPricedLines(input: RentalQuoteInput): Promise<PricedLines> {
  const supabase = createAdminSupabaseClient()
  const slugs = [...new Set(input.lines.map((l) => l.slug))]
  const { data: items } = await supabase
    .from('rental_items')
    .select('*')
    .in('slug', slugs)
    .eq('is_active', true)

  const bySlug = new Map((items ?? []).map((i) => [i.slug as string, i as RentalItem]))
  const missing = slugs.filter((s) => !bySlug.has(s))
  if (missing.length) {
    return { ok: false, error: 'Something in your booking is no longer available to rent.' }
  }

  const lines = input.lines.map((l) => {
    const it = bySlug.get(l.slug)!
    return {
      itemId: it.id,
      slug: it.slug,
      name: it.name,
      dailyRate: it.daily_rate,
      deposit: it.deposit,
      weeklyDiscountPct: it.weekly_discount_pct,
      gstRate: Number(it.gst_rate),
      sacCode: it.sac_code,
      minDays: it.min_days,
      maxDays: it.max_days,
      startsOn: l.startsOn,
      endsOn: l.endsOn,
      quantity: l.quantity,
    }
  })

  // Fulfilment has to be one the item actually supports — a 4-person tent that
  // is pickup-only must not be postable just because the cart says so.
  for (const l of input.lines) {
    const it = bySlug.get(l.slug)!
    if (input.fulfilment === 'ship' && !it.allows_shipping) {
      return { ok: false, error: `${it.name} is collection-only — it cannot be posted.` }
    }
    if (input.fulfilment === 'pickup' && !it.allows_pickup) {
      return { ok: false, error: `${it.name} is only available posted.` }
    }
  }

  return { ok: true, lines, bySlug }
}

/**
 * A booking number a person can read out over the phone.
 *
 * The tail was four decimal digits — 9,000 per day — drawn once with no retry,
 * against a UNIQUE constraint. That is the birthday problem with a customer on
 * the other end: at fifty bookings in a day there is already a 12.7% chance two
 * of them collide, and a collision did not retry, it failed the booking and
 * told somebody "could not start that booking".
 *
 * Now five crockford-ish base32 characters — no I, L, O or U, so it cannot be
 * misheard as a digit or read as a word — giving ~33.5 million per day instead
 * of 9,000. `createRentalBooking` also retries on a unique violation, because
 * more entropy makes a collision unlikely, not impossible, and the difference
 * between those two is somebody's booking.
 */
const NUMBER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function bookingNumber(): string {
  // The SHOP's date, not UTC. Every booking taken between midnight and 05:30
  // IST used to carry yesterday's date on the number staff read out and file by.
  const stamp = shopToday().replace(/-/g, '')
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  const tail = Array.from(bytes, (b) => NUMBER_ALPHABET[b % NUMBER_ALPHABET.length]).join('')
  return `DDZ-R-${stamp}-${tail}`
}

// ── The booking write ───────────────────────────────────────────────────────

export async function createRentalBooking(
  input: RentalQuoteInput & { userId?: string | null },
): Promise<
  | { ok: true; bookingId: string; bookingNumber: string }
  // `code` exists so callers can tell "the world moved" from "you sent
  // nonsense" WITHOUT pattern-matching the prose. The mobile route needs that
  // distinction to answer 409 rather than 400, and matching on wording is a
  // contract that breaks silently the first time a sentence is reworded — as
  // it did: a regex looking for "none free" never matched the real message,
  // "… is not free between …", so a sold-out rental answered 400.
  | { ok: false; error: string; code?: 'unavailable' }
> {
  // The one endpoint in this system that consumes PHYSICAL inventory, and it
  // was the one with no throttle — while the coupon check, the guest lookup,
  // the payment start and the extension request all had one. Twenty-five
  // unauthenticated POSTs to the mobile booking route were fired in a shell
  // loop during the rental council; twenty-five reached the business logic.
  // Each successful one holds a real unit for real dates and sends a real
  // email, and because the exclusion constraint is doing its job those units
  // are genuinely blocked. That is denial-of-inventory for the price of a
  // for-loop.
  //
  // Six in ten minutes per caller. A shared IP (a hostel, a campus) booking
  // seven rentals inside ten minutes is not a scenario this shop has.
  const limited = await rateLimit('rental-book', { limit: 6, windowSeconds: 600 })
  if (!limited.ok) {
    return { ok: false, error: 'That is a lot of bookings at once. Give it a minute, or call the shop.' }
  }

  const parsed = bookingSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message
    return { ok: false, error: first ?? 'Check the dates and try again.' }
  }
  if (parsed.data.fulfilment === 'ship' && !parsed.data.address) {
    return { ok: false, error: 'Add a delivery address, or choose collection instead.' }
  }

  const priced = await buildPricedLines(parsed.data)
  if (!priced.ok) return { ok: false, error: priced.error }

  const supabase = createAdminSupabaseClient()

  // Pick actual units, and refuse early with a sentence that says what is short.
  const assignments: { line: (typeof priced.lines)[number]; unitIds: string[] }[] = []
  for (const line of priced.lines) {
    const { available, unitIds } = await getRentalAvailability(line.itemId, line.startsOn, line.endsOn)
    if (available < line.quantity) {
      return {
        ok: false,
        code: 'unavailable',
        error:
          available === 0
            ? `${line.name} is not free between ${line.startsOn} and ${line.endsOn}.`
            : `Only ${available} ${line.name} free for those dates — you asked for ${line.quantity}.`,
      }
    }
    assignments.push({ line, unitIds: unitIds.slice(0, line.quantity) })
  }

  const state =
    parsed.data.fulfilment === 'ship'
      ? ((parsed.data.address?.state as string | undefined) ?? null)
      : 'Uttarakhand'
  // Resolved here as well as in the quote, and NOT passed through from the
  // browser. A code the client sends is a claim; a code the server looks up is
  // a fact — and this is the call that decides what somebody is charged.
  const coupon = parsed.data.couponCode ? await resolveRentalCoupon(parsed.data.couponCode) : null
  if (parsed.data.couponCode && coupon && !coupon.ok) {
    return { ok: false, error: coupon.error }
  }

  const price = await priceRental({
    lines: priced.lines,
    fulfilment: parsed.data.fulfilment,
    state,
    country: 'India',
    coupon: coupon && coupon.ok ? { code: coupon.code, rule: coupon.rule } : null,
  })
  if (price.errors.length) return { ok: false, error: price.errors[0] }

  // Retry on a duplicate number. Entropy makes a collision unlikely; the retry
  // makes it harmless. Anything that is NOT a unique violation breaks out
  // immediately — retrying a real error just fails three times more slowly.
  let booking: { id: string; booking_number: string } | null = null
  let bookingErr: { code?: string; message?: string } | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
    .from('rental_bookings')
    .insert({
      booking_number: bookingNumber(),
      user_id: input.userId ?? null,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      fulfilment: parsed.data.fulfilment,
      address: parsed.data.address ?? null,
      pickup_slot: parsed.data.pickupSlot ?? null,
      rent_amount: price.rentAmount,
      delivery_amount: price.deliveryAmount,
      tax_amount: price.taxAmount,
      deposit_amount: price.depositAmount,
      total_amount: price.totalAmount,
      long_rental_discount: price.discountAmount,
      coupon_id: coupon && coupon.ok ? coupon.id : null,
      coupon_code: price.couponCode,
      coupon_discount: price.couponDiscount,
      // Pickup is paid at the counter unless the customer chooses to pay now;
      // a posted rental has no counter, so the payment screen is where it goes
      // next. Either way the booking starts unpaid and the money moves later.
      payment_method: parsed.data.fulfilment === 'pickup' ? 'cod' : null,
      deposit_method: parsed.data.fulfilment === 'pickup' ? 'cash' : 'gateway',
      notes: parsed.data.notes ?? null,
    })
    .select('id, booking_number')
    .single()

    if (!error) { booking = data as { id: string; booking_number: string }; break }
    bookingErr = error
    // 23505 = unique_violation. Only that is worth another go.
    if (error.code !== '23505') break
  }

  if (!booking) {
    console.error('[rentals] could not create booking', bookingErr)
    return { ok: false, error: 'Could not start that booking. Try again.' }
  }

  // Reservations. The exclusion constraint is the real gate: between the
  // availability read above and this insert, somebody else may have taken the
  // last unit. A 23P01 here is that race losing, not a bug.
  const rows: Record<string, unknown>[] = []
  for (const { line, unitIds } of assignments) {
    const days = rentalDays(line.startsOn, line.endsOn)
    const item = priced.bySlug.get(line.slug)!
    const pricedLine = price.lines.find((p) => p.itemId === line.itemId)

    // Split across the units on this line. Remainder handled by giving the
    // spare paise to the first unit rather than rounding each — rounding each
    // loses or gains paise against the booking total, and an invoice that does
    // not reconcile is refused by `issue_rental_invoice` rather than printed.
    const n = unitIds.length
    const split = (total: number, i: number) =>
      Math.floor(total / n) + (i < total % n ? 1 : 0)

    unitIds.forEach((unitId, i) => {
      rows.push({
        booking_id: booking.id,
        item_id: line.itemId,
        unit_id: unitId,
        starts_on: line.startsOn,
        ends_on: line.endsOn,
        // The held window includes the cleaning buffer. Written here rather
        // than defaulted so the range and the dates can never disagree.
        period: `[${line.startsOn},${addDays(line.endsOn, item.buffer_days + 1)})`,
        daily_rate: line.dailyRate,
        days,
        rent_amount: split(pricedLine?.rentAmount ?? 0, i),
        deposit: line.deposit,
        // Frozen per line, so an invoice issued later cannot restate the rate
        // this rental was actually taxed at — migration 100.
        sac_code: pricedLine?.sacCode ?? item.sac_code,
        gst_rate: line.gstRate,
        discount_amount: split(pricedLine?.couponShare ?? 0, i),
        taxable_value: split(pricedLine?.taxableValue ?? 0, i),
        tax_amount: split(pricedLine?.taxAmount ?? 0, i),
      })
    })
  }

  const { error: resErr } = await supabase.from('rental_reservations').insert(rows)
  if (resErr) {
    // Leaving a booking behind with no gear on it would be a row that looks
    // like a rental and holds nothing. Cascade removes any lines that landed.
    await supabase.from('rental_bookings').delete().eq('id', booking.id)
    const raced = resErr.code === '23P01' || /rental_no_double_booking/.test(resErr.message)
    return {
      ok: false,
      ...(raced ? { code: 'unavailable' as const } : {}),
      error: raced
        ? 'Somebody just booked the last one for those dates. Pick different dates.'
        : 'Could not hold that gear. Try again.',
    }
  }

  await supabase.from('rental_events').insert({
    booking_id: booking.id,
    kind: 'created',
    amount: price.totalAmount,
    note: `${rows.length} unit(s), ${parsed.data.fulfilment}`,
  })

  // Coupon usage, recorded after the booking exists so a failed booking cannot
  // burn a single-use code. `increment_coupon_usage` is the same RPC the sale
  // path uses, so a code capped at 100 is capped across both.
  if (coupon && coupon.ok && price.couponDiscount > 0) {
    await supabase.from('coupon_usages').insert({
      coupon_id: coupon.id,
      user_id: input.userId ?? null,
      order_id: null,
      rental_booking_id: booking.id,
      discount_amount: price.couponDiscount,
    })
    await supabase.rpc('increment_coupon_usage', { coupon_id: coupon.id })
    await supabase.from('rental_events').insert({
      booking_id: booking.id,
      kind: 'coupon_applied',
      amount: price.couponDiscount,
      note: coupon.code,
    })
  }

  // The confirmation both storefronts have always promised.
  //
  // NEVER blocking. The booking is already written and the gear is already
  // held; if the mail provider is unconfigured or down, the customer still has
  // a booking and the confirmation screen still shows the number. Letting a
  // failed email throw here would roll a successful booking into an error
  // message — the worst possible trade for a message we can resend.
  try {
    await sendRentalConfirmationEmail({
      email: parsed.data.email,
      bookingNumber: booking.booking_number as string,
      fulfilment: parsed.data.fulfilment,
      lines: price.lines.map((l) => ({
        name: l.name, startsOn: priced.lines.find((p) => p.itemId === l.itemId)?.startsOn ?? '',
        endsOn: priced.lines.find((p) => p.itemId === l.itemId)?.endsOn ?? '',
        days: l.days, quantity: l.quantity,
      })),
      rentAmount: price.rentAmount,
      deliveryAmount: price.deliveryAmount,
      taxAmount: price.taxAmount,
      totalAmount: price.totalAmount,
      depositAmount: price.depositAmount,
    })
  } catch (e) {
    console.error('[rentals] confirmation email failed for', booking.booking_number, e)
  }

  revalidatePath('/admin/rentals')
  return { ok: true, bookingId: booking.id, bookingNumber: booking.booking_number as string }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Customer reads ──────────────────────────────────────────────────────────

/**
 * The signed-in customer's own bookings.
 *
 * SECURITY. This took a `userId` from its caller and looked it up with the
 * SERVICE-ROLE client, which bypasses RLS — and this file is `'use server'`, so
 * every export here is a callable endpoint. Anyone who could reach it could ask
 * for any customer's bookings by id and receive their email, phone, snapshotted
 * delivery address, dates and amounts. The parameter WAS the vulnerability.
 *
 * The identity now comes from the session and nothing else. There is no
 * argument to tamper with, which is the only version of this that is safe by
 * construction rather than by everyone remembering to check.
 */
export async function getMyRentalBookings() {
  const user = await getUser()
  if (!user) return []

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*, item:rental_items(name,slug,images))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as (RentalBooking & { reservations: RentalReservation[] })[]
}

// ── Admin: the catalogue ────────────────────────────────────────────────────

/**
 * A customer calling off their own booking.
 *
 * `cancelRentalBooking` is admin-only and always was, which meant the only way
 * to cancel was to telephone the shop — for gear that has not left the building
 * and money that has not changed hands. That is not a policy, it is a missing
 * screen.
 *
 * Two rules, both enforced here rather than trusted to the caller:
 *   • It must be YOUR booking. Ownership comes from the session; the booking id
 *     alone proves nothing.
 *   • Only while it is still `reserved`. Once the gear is handed over the
 *     deposit is held and a return, not a cancellation, is what happens next —
 *     and a cancelled row would free dates for a tent somebody is holding.
 */
export async function cancelMyRentalBooking(bookingId: string) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: 'Sign in to manage your bookings.' }

  const supabase = createAdminSupabaseClient()
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking || booking.user_id !== user.id) {
    // Same answer either way: an attacker must not learn that a booking exists.
    return { ok: false as const, error: 'That booking could not be found.' }
  }
  if (booking.status !== 'reserved') {
    return {
      ok: false as const,
      error:
        booking.status === 'cancelled'
          ? 'That booking is already cancelled.'
          : 'This one is already under way — call the shop and we will sort it out.',
    }
  }

  // Claim the booking BEFORE freeing the dates — the other order leaves a live
  // booking whose units are already back on the shelf if the claim fails.
  const { data: claimed, error } = await supabase
    .from('rental_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('status', 'reserved')
    .select('id')
  if (error) return { ok: false as const, error: 'That did not go through. Try again.' }
  if (!claimed?.length) {
    return { ok: false as const, error: 'That booking changed a moment ago. Reload the page.' }
  }

  // Cancelling the reservations is what frees the dates: the exclusion
  // constraint ignores cancelled rows, so the units are bookable again at once.
  await supabase.from('rental_reservations').update({ status: 'cancelled' }).eq('booking_id', bookingId)

  await supabase.from('rental_events').insert({
    booking_id: bookingId, kind: 'cancelled', note: 'Cancelled by the customer',
  })

  // AND THE MONEY GOES BACK.
  //
  // This used to end here: two status flips, one event, and a toast reading
  // "cancelled — the dates are free again". A posted rental is paid before it
  // ships and stays `reserved` until handover, so the self-cancel window was
  // exactly the paid window — the rent was not refunded, the deposit was not
  // released, `payment_status` stayed 'paid', and no email was sent. The schema
  // has had a 'refunded' payment status and a 'refunded' event kind since
  // migration 100 and nothing in the codebase could reach either.
  await refundCancelledBooking(bookingId, 'the customer cancelled')
  revalidatePath('/account/rentals')
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

/**
 * Finding a booking you made without an account.
 *
 * THE HOLE THIS FILLS. Both storefronts let somebody book with just an email.
 * Both "your rentals" screens require a session and filter on `user_id`, which
 * is NULL for a guest. There was no lookup anywhere — so a guest booking sat in
 * the database holding a unit off the shelf, and the person who made it could
 * never see it again. With the mailer unconfigured they did not even get the
 * confirmation.
 *
 * BOTH FACTORS ARE REQUIRED. The number alone is not a credential: it is
 * printed on a screen, read out at a counter and sent by email. Pairing it with
 * the address the booking was made under means holding one without the other
 * gets you nothing, and the rate limit stops anybody grinding through the pair.
 *
 * The answer is identical whether the number is wrong, the email is wrong, or
 * the booking does not exist — otherwise this becomes an oracle for which
 * booking numbers are real.
 */
export async function findRentalBooking(bookingNumber: string, email: string) {
  const limited = await rateLimit('rental-lookup', { limit: 8, windowSeconds: 600 })
  if (!limited.ok) return { ok: false as const, error: limited.error }

  const number = bookingNumber.trim().toUpperCase()
  const address = email.trim().toLowerCase()
  if (!number || !address) {
    return { ok: false as const, error: 'Enter the booking number and the email you used.' }
  }

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*, item:rental_items(name,slug,images))')
    .eq('booking_number', number)
    .maybeSingle()

  // One answer for every kind of miss — see the note above.
  if (!data || String(data.email).trim().toLowerCase() !== address) {
    return {
      ok: false as const,
      error: 'No booking matches that number and email. Check both, or call the shop.',
    }
  }

  return { ok: true as const, booking: data as RentalBooking & { reservations: RentalReservation[] } }
}

/**
 * Guest bookings, claimed by the account that owns the email.
 *
 * Somebody books as a guest, then signs in or signs up with the same address.
 * Without this their booking stays orphaned forever — visible only through the
 * lookup, and never on "your rentals". Matching on the email the booking was
 * made under is the same evidence the lookup asks for, and the account has
 * already proved control of that address by signing in to it.
 *
 * Called on sign-in beside the cart adoption, and safe to run every time: it
 * only ever touches rows that have no owner yet.
 */
export async function claimGuestRentalBookings() {
  // No parameters, deliberately. This function used to take `(userId, email)`
  // and check neither — see the long note in lib/rentalClaim.ts. Every export of
  // a 'use server' module is a public endpoint, so a parameter IS the attack
  // surface. The identity comes from the session and nowhere else.
  //
  // Same lesson getMyRentalBookings above already records for itself: "The
  // parameter WAS the vulnerability."
  const user = await getUser()
  if (!user?.email) return { claimed: 0 }

  const result = await claimGuestRentalBookingsFor(user.id, user.email)
  if (result.claimed > 0) revalidatePath('/account/rentals')
  return result
}

export async function getRentalItemsAdmin() {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_items')
    .select('*, units:rental_units(*)')
    .order('sort')
  return (data ?? []) as (RentalItem & { units: RentalUnit[] })[]
}

export async function upsertRentalItem(input: Partial<RentalItem> & { name: string; slug: string }) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  // Conflict on whichever key the caller actually has.
  //
  // This was fixed to 'slug', which is right for a new item but wrong the
  // moment somebody EDITS one and changes its slug: the row carries an id that
  // already exists, the new slug matches nothing, and the upsert falls through
  // to an insert that dies on the primary key. Editing by id is the identity
  // the admin form is actually working with.
  const { data, error } = await supabase
    .from('rental_items')
    .upsert(input as never, { onConflict: input.id ? 'id' : 'slug' })
    .select()
    .single()
  if (error) return { ok: false as const, error: mapRentalError(error.message) }
  revalidatePath('/admin/rentals')
  revalidatePath('/rent')
  return { ok: true as const, item: data as RentalItem }
}

export async function addRentalUnit(itemId: string, code: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('rental_units').insert({ item_id: itemId, code: code.trim() })
  if (error) {
    return {
      ok: false as const,
      error: /unique/i.test(error.message)
        ? `Unit ${code} already exists for this item.`
        : error.message,
    }
  }
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

export async function setUnitCondition(
  unitId: string,
  condition: 'good' | 'fair' | 'repair' | 'retired',
  notes?: string,
) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  const patch: Record<string, unknown> = { condition, notes: notes ?? null }
  // Retiring stamps the date so the unit stops being offered without losing
  // its history — the row is why we know what happened to it.
  // The shop's day — this is a DATE and it feeds the utilisation denominator.
  if (condition === 'retired') patch.retired_at = shopToday()
  else patch.retired_at = null
  const { error } = await supabase.from('rental_units').update(patch).eq('id', unitId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

// ── Admin: the lifecycle ────────────────────────────────────────────────────

export async function getRentalBookings(status?: string) {
  await requireAdmin()
  const supabase = createAdminSupabaseClient()
  let q = supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*, item:rental_items(name,slug), unit:rental_units(code))')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status && status !== 'all') q = q.eq('status', status)
  const { data } = await q
  return (data ?? []) as (RentalBooking & { reservations: RentalReservation[] })[]
}

/** Gear leaves the shop. The deposit is recorded here because it is taken here. */
export async function handOverBooking(bookingId: string, depositTaken: number) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  // What the booking looks like before we touch it. `deposit_method` decides
  // what a handover is allowed to say about the deposit: migration 100 adds
  // CHECK (deposit_method <> 'gateway' OR deposit_state IN ('pending','waived')
  // OR deposit_payment_id IS NOT NULL), and createRentalBooking stamps
  // 'gateway' on every posted booking. Writing 'held' with no payment id
  // therefore violated that CHECK and showed the operator raw Postgres.
  const { data: before } = await supabase
    .from('rental_bookings')
    .select('deposit_method, deposit_payment_id, payment_status, total_amount')
    .eq('id', bookingId)
    .maybeSingle()

  const depositIsGateway = before?.deposit_method === 'gateway'
  const gatewayDepositLodged = Boolean(before?.deposit_payment_id)

  if (depositIsGateway && !gatewayDepositLodged && depositTaken > 0) {
    return {
      ok: false as const,
      error:
        'This booking’s deposit is set to be paid online and has not been. Take it at the counter (switch the booking to a cash deposit) or send the customer the payment link first.',
    }
  }

  // THE GUARD THAT NEVER FIRED.
  //
  // This filtered on `.eq('status','reserved')` and then tested `error` — but a
  // PostgREST UPDATE that matches ZERO rows is a successful statement, so
  // supabase-js returns { data: null, error: null } and execution fell straight
  // through. A second click, or a click on a cancelled booking, reported
  // "Handed over" and then ran everything below unconditionally: reservations
  // forced to 'out' (resurrecting cancelled holds), and two duplicate events.
  //
  // `.select('id')` and a row-count test is the idiom this repo already uses in
  // `actions/rentalOps.ts` for exactly this reason.
  const { data: claimed, error } = await supabase
    .from('rental_bookings')
    .update({
      status: 'out',
      // Only claim a hold we can actually prove. A gateway deposit that IS
      // lodged is already 'held' from verifyDepositPayment.
      ...(depositIsGateway
        ? {}
        : { deposit_state: depositTaken > 0 ? 'held' : 'waived' }),
    })
    .eq('id', bookingId)
    .eq('status', 'reserved')
    .select('id')
  if (error) return { ok: false as const, error: error.message }
  if (!claimed?.length) {
    return {
      ok: false as const,
      error: 'That booking is no longer awaiting handover — reload the page and check its status.',
    }
  }

  await supabase.from('rental_reservations').update({ status: 'out' }).eq('booking_id', bookingId)
  await supabase.from('rental_events').insert([
    { booking_id: bookingId, kind: 'handed_over', actor_id: actor.id },
    {
      booking_id: bookingId,
      kind: depositTaken > 0 ? 'deposit_held' : 'note',
      amount: depositTaken || null,
      note: depositTaken > 0 ? 'Security deposit taken at handover' : 'Deposit waived',
      actor_id: actor.id,
    },
  ])
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

/**
 * Gear comes back, and the money is settled in one place.
 *
 * Late fees are computed from the dates rather than typed in, so two people
 * inspecting the same return reach the same figure. Damage is a judgement and
 * is therefore an input — but it is recorded as its own event with a note, so
 * a charge can always be explained.
 */
export async function returnBooking(input: {
  bookingId: string
  damageFee?: number
  damageNote?: string
  refundDeposit?: boolean
  /** The date the gear actually came back, `YYYY-MM-DD`. Defaults to the shop's
   *  today. It is an INPUT because returns pile up: gear handed over the counter
   *  on Saturday and checked in on Monday used to be billed two extra days at
   *  the full daily rate, and the same wrong date shrank the reservation, so the
   *  shelf lost two days it should have had back. The error ran both ways. */
  returnedOn?: string
}) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('*, reservations:rental_reservations(*)')
    .eq('id', input.bookingId)
    .single()
  if (!booking) return { ok: false as const, error: 'That booking no longer exists.' }

  const b = booking as RentalBooking & { reservations: RentalReservation[] }

  if (b.status !== 'out') {
    return {
      ok: false as const,
      error:
        b.status === 'closed'
          ? 'That booking is already closed. Reload the page — settling it twice recomputes the late fee against today and re-runs the deposit.'
          : 'That gear has not been handed over yet, so there is nothing to take back.',
    }
  }

  // The shop's day, and the shop's day is the default — not UTC, which between
  // midnight and 05:30 IST is yesterday.
  const returnedOn = input.returnedOn ?? shopToday()

  // Only lines that are actually out. A cancelled reservation used to
  // contribute a late fee for gear that was never hired, and then get flipped
  // from 'cancelled' to 'returned' — reinstating a hold that had been released.
  // Every other reader in this system filters cancelled rows; this one did not.
  const live = b.reservations.filter((r) => r.status !== 'cancelled')

  // Late by the latest end date on the booking, at that line's own daily rate.
  // `daysLate` turns an inclusive span into an overrun, which was previously
  // done inline at two call sites and had to be right in both.
  let late = 0
  for (const r of live) {
    late += lateFee(r.daily_rate, daysLate(r.ends_on, returnedOn), b.deposit_amount)
  }
  late = Math.min(late, b.deposit_amount || late)

  const damage = Math.max(0, Math.round(input.damageFee ?? 0))
  const refunding = input.refundDeposit !== false

  // One function decides what happens to the deposit, and it guarantees the
  // one thing a customer will check: applied + refund is exactly what they
  // lodged. `unrecovered` is what is owed BEYOND the deposit — reported so the
  // shop can have an informed conversation, never charged automatically.
  const settlement = settleDeposit({ deposit: b.deposit_amount, lateFee: late, damageFee: damage })

  // NOTE what is NOT written here: `deposit_state`.
  //
  // This used to write `deposit_state: 'refunded'` and only afterwards attempt
  // the gateway refund. When the gateway refused, the row said refunded,
  // `deposit_refunded` stayed 0, and `RentalBookingOps` — which gates its
  // recovery button on `deposit_state === 'held'` — could no longer render it.
  // The comment promising "it can be run again from the admin screen" described
  // a button that could not appear.
  //
  // `refundRentalDeposit` moves the money first and then writes the state, so
  // it is the only thing that should own that column. A failure now leaves the
  // row saying 'held', which is TRUE, and the recovery button renders.
  const { data: closed, error } = await supabase
    .from('rental_bookings')
    .update({
      status: 'closed',
      returned_at: new Date().toISOString(),
      late_fee: late,
      damage_fee: damage,
      ...(refunding ? {} : { deposit_state: 'forfeited' as const }),
    })
    .eq('id', input.bookingId)
    .eq('status', 'out')
    .select('id')
  if (error) return { ok: false as const, error: error.message }
  if (!closed?.length) {
    return { ok: false as const, error: 'Somebody else closed that booking a moment ago. Reload the page.' }
  }

  // Returning EARLY has to free the days that were not used.
  //
  // The held `period` — not the status — is what availability and the exclusion
  // constraint read, so a returned reservation whose period still runs to the
  // original end date keeps a unit off the shelf it is physically back on. Bring
  // a tent back on the 13th of a rental booked to the 16th and, without this, it
  // stays unbookable for three days it is sitting in the shop.
  //
  // So the period is shrunk to the ACTUAL return date plus that item's cleaning
  // buffer. The end date the customer agreed to is left untouched on
  // `ends_on` — that is what they were charged against, and rewriting it would
  // quietly change the terms of a rental after the fact.
  // One read for every item on the booking, not one per reservation inside the
  // loop. A three-tent booking used to make three identical round trips.
  const itemIds = [...new Set(live.map((r) => r.item_id))]
  const { data: items } = await supabase
    .from('rental_items').select('id, buffer_days').in('id', itemIds)
  const bufferOf = new Map((items ?? []).map((i) => [i.id as string, (i.buffer_days as number) ?? 0]))

  // A reservation whose period is not shrunk keeps a unit off a shelf it is
  // physically back on, and this used to discard the error entirely — so a
  // refused update (a lock timeout, a 23P01) left the booking 'closed' with its
  // gear still held, and nothing anywhere said so. Nobody finds that until
  // somebody rings up asking why a tent they can see is unbookable.
  const stuck: string[] = []
  for (const r of live) {
    const buffer = bufferOf.get(r.item_id) ?? 0
    const freeFrom = addDays(returnedOn, buffer + 1)
    // Never extend a period — an unusually late return keeps whatever the
    // original hold was, so this can only ever give days back.
    const end = freeFrom < addDays(r.ends_on, buffer + 1) ? freeFrom : addDays(r.ends_on, buffer + 1)
    const { error: resErr } = await supabase
      .from('rental_reservations')
      .update({
        status: 'returned',
        returned_at: new Date().toISOString(),
        period: `[${r.starts_on},${end})`,
      })
      .eq('id', r.id)
    if (resErr) stuck.push(r.id)
  }

  if (stuck.length) {
    // Loud, and recorded against the booking, because the alternative is a unit
    // that is quietly unbookable for the rest of the season.
    await supabase.from('rental_events').insert({
      booking_id: input.bookingId,
      kind: 'note',
      note: `Return recorded, but ${stuck.length} reservation(s) could not be released — those units are still held. Reservation ids: ${stuck.join(', ')}`,
      actor_id: actor.id,
    })
  }

  const events: Record<string, unknown>[] = [
    { booking_id: input.bookingId, kind: 'returned', actor_id: actor.id },
    { booking_id: input.bookingId, kind: 'inspected', actor_id: actor.id, note: input.damageNote ?? null },
  ]
  if (late > 0) events.push({ booking_id: input.bookingId, kind: 'late_fee', amount: late, actor_id: actor.id })
  if (damage > 0)
    events.push({ booking_id: input.bookingId, kind: 'damage_fee', amount: damage, note: input.damageNote ?? null, actor_id: actor.id })
  // The deposit's own event is written by `refundRentalDeposit` below, so it
  // carries the gateway refund id rather than being claimed here before the
  // money has actually moved.
  await supabase.from('rental_events').insert(events)

  // Now move the money. A gateway deposit is refunded for real; a cash one is
  // handed back at the counter and the call just records it. Deliberately after
  // the return has been written: a gateway outage must not stop gear being
  // marked back on the shelf, and `refundRentalDeposit` can be run again from
  // the admin screen for exactly that case.
  if (refunding && b.deposit_amount > 0) {
    const { refundRentalDeposit } = await import('./rentalPayments')
    const settled = await refundRentalDeposit({
      bookingId: input.bookingId,
      lateFee: late,
      damageFee: damage,
    })
    if (!settled.ok) {
      // Reported, not thrown. The return is real and already recorded; what
      // failed is a payment instruction, and the operator needs to know which.
      await supabase.from('rental_events').insert({
        booking_id: input.bookingId,
        kind: 'note',
        note: `Deposit not returned automatically: ${settled.error}`,
        actor_id: actor.id,
      })
    }
  }

  revalidatePath('/admin/rentals')
  revalidatePath('/account/rentals')
  return {
    ok: true as const,
    lateFee: late,
    damageFee: damage,
    depositReturned: settlement.refund,
    unrecovered: settlement.unrecovered,
  }
}

export async function cancelRentalBooking(bookingId: string, reason?: string) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  // THE GUARD THIS HAD NONE OF.
  //
  // Cancelled reservations are excluded from `rental_no_double_booking` and
  // from `rental_available_units`, so cancelling an `out` booking advertised a
  // tent as free for dates it was in somebody's rucksack — and the next
  // customer could book the same physical unit, which Postgres cannot refuse
  // because one of the two rows is cancelled.
  //
  // The admin UI hides this button once a booking is `out`, which is exactly
  // the shape of bug that only fires in production: a stale tab, a colleague
  // handing the gear over at the counter, and a click on a render from ten
  // minutes ago. A server action does not re-validate what a screen assumed.
  const { data: current } = await supabase
    .from('rental_bookings').select('status').eq('id', bookingId).maybeSingle()
  if (!current) return { ok: false as const, error: 'That booking no longer exists.' }
  if (current.status === 'cancelled') return { ok: true as const }
  if (current.status !== 'reserved') {
    return {
      ok: false as const,
      error:
        current.status === 'out'
          ? 'That gear is with a customer — mark it returned instead. Cancelling would put the unit back on the shelf while it is still out.'
          : 'That booking is already closed.',
    }
  }
  // Claim the booking FIRST, then free the dates. The other order means a
  // failed claim leaves a live booking whose units are already back on the
  // shelf — cancelling the reservations is precisely what frees them, because
  // the exclusion constraint ignores cancelled rows.
  const { data: claimed, error } = await supabase
    .from('rental_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('status', 'reserved')
    .select('id')
  if (error) return { ok: false as const, error: error.message }
  if (!claimed?.length) {
    return { ok: false as const, error: 'That booking changed while you were looking at it. Reload the page.' }
  }
  await supabase.from('rental_reservations').update({ status: 'cancelled' }).eq('booking_id', bookingId)
  await supabase.from('rental_events').insert({
    booking_id: bookingId, kind: 'cancelled', note: reason ?? null, actor_id: actor.id,
  })
  await refundCancelledBooking(bookingId, reason ?? 'cancelled by the shop', actor.id)
  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

/**
 * Give back what the policy says, and record it.
 *
 * Money first, then the row — the discipline `refundRentalDeposit` already
 * follows and states: "a row saying 'refunded' with no gateway refund behind it
 * is worse than no row at all — it is the state where everybody believes the
 * customer has been paid and nobody has."
 *
 * Never throws. A cancellation that half-succeeds must still leave the dates
 * free; a refund that fails leaves a loud event and a Slack alert for a human,
 * not an exception that rolls the cancellation back.
 */
async function refundCancelledBooking(bookingId: string, why: string, actorId?: string) {
  const supabase = createAdminSupabaseClient()
  const { data: b } = await supabase
    .from('rental_bookings')
    .select('id, amount_paid, payment_status, gateway_payment_id, deposit_state, deposit_taken, deposit_amount, deposit_payment_id, deposit_refunded')
    .eq('id', bookingId)
    .maybeSingle()
  if (!b) return

  const rentPaid = (b.amount_paid as number) ?? 0
  const depositHeld =
    b.deposit_state === 'held' ? ((b.deposit_taken as number | null) ?? (b.deposit_amount as number) ?? 0) : 0
  if (rentPaid <= 0 && depositHeld <= 0) return

  const firstDay = await firstDayOf(bookingId)
  const plan = cancellationRefund({
    rentPaid,
    depositHeld,
    startsOn: firstDay ?? shopToday(),
    today: shopToday(),
  })

  const { refundGatewayPayment } = await import('@/lib/razorpay')
  const notes: string[] = [plan.band.label]

  // The rent, per the published bands.
  if (plan.rentRefund > 0 && b.gateway_payment_id) {
    const res = await refundGatewayPayment(b.gateway_payment_id as string, plan.rentRefund)
    if ('error' in res) {
      await supabase.from('rental_events').insert({
        booking_id: bookingId, kind: 'note', actor_id: actorId ?? null,
        note: `REFUND FAILED — ₹${Math.round(plan.rentRefund / 100)} of rent is still owed to the customer (${res.error}).`,
      })
      await sendSlackAlert(`Rental refund failed for ${bookingId}: ${res.error}`)
    } else {
      await supabase.from('rental_bookings')
        .update({ payment_status: 'refunded', amount_paid: Math.max(0, rentPaid - plan.rentRefund) })
        .eq('id', bookingId)
      await supabase.from('rental_events').insert({
        booking_id: bookingId, kind: 'refunded', amount: plan.rentRefund, actor_id: actorId ?? null,
        note: `Rent refunded because ${why}. ${plan.band.label}`,
      })
    }
  } else if (rentPaid > 0 && plan.rentRefund === 0) {
    // Nothing comes back, and that is a decision the customer is entitled to
    // see written down rather than infer from their bank statement.
    await supabase.from('rental_events').insert({
      booking_id: bookingId, kind: 'note', actor_id: actorId ?? null,
      note: `No rent refunded — ${plan.band.label}`,
    })
  }

  // The deposit is the customer's money. It always comes back.
  if (depositHeld > 0) {
    if (b.deposit_payment_id) {
      const { refundRentalDeposit } = await import('./rentalPayments')
      await refundRentalDeposit({ bookingId, lateFee: 0, damageFee: 0 })
    } else {
      // Taken in cash: there is nothing to reverse at a gateway, so record that
      // the counter owes it back rather than pretending it moved.
      await supabase.from('rental_bookings').update({ deposit_state: 'refunded' }).eq('id', bookingId)
      await supabase.from('rental_events').insert({
        booking_id: bookingId, kind: 'deposit_refunded', amount: depositHeld, actor_id: actorId ?? null,
        note: 'Cash deposit — hand it back at the counter.',
      })
    }
    notes.push('deposit returned in full')
  }
}

/** The first day of a booking, for the cancellation bands. */
async function firstDayOf(bookingId: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_reservations')
    .select('starts_on')
    .eq('booking_id', bookingId)
    .order('starts_on', { ascending: true })
    .limit(1)
  return (data?.[0]?.starts_on as string | undefined) ?? null
}

function mapRentalError(message: string): string {
  if (/rental_items_slug_shape/.test(message)) return 'The URL handle may only contain lowercase letters, numbers and hyphens.'
  if (/rental_items_day_range/.test(message)) return 'The maximum rental period must be at least the minimum.'
  if (/rental_items_some_fulfilment/.test(message)) return 'Allow collection, posting, or both — an item with neither can never be rented.'
  if (/daily_rate/.test(message)) return 'The daily rate must be more than zero.'
  // The one an admin will actually hit: two pieces of gear given the same
  // handle. Postgres says "duplicate key value violates unique constraint",
  // which tells a shopkeeper nothing.
  if (/rental_items_slug_key|duplicate key/.test(message)) return 'Another item already uses that URL handle. Pick a different one.'
  return message
}
