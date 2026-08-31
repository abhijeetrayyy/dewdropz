'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getUser, requireAdmin } from './auth'
import { rateLimit } from '@/lib/rateLimit'
import { priceRentalExtension, type ExtensionQuote } from '@/lib/rentalPricing'
import { createGatewayOrder, razorpaySignatureValid } from '@/lib/razorpay'
import { enqueue } from '@/lib/jobs'
import type { RentalExtension } from '@/types/database'

/**
 * Keeping the gear a bit longer.
 *
 * WHAT HAPPENED BEFORE THIS EXISTED. Nothing. There was no extension anywhere
 * in the system, so a customer who wanted three more days had two options: ring
 * the shop, or just keep it. Keeping it was indistinguishable from returning it
 * late — financially close to right, since the late fee is the daily rate, and
 * operationally wrong, because the unit still showed as due back on the original
 * date and the shelf would happily promise it to somebody else.
 *
 * THE THREE THINGS THAT MAKE THIS HARDER THAN IT LOOKS
 *
 * 1. THE UNIT MAY ALREADY BE PROMISED. An extension is a request, not a right.
 *    It has to be checked against the calendar with the requester's OWN
 *    reservation excluded — otherwise the hold being widened is read as a
 *    conflict with itself and no rental could ever be extended.
 *
 * 2. THE PRICE IS A DELTA. Re-quoting the whole rental over the new range
 *    re-applies the long-rental discount to days already paid for and can make
 *    a longer rental cost LESS than what has already been charged. So only the
 *    added days are priced, at the rate frozen on the reservation. See
 *    `extensionCharge` and the test that pins it.
 *
 * 3. THE PERIOD AND THE DATE ARE TWO DIFFERENT FACTS. `ends_on` is what the
 *    customer agreed to; `period` is what the shelf loses, and it includes the
 *    cleaning buffer. Both move, and they move by the same amount, and the
 *    exclusion constraint is what catches it if they do not.
 */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')

type Fail = { ok: false; error: string }

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type Reservation = {
  id: string
  unit_id: string
  item_id: string
  ends_on: string
  daily_rate: number
  gst_rate: number
  status: string
  item: { name: string; buffer_days: number; weekly_discount_pct: number } | null
}

type OwnedBooking = {
  id: string; user_id: string | null; email: string; booking_number: string; status: string
  rent_amount: number; tax_amount: number; total_amount: number
  reservations: Reservation[]
}

// Explicit return type, so `'error' in loaded` actually discriminates. Left to
// inference it widens to a single optional-property object and every read of
// `loaded.error` becomes `string | undefined`.
async function loadOwnedBooking(
  bookingId: string,
  opts: { adminOverride?: boolean } = {},
): Promise<{ ok: false; error: string } | { ok: true; booking: OwnedBooking }> {
  const supabase = createAdminSupabaseClient()

  const { data } = await supabase
    .from('rental_bookings')
    .select(
      'id, user_id, email, booking_number, status, rent_amount, tax_amount, total_amount, ' +
        'reservations:rental_reservations(id, unit_id, item_id, ends_on, daily_rate, gst_rate, status, ' +
        'item:rental_items(name, buffer_days, weekly_discount_pct))',
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'That booking could not be found.' }

  // The join makes the row's inferred type unusable, so it is asserted once,
  // here, rather than at every read below.
  const booking = data as unknown as OwnedBooking

  if (!opts.adminOverride) {
    const user = await getUser()
    // Same answer either way, so this cannot be used to discover which booking
    // ids are real.
    if (!user || booking.user_id !== user.id) {
      return { ok: false, error: 'That booking could not be found.' }
    }
  }

  return { ok: true, booking }
}

/**
 * What extending to a date would cost, and whether it is even possible.
 *
 * Answers both in one call on purpose. A price with no availability answer
 * invites somebody to pay for days they cannot have, and an availability answer
 * with no price makes them ask twice.
 */
export async function quoteRentalExtension(input: {
  bookingId: string
  newEnd: string
}): Promise<
  | { ok: true; quote: ExtensionQuote; blockedBy: string[] }
  | Fail
