'use server'

import { revalidatePath } from 'next/cache'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getUser, requireAdmin } from './auth'
import { rateLimit } from '@/lib/rateLimit'
import { createGatewayOrder, razorpaySignatureValid, refundGatewayPayment } from '@/lib/razorpay'
import { settleDeposit } from '@/lib/rentalMath'
import { enqueue } from '@/lib/jobs'
import { sendSlackAlert } from '@/lib/slack'
import type { RentalBooking } from '@/types/database'

/**
 * Paying for a rental, and holding a deposit that is actually held.
 *
 * WHAT THIS CHANGES. Until now a rental was an agreement with no money attached
 * to it: rent and deposit were both settled face to face at handover. That is a
 * coherent way to run a counter in Dehradun and a hard ceiling on everything
 * else, because posting gear to somebody you have never met, against nothing
 * but a promise, is not a business — it is a donation with paperwork.
 *
 * TWO PAYMENTS, NOT ONE, AND THEY ARE DELIBERATELY SEPARATE.
 *
 * The rent is consideration for a supply. It is taxed, it is revenue, it is
 * invoiced, and it is never given back except as a refund against a
 * cancellation.
 *
 * The deposit is refundable security. It is not taxed, it is not revenue, it
 * appears on no invoice, and the expected outcome is that all of it goes back.
 *
 * Charging them as one payment would make the second indistinguishable from the
 * first the moment it hit a statement, and would make a partial refund at return
 * look like a partial refund of a sale. So they are two gateway payments with
 * two references, and the booking carries both.
 *
 * WHY THE DEPOSIT IS A CAPTURED PAYMENT RATHER THAN A PRE-AUTHORISATION. A hold
 * is the better instrument in principle and is not reliably available on Indian
 * cards and UPI through this gateway. A captured payment that is refunded on
 * return works on every method a customer will actually use, and the trade —
 * the customer is out of pocket for a few days — is stated on the terms page
 * rather than hidden.
 */

type Fail = { ok: false; error: string }
type Ok<T> = { ok: true } & T
type Done = { ok: true }

// ── The rent ────────────────────────────────────────────────────────────────

/**
 * Start a payment for the rent.
 *
 * Idempotent by construction: a booking that already has a gateway order gets
 * that one back rather than a second. Without this, a customer who reloads the
 * payment screen creates a second gateway order against the same booking, and
 * the shop ends up reconciling two references for one rental.
 */
export async function startRentalPayment(
  bookingId: string,
): Promise<Ok<{ gatewayOrderId: string; amount: number; keyId: string }> | Fail> {
  const limited = await rateLimit('rental-pay', { limit: 12, windowSeconds: 600 })
  if (!limited.ok) return { ok: false, error: limited.error }

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('id, booking_number, total_amount, payment_status, gateway_order_id, status, email')
    .eq('id', bookingId)
    .maybeSingle()

  const booking = data as Pick<
    RentalBooking,
    'id' | 'booking_number' | 'total_amount' | 'payment_status' | 'gateway_order_id' | 'status' | 'email'
  > | null

  if (!booking) return { ok: false, error: 'That booking could not be found.' }
  if (booking.status === 'cancelled') return { ok: false, error: 'That booking was cancelled.' }
  if (booking.payment_status === 'paid') return { ok: false, error: 'This rental is already paid for.' }
  if (booking.total_amount <= 0) return { ok: false, error: 'There is nothing to pay on this booking.' }

  const keyId = process.env.RAZORPAY_KEY_ID
  if (!keyId) return { ok: false, error: 'Payments are not configured on this deployment.' }

  if (booking.gateway_order_id) {
    return { ok: true, gatewayOrderId: booking.gateway_order_id, amount: booking.total_amount, keyId }
  }

  const created = await createGatewayOrder({
    amount: booking.total_amount,
    receipt: booking.booking_number,
    notes: { rental_booking_id: booking.id, kind: 'rent' },
  })
  if ('error' in created) return { ok: false, error: created.error }

  await supabase
    .from('rental_bookings')
    .update({
      payment_method: 'razorpay',
      payment_status: 'pending',
      gateway_order_id: created.id,
    })
    .eq('id', booking.id)

  return { ok: true, gatewayOrderId: created.id, amount: booking.total_amount, keyId }
}

/**
 * The browser says the payment succeeded. Check that it did.
 *
 * The signature is the only thing here that is evidence. Everything else in the
 * callback — the payment id, the amount, the order id — is supplied by the page
 * and is therefore a claim. Verifying the signature against the gateway order
 * WE stored, rather than the one the callback sent, is what makes this a check
 * rather than a formality.
 */
export async function verifyRentalPayment(input: {
  bookingId: string
  gatewayOrderId: string
  gatewayPaymentId: string
  signature: string
}): Promise<Done | Fail> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('id, booking_number, email, total_amount, gateway_order_id, payment_status')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'That booking could not be found.' }

  // The stored order id, not the one in the callback. A caller who could
  // nominate both sides of this comparison would be checking their own work.
  if (data.gateway_order_id !== input.gatewayOrderId) {
    return { ok: false, error: 'That payment does not belong to this booking.' }
  }

  if (
    !razorpaySignatureValid({
      gatewayOrderId: data.gateway_order_id as string,
      gatewayPaymentId: input.gatewayPaymentId,
      signature: input.signature,
    })
  ) {
    await supabase
      .from('rental_bookings')
      .update({ payment_status: 'failed' })
      .eq('id', input.bookingId)
      .eq('payment_status', 'pending')
    await supabase.from('rental_events').insert({
      booking_id: input.bookingId, kind: 'payment_failed', note: 'Signature did not verify',
    })
    return { ok: false, error: 'That payment could not be verified.' }
  }

  const alreadyPaid = data.payment_status === 'paid'

  await supabase
    .from('rental_bookings')
    .update({
      payment_status: 'paid',
      gateway_payment_id: input.gatewayPaymentId,
      amount_paid: data.total_amount,
      paid_at: new Date().toISOString(),
    })
    .eq('id', input.bookingId)

  // Guarded, because a customer refreshing the success page must not produce a
  // second event, a second email and a second invoice attempt.
  if (!alreadyPaid) {
    await supabase.from('rental_events').insert({
      booking_id: input.bookingId,
      kind: 'payment_received',
      amount: data.total_amount,
      note: input.gatewayPaymentId,
    })
    // The invoice is issued off the queue rather than inline: issuing spends a
    // serial number, and a serial spent inside a request that then fails is a
    // hole in a statutory series. The queue retries; the request does not.
    await enqueue('rental.invoice', { bookingId: input.bookingId })
    await enqueue('rental.paid', { bookingId: input.bookingId })
  }

  revalidatePath('/account/rentals')
  revalidatePath('/admin/rentals')
  return { ok: true }
}

// ── The deposit ─────────────────────────────────────────────────────────────

/**
 * Start a deposit payment, for a rental being posted.
 *
 * Separate gateway order, separate reference, and it says what it is in the
 * notes so a statement can be read six months later.
 */