> {
  const parsed = z.object({ bookingId: z.string().uuid(), newEnd: DATE }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Pick a valid date.' }

  const loaded = await loadOwnedBooking(input.bookingId)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  const { booking } = loaded

  if (!['reserved', 'out'].includes(booking.status)) {
    return {
      ok: false,
      error:
        booking.status === 'cancelled'
          ? 'That booking was cancelled.'
          : 'This rental has already come back — start a new booking instead.',
    }
  }

  const live = booking.reservations.filter((r) => r.status !== 'cancelled')
  if (!live.length) return { ok: false, error: 'There is nothing on this rental to extend.' }

  const quote = priceRentalExtension({
    newEnd: input.newEnd,
    reservations: live.map((r) => ({
      id: r.id,
      unitId: r.unit_id,
      itemName: r.item?.name ?? 'Gear',
      endsOn: r.ends_on,
      dailyRate: r.daily_rate,
      gstRate: r.gst_rate,
      // The long-rental discount is NOT applied to extension days. That is a
      // commercial decision and the shop has not made it — see the companion
      // scope document, question D3. Passing nothing means the added days are
      // charged at the plain daily rate, which is the answer nobody can call
      // unfair in either direction.
    })),
  })

  if (!quote.ok) return { ok: false, error: quote.error }

  // Availability, per unit, with each reservation excluding itself.
  const supabase = createAdminSupabaseClient()
  const blockedBy: string[] = []

  for (const r of live) {
    const { data: free, error } = await supabase.rpc('rental_unit_free_excluding', {
      p_unit_id: r.unit_id,
      p_start: r.ends_on,
      p_end: input.newEnd,
      p_except_res_id: r.id,
    })
    if (error) return { ok: false, error: 'Could not check the calendar. Try again.' }
    if (free === false) blockedBy.push(r.item?.name ?? 'Gear')
  }

  return { ok: true, quote, blockedBy }
}

/**
 * Ask for the extension.
 *
 * Writes a `pending` row and, when the rental is already paid for online,
 * a gateway order to pay the delta. It does NOT move the dates — that happens
 * on confirmation, because the dates must not move until the money has, or a
 * customer could hold a unit for three extra days by abandoning a payment.
 */
export async function requestRentalExtension(input: {
  bookingId: string
  newEnd: string
}): Promise<
  | { ok: true; extensionId: string; amount: number; gatewayOrderId: string | null; keyId: string | null }
  | Fail
> {
  const limited = await rateLimit('rental-extend', { limit: 10, windowSeconds: 600 })
  if (!limited.ok) return { ok: false, error: limited.error }

  const quoted = await quoteRentalExtension(input)
  if (!quoted.ok) return { ok: false, error: quoted.error }

  if (quoted.blockedBy.length) {
    // The refusal names what is in the way, because "no" with no reason is what
    // makes somebody ring the shop — which is the thing this screen exists to
    // stop them having to do.
    const names = [...new Set(quoted.blockedBy)].join(', ')
    return {
      ok: false,
      error: `We can't extend — ${names} is booked by somebody else from just after your current end date. Bring it back on time and we'll sort the next one out.`,
    }
  }

  const loaded = await loadOwnedBooking(input.bookingId)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  const { booking } = loaded
  const user = await getUser()

  const supabase = createAdminSupabaseClient()
  const { data: ext, error } = await supabase
    .from('rental_extensions')
    .insert({
      booking_id: booking.id,
      previous_end: quoted.quote.previousEnd,
      new_end: quoted.quote.newEnd,
      days_added: quoted.quote.daysAdded,
      rent_amount: quoted.quote.rentAmount - quoted.quote.discountAmount,
      tax_amount: quoted.quote.taxAmount,
      total_amount: quoted.quote.totalAmount,
      requested_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error || !ext) return { ok: false, error: 'Could not start that extension. Try again.' }

  await supabase.from('rental_events').insert({
    booking_id: booking.id,
    kind: 'extension_requested',
    amount: quoted.quote.totalAmount,
    note: `${quoted.quote.daysAdded} more day(s), to ${quoted.quote.newEnd}`,
    actor_id: user?.id ?? null,
  })

  // Nothing to pay — a zero-value extension is possible if the shop has set a
  // rate of zero on an item — so confirm it immediately rather than parking it
  // behind a payment screen that would ask for ₹0.
  if (quoted.quote.totalAmount <= 0) {
    const done = await commitExtension(ext.id)
    if (!done.ok) return done
    return { ok: true, extensionId: ext.id, amount: 0, gatewayOrderId: null, keyId: null }
  }

  const keyId = process.env.RAZORPAY_KEY_ID ?? null
  if (!keyId) {
    // Cash-at-the-counter shops are a legitimate configuration. The extension
    // stays pending for an admin to confirm when the customer pays.
    return { ok: true, extensionId: ext.id, amount: quoted.quote.totalAmount, gatewayOrderId: null, keyId: null }
  }

  const created = await createGatewayOrder({
    amount: quoted.quote.totalAmount,
    receipt: `${booking.booking_number}-X`,
    notes: { rental_booking_id: booking.id, rental_extension_id: ext.id, kind: 'extension' },
  })
  if ('error' in created) return { ok: false, error: created.error }

  await supabase
    .from('rental_extensions')
    .update({ payment_status: 'pending', gateway_order_id: created.id })
    .eq('id', ext.id)

  revalidatePath('/account/rentals')
  return {
    ok: true,
    extensionId: ext.id,
    amount: quoted.quote.totalAmount,
    gatewayOrderId: created.id,
    keyId,
  }
}

/** The customer paid for the extra days. */
export async function verifyExtensionPayment(input: {
  extensionId: string
  gatewayOrderId: string
  gatewayPaymentId: string
  signature: string
}): Promise<{ ok: true; newEnd: string } | Fail> {
  const supabase = createAdminSupabaseClient()
  const { data: ext } = await supabase
    .from('rental_extensions')
    .select('id, booking_id, gateway_order_id, payment_status, status, new_end, total_amount')
    .eq('id', input.extensionId)
    .maybeSingle()

  if (!ext) return { ok: false, error: 'That extension could not be found.' }
  if (ext.gateway_order_id !== input.gatewayOrderId) {
    return { ok: false, error: 'That payment does not belong to this extension.' }
  }
  if (
    !razorpaySignatureValid({
      gatewayOrderId: ext.gateway_order_id as string,
      gatewayPaymentId: input.gatewayPaymentId,
      signature: input.signature,
    })
  ) {
    await supabase.from('rental_extensions').update({ payment_status: 'failed' }).eq('id', ext.id)
    return { ok: false, error: 'That payment could not be verified.' }
  }

  await supabase
    .from('rental_extensions')
    .update({ payment_status: 'paid', gateway_payment_id: input.gatewayPaymentId })
    .eq('id', ext.id)

  return commitExtension(ext.id)
}

/**
 * Move the dates. The one function that actually changes the calendar.
 *
 * Called after payment, or by an admin confirming a cash extension. Everything
 * that can refuse has refused before this point — but availability is checked
 * ONE more time, because time has passed since the quote and somebody else may
 * have booked the days in between. If they have, the money is already taken and
 * the customer gets it back rather than the shop keeping it for days it cannot
 * supply.
 */
async function commitExtension(extensionId: string): Promise<{ ok: true; newEnd: string } | Fail> {
  const supabase = createAdminSupabaseClient()

  const { data: ext } = await supabase
    .from('rental_extensions')
    .select('id, booking_id, new_end, previous_end, days_added, rent_amount, tax_amount, total_amount, status')
    .eq('id', extensionId)
    .maybeSingle()

  if (!ext) return { ok: false, error: 'That extension could not be found.' }
  if (ext.status === 'confirmed') return { ok: true, newEnd: String(ext.new_end) }

  const { data: rows } = await supabase
    .from('rental_reservations')
    .select('id, unit_id, ends_on, starts_on, rent_amount, taxable_value, tax_amount, item:rental_items(buffer_days)')
    .eq('booking_id', ext.booking_id)
    .neq('status', 'cancelled')

  const reservations = (rows ?? []) as unknown as {
    id: string; unit_id: string; ends_on: string; starts_on: string
    rent_amount: number; taxable_value: number; tax_amount: number
    item: { buffer_days: number } | null
  }[]

  if (!reservations.length) return { ok: false, error: 'There is nothing on this rental to extend.' }

  // Last look at the calendar. Between the quote and here somebody else may
  // have taken the days.
  for (const r of reservations) {
    const { data: free } = await supabase.rpc('rental_unit_free_excluding', {
      p_unit_id: r.unit_id,
      p_start: r.ends_on,
      p_end: ext.new_end,
      p_except_res_id: r.id,
    })
    if (free === false) {
      await supabase
        .from('rental_extensions')
        .update({ status: 'declined', decline_reason: 'The dates were taken before the extension was confirmed' })
        .eq('id', ext.id)
      await supabase.from('rental_events').insert({
        booking_id: ext.booking_id,
        kind: 'extension_declined',
        note: 'Dates taken between quote and confirmation — refund the extension payment',
      })
      return {
        ok: false,
        error: 'Somebody booked those days while this was being paid for. Nothing has been extended and the payment will be returned.',
      }
    }
  }

  // Widen both the agreed date and the held period, by the same amount, in one
  // update per line. The exclusion constraint is the backstop: if these two ever
  // disagree with the calendar, the write fails rather than quietly
  // double-booking.
  const perLineRent = Math.round((ext.rent_amount as number) / reservations.length)
  const perLineTax = Math.round((ext.tax_amount as number) / reservations.length)

  for (const r of reservations) {
    const buffer = r.item?.buffer_days ?? 0
    // Recomputed from the dates rather than incremented, so a line that was
    // already wrong does not stay wrong by exactly the same amount.
    const days =
      Math.round(
        (Date.parse(`${ext.new_end}T00:00:00Z`) - Date.parse(`${r.starts_on}T00:00:00Z`)) / 86_400_000,
      ) + 1

    const { error } = await supabase
      .from('rental_reservations')
      .update({
        ends_on: ext.new_end,
        period: `[${r.starts_on},${addDays(ext.new_end as string, buffer + 1)})`,
        days,
        rent_amount: r.rent_amount + perLineRent,
        taxable_value: r.taxable_value + perLineRent,
        tax_amount: r.tax_amount + perLineTax,
      })
      .eq('id', r.id)

    if (error) {
      return {
        ok: false,
        error: 'Those days could not be held — somebody may have taken them. Nothing has changed.',
      }
    }
  }

  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('rent_amount, tax_amount, total_amount')
    .eq('id', ext.booking_id)
    .single()

  await supabase
    .from('rental_bookings')
    .update({
      rent_amount: (booking?.rent_amount ?? 0) + (ext.rent_amount as number),
      tax_amount: (booking?.tax_amount ?? 0) + (ext.tax_amount as number),
      total_amount: (booking?.total_amount ?? 0) + (ext.total_amount as number),
      // The reminder is cleared, because "due back tomorrow" was true about a
      // date that has just moved. Leaving it set would mean the customer is
      // never reminded about the new one.
      reminder_due_at: null,
      reminder_overdue_at: null,
    })
    .eq('id', ext.booking_id)

  await supabase.from('rental_extensions').update({ status: 'confirmed' }).eq('id', ext.id)

  await supabase.from('rental_events').insert({
    booking_id: ext.booking_id,
    kind: 'extension_confirmed',
    amount: ext.total_amount as number,
    note: `Now due back ${ext.new_end}`,
  })

  await enqueue('rental.extended', { bookingId: ext.booking_id, extensionId: ext.id })

  revalidatePath('/account/rentals')
  revalidatePath('/admin/rentals')
  return { ok: true, newEnd: String(ext.new_end) }
}

/** An admin confirming an extension paid for in cash, or waving one through. */
export async function confirmRentalExtension(extensionId: string) {
  await requireAdmin()
  return commitExtension(extensionId)
}

/** An admin refusing one. */
export async function declineRentalExtension(extensionId: string, reason: string) {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: ext } = await supabase
    .from('rental_extensions')
    .select('id, booking_id, status')
    .eq('id', extensionId)
    .maybeSingle()

  if (!ext) return { ok: false as const, error: 'That extension could not be found.' }
  if (ext.status === 'confirmed') {
    return { ok: false as const, error: 'That extension is already confirmed — the dates have moved.' }
  }

  await supabase
    .from('rental_extensions')
    .update({ status: 'declined', decline_reason: reason, approved_by: actor.id })
    .eq('id', extensionId)

  await supabase.from('rental_events').insert({
    booking_id: ext.booking_id, kind: 'extension_declined', note: reason, actor_id: actor.id,
  })

  revalidatePath('/admin/rentals')
  return { ok: true as const }
}

/** The customer's own extensions, for the account screen. */
export async function getMyRentalExtensions(bookingId: string): Promise<RentalExtension[]> {
  const loaded = await loadOwnedBooking(bookingId)
  if (!loaded.ok) return []

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_extensions')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  return (data ?? []) as RentalExtension[]
}