export async function startDepositPayment(
  bookingId: string,
): Promise<Ok<{ gatewayOrderId: string; amount: number; keyId: string }> | Fail> {
  const limited = await rateLimit('rental-deposit', { limit: 12, windowSeconds: 600 })
  if (!limited.ok) return { ok: false, error: limited.error }

  const supabase = createAdminSupabaseClient()
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, booking_number, deposit_amount, deposit_state, deposit_method, deposit_payment_id, deposit_order_id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'That booking could not be found.' }
  if (booking.status === 'cancelled') return { ok: false, error: 'That booking was cancelled.' }
  if (booking.deposit_amount <= 0) return { ok: false, error: 'This rental has no deposit.' }
  if (booking.deposit_state === 'held') return { ok: false, error: 'The deposit is already held.' }

  const keyId = process.env.RAZORPAY_KEY_ID
  if (!keyId) return { ok: false, error: 'Payments are not configured on this deployment.' }

  // Reuse a deposit order we already made, the way the rent path does at the
  // top of this file. Minting a fresh one on every call let a customer pay two
  // deposits, of which only the last is referenced by anything.
  if (booking.deposit_order_id) {
    return {
      ok: true,
      gatewayOrderId: booking.deposit_order_id as string,
      amount: booking.deposit_amount,
      keyId,
    }
  }

  const created = await createGatewayOrder({
    amount: booking.deposit_amount,
    receipt: `${booking.booking_number}-DEP`,
    notes: { rental_booking_id: booking.id, kind: 'deposit' },
  })
  if ('error' in created) return { ok: false, error: created.error }

  // STORE THE ORDER ID. Without this there is nothing for verifyDepositPayment
  // to compare a callback against, and the signature alone proves only that a
  // payment happened somewhere on this merchant account.
  await supabase
    .from('rental_bookings')
    .update({ deposit_method: 'gateway', deposit_order_id: created.id })
    .eq('id', booking.id)

  return { ok: true, gatewayOrderId: created.id, amount: booking.deposit_amount, keyId }
}

/**
 * The counter gets paid, in the database.
 *
 * THE HOLE THIS FILLS
 *
 * Every booking this shop has taken is `pickup` / `payment_method: 'cod'`, and
 * NOTHING ever moved such a booking to `paid`. `handOverBooking` writes
 * `status` and `deposit_state` and no money at all. So:
 *
 *   · `payment_status` reads `unpaid` forever, on a rental that was paid in
 *     full, in cash, at the counter;
 *   · `amount_paid` stays 0, so the account screen offers a Pay button for
 *     money already handed over;
 *   · no invoice is ever issued, because `rental.invoice` is enqueued in
 *     exactly one place — inside `verifyRentalPayment`. Migration 101 argues
 *     that payment is the trigger "for every rental, however it is fulfilled",
 *     and the cash payment was never an event the system could see.
 *
 * A hire business that cannot say which of its rentals have been paid for is
 * not missing a feature; it is missing its books.
 *
 * The deposit is recorded here too, and separately, because it is not revenue:
 * `deposit_taken` is what was actually lodged, which can be less than
 * `deposit_amount` when an operator takes a part deposit against a regular.
 */
export async function recordCounterPayment(input: {
  bookingId: string
  /** Rent actually collected, in paise. Defaults to the balance outstanding. */
  rentPaid?: number
  /** Cash deposit lodged, in paise. Defaults to the booking's deposit. */
  depositTaken?: number
  note?: string
}): Promise<Done | Fail> {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, status, total_amount, amount_paid, payment_status, deposit_amount, deposit_state, deposit_method')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'That booking could not be found.' }
  if (booking.status === 'cancelled') return { ok: false, error: 'That booking was cancelled.' }

  const alreadyPaid = (booking.amount_paid as number) ?? 0
  const balance = Math.max(0, (booking.total_amount as number) - alreadyPaid)
  const rent = Math.max(0, Math.round(input.rentPaid ?? balance))
  if (rent > balance) {
    return {
      ok: false,
      error: `That is more than is outstanding. The balance on this booking is ₹${Math.round(balance / 100).toLocaleString('en-IN')}.`,
    }
  }

  const deposit = Math.max(0, Math.round(input.depositTaken ?? (booking.deposit_amount as number) ?? 0))
  if (deposit > (booking.deposit_amount as number)) {
    return { ok: false, error: 'That is more than the deposit on this booking.' }
  }

  const nowPaid = alreadyPaid + rent
  const settled = nowPaid >= (booking.total_amount as number)

  // A gateway deposit is not ours to declare held — verifyDepositPayment owns
  // that, and the CHECK in migration 100 enforces it.
  const depositIsCash = booking.deposit_method !== 'gateway'

  const { data: claimed, error } = await supabase
    .from('rental_bookings')
    .update({
      amount_paid: nowPaid,
      payment_status: settled ? 'paid' : 'pending',
      payment_method: 'cod',
      ...(settled ? { paid_at: new Date().toISOString() } : {}),
      ...(depositIsCash && deposit > 0
        ? { deposit_taken: deposit, deposit_state: 'held' as const }
        : {}),
    })
    .eq('id', input.bookingId)
    .neq('status', 'cancelled')
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!claimed?.length) return { ok: false, error: 'That booking changed while you were looking at it.' }

  const events: Record<string, unknown>[] = []
  if (rent > 0) {
    events.push({
      booking_id: input.bookingId,
      kind: 'payment_received',
      amount: rent,
      note: input.note ?? 'Paid at the counter',
      actor_id: actor.id,
    })
  }
  if (depositIsCash && deposit > 0) {
    events.push({
      booking_id: input.bookingId,
      kind: 'deposit_held',
      amount: deposit,
      note: 'Cash deposit taken at the counter',
      actor_id: actor.id,
    })
  }
  if (events.length) await supabase.from('rental_events').insert(events)

  // The invoice trigger migration 101 says should fire "for every rental,
  // however it is fulfilled". It only ever fired for gateway money.
  if (settled) {
    await enqueue('rental.invoice', { bookingId: input.bookingId })
  }

  revalidatePath('/admin/rentals')
  revalidatePath('/account/rentals')
  return { ok: true }
}

/** Confirm a deposit payment and mark it held. */
export async function verifyDepositPayment(input: {
  bookingId: string
  gatewayOrderId: string
  gatewayPaymentId: string
  signature: string
}): Promise<Done | Fail> {
  const supabase = createAdminSupabaseClient()

  // THE BOOKING FIRST, then the signature — the same order `verifyRentalPayment`
  // uses above, and for the same reason. This function used to verify the
  // signature against `input.gatewayOrderId`, which is the caller's own value,
  // with nothing to check it against: a valid triple from ANY payment on this
  // merchant account marked the deposit held. Replaying the rent triple even
  // pointed `deposit_payment_id` at the rent payment, so the eventual refund
  // came out of money the customer had actually paid for the hire.
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, deposit_amount, deposit_state, deposit_order_id')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (!booking) return { ok: false, error: 'That booking could not be found.' }

  if (!booking.deposit_order_id) {
    return {
      ok: false,
      error: 'No deposit payment was started for this booking. Open the deposit again from your rentals.',
    }
  }
  if (booking.deposit_order_id !== input.gatewayOrderId) {
    return { ok: false, error: 'That payment does not belong to this deposit.' }
  }

  if (
    !razorpaySignatureValid({
      // The STORED order id. A caller who could nominate both sides of this
      // comparison would be checking their own work.
      gatewayOrderId: booking.deposit_order_id as string,
      gatewayPaymentId: input.gatewayPaymentId,
      signature: input.signature,
    })
  ) {
    return { ok: false, error: 'That deposit payment could not be verified.' }
  }

  await supabase
    .from('rental_bookings')
    .update({
      deposit_method: 'gateway',
      deposit_state: 'held',
      deposit_payment_id: input.gatewayPaymentId,
    })
    .eq('id', input.bookingId)

  if (booking.deposit_state !== 'held') {
    await supabase.from('rental_events').insert({
      booking_id: input.bookingId,
      kind: 'deposit_held',
      amount: booking.deposit_amount,
      note: `Held at the gateway (${input.gatewayPaymentId})`,
    })
  }

  revalidatePath('/admin/rentals')
  return { ok: true }
}

/**
 * Give the deposit back, less whatever is owed.
 *
 * Called by `returnBooking` once late and damage are settled, and callable on
 * its own by an admin for the case that always eventually happens: a deposit
 * that should have gone back and did not.
 *
 * THE MONEY MOVES FIRST, THEN THE RECORD. A row saying "refunded" with no
 * gateway refund behind it is worse than no row at all — it is the state where
 * everybody believes the customer has been paid and nobody has. So a gateway
 * failure leaves the deposit held, writes nothing claiming otherwise, and
 * shouts.
 */
export async function refundRentalDeposit(input: {
  bookingId: string
  lateFee?: number
  damageFee?: number
}): Promise<Ok<{ refunded: number; unrecovered: number }> | Fail> {
  const actor = await requireAdmin()
  const supabase = createAdminSupabaseClient()

  const { data } = await supabase
    .from('rental_bookings')
    .select('id, booking_number, email, deposit_amount, deposit_state, deposit_method, deposit_payment_id, deposit_refunded, deposit_settled_at, deposit_taken, late_fee, damage_fee')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (!data) return { ok: false, error: 'That booking could not be found.' }
  if (data.deposit_state === 'waived' || data.deposit_amount <= 0) {
    return { ok: false, error: 'There is no deposit on this booking.' }
  }
  // `deposit_settled_at`, not `deposit_refunded > 0`: a FULL forfeiture leaves
  // deposit_refunded at 0, so the old guard let it be settled again and again,
  // each time re-inserting a deposit_forfeited event and re-mailing the customer.
  if (data.deposit_settled_at) {
    return { ok: false, error: 'This deposit has already been settled.' }
  }

  const settlement = settleDeposit({
    deposit: data.deposit_amount,
    lateFee: input.lateFee ?? data.late_fee ?? 0,
    damageFee: input.damageFee ?? data.damage_fee ?? 0,
  })

  let refundId: string | null = null

  if (settlement.refund > 0 && data.deposit_method === 'gateway') {
    if (!data.deposit_payment_id) {
      return { ok: false, error: 'This deposit is marked as taken at the gateway but has no payment to refund against. Settle it by hand.' }
    }
    const res = await refundGatewayPayment(data.deposit_payment_id, settlement.refund)
    if ('error' in res) {
      await sendSlackAlert(
        `:rotating_light: Deposit refund FAILED for rental ${data.booking_number} (₹${(settlement.refund / 100).toLocaleString('en-IN')}). ${res.error}. Needs a manual refund.`,
      ).catch(() => {})
      return { ok: false, error: `The gateway refused the refund: ${res.error}` }
    }
    refundId = res.refundId
  }

  await supabase
    .from('rental_bookings')
    .update({
      deposit_state: settlement.state,
      deposit_refunded: settlement.refund,
      deposit_refund_id: refundId,
      deposit_settled_at: new Date().toISOString(),
    })
    .eq('id', input.bookingId)

  await supabase.from('rental_events').insert({
    booking_id: input.bookingId,
    kind: settlement.refund > 0 ? 'deposit_refunded' : 'deposit_forfeited',
    amount: settlement.refund > 0 ? settlement.refund : data.deposit_amount,
    actor_id: actor.id,
    note:
      settlement.unrecovered > 0
        ? `₹${(settlement.unrecovered / 100).toLocaleString('en-IN')} owed beyond the deposit — not charged automatically`
        : data.deposit_method === 'cash'
          ? 'Returned in cash at the counter'
          : refundId,
  })

  await enqueue('rental.deposit_settled', { bookingId: input.bookingId })

  revalidatePath('/account/rentals')
  revalidatePath('/admin/rentals')
  return { ok: true, refunded: settlement.refund, unrecovered: settlement.unrecovered }
}

/**
 * What the customer is allowed to see about their own payment state.
 *
 * Takes no booking id from a parameter it trusts: ownership comes from the
 * session, exactly as `getMyRentalBookings` does, because this file is
 * `'use server'` and every export in it is a callable endpoint.
 */
export async function getMyRentalPaymentState(bookingId: string) {
  const user = await getUser()
  if (!user) return null

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('rental_bookings')
    .select('id, user_id, payment_status, total_amount, amount_paid, deposit_amount, deposit_state, deposit_refunded')
    .eq('id', bookingId)
    .maybeSingle()

  if (!data || data.user_id !== user.id) return null
  return data
}
