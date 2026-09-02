import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase'
import { shopToday } from '@/lib/shopTime'
import { sendSlackAlert } from '@/lib/slack'
import { cancellationQuote, RENTAL_POLICY, type CancelledBy } from '@/lib/rentalPolicy'

/**
 * Cancelling a rental, and giving back what the policy says.
 *
 * WHY THIS IS A LIBRARY AND NOT A SERVER ACTION
 *
 * Three callers need exactly this behaviour: the web account screen (a server
 * action), the admin screen (another server action, cancelling as the SHOP),
 * and the phone (a REST route, because Expo cannot invoke a server action).
 * The first two used to share a private function inside `actions/rentals.ts`
 * and the third did not exist, so adding the phone meant either exporting money
 * code as a public endpoint or writing the refund a second time.
 *
 * Neither is acceptable. A second implementation of a refund is a second
 * opinion about somebody's money, and it will be the one that is wrong — this
 * repo has the receipts: `lib/checkoutPricing.ts` exists because the app once
 * quoted ₹2,049 for a hoodie the server billed at ₹2,226.88.
 *
 * `import 'server-only'` because this holds the service-role client. It
 * registers no endpoint; every caller is a route or an action that has already
 * established who is asking.
 *
 * IDENTITY IS A PARAMETER HERE, AND THAT IS THE DANGEROUS SHAPE. It is the
 * exact shape of the `claimGuestRentalBookings` defect — a function that took
 * both halves of an identity and trusted them. What makes it safe is the same
 * thing that makes `lib/rentalClaim.ts` safe: this file cannot be reached from
 * a browser, and every caller derives `userId` from a verified session or token
 * rather than from a request body. A caller that passes a user id it was handed
 * is the bug; there is no way for this module to detect that, so it is stated
 * here in the loudest place available.
 */

type Fail = { ok: false; error: string }


/**
 * What a customer would get back if they cancelled right now.
 *
 * Returns null for "not yours" and for "does not exist" alike: an id is not
 * proof of anything, and a different answer for the two is an oracle that tells
 * an attacker which booking numbers are real.
 */
export async function cancellationQuoteFor(bookingId: string, userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data: b } = await supabase
    .from('rental_bookings')
    .select('id, user_id, status, created_at, amount_paid, deposit_state, deposit_taken, deposit_amount')
    .eq('id', bookingId)
    .maybeSingle()

  if (!b || b.user_id !== userId) return null

  const depositHeld =
    b.deposit_state === 'held'
      ? ((b.deposit_taken as number | null) ?? (b.deposit_amount as number) ?? 0)
      : 0
  const firstDay = await firstDayOf(bookingId)

  const quote = cancellationQuote({
    rentPaid: (b.amount_paid as number) ?? 0,
    depositHeld,
    startsOn: firstDay ?? shopToday(),
    today: shopToday(),
    bookedAt: (b.created_at as string) ?? 0,
    now: new Date(),
    cancelledBy: 'customer',
  })

  return {
    ...quote,
    startsOn: firstDay,
    cancellable: RENTAL_POLICY.cancellableWhile.includes(b.status as 'reserved'),
  }
}

/**
 * A customer calling off their own booking.
 *
 * Two rules, both enforced here rather than trusted to the caller:
 *   • It must be THEIR booking. The caller supplies an id derived from a
 *     verified session; this function checks it against the row.
 *   • Only while it is a hold or a reservation. Once the gear is handed over,
 *     a return — not a cancellation — is what happens next, and a cancelled row
 *     would free dates for a tent somebody is holding.
 */
export async function cancelBookingFor(
  bookingId: string,
  userId: string,
): Promise<{ ok: true; refunded: number } | Fail> {
  const supabase = createAdminSupabaseClient()
  const { data: booking } = await supabase
    .from('rental_bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking || booking.user_id !== userId) {
    // Same answer either way: an attacker must not learn that a booking exists.
    return { ok: false, error: 'That booking could not be found.' }
  }

  // An unpaid hold is cancellable too — it is somebody changing their mind at
  // the payment sheet, no money has moved, and there is nothing to charge for.
  if (!RENTAL_POLICY.cancellableWhile.includes(booking.status as 'reserved')) {
    return {
      ok: false,
      error:
        booking.status === 'cancelled'
          ? 'That booking is already cancelled.'
          : 'This one is already under way — call the shop and we will sort it out.',
    }
  }

  // The figure is read BEFORE the row is touched, because the refund path
  // recomputes it and the caller wants to report what actually went back.
  const quote = await cancellationQuoteFor(bookingId, userId)

  // Claim the booking BEFORE freeing the dates — the other order leaves a live
  // booking whose units are already back on the shelf if the claim fails.
  const { data: claimed, error } = await supabase
    .from('rental_bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'customer',
      cancellation_reason: 'Cancelled by the customer',
      // A cancelled hold has no deadline left to enforce, and leaving one
      // behind would keep it in the sweep's sights forever.
      hold_expires_at: null,
    })
    .eq('id', bookingId)
    .eq('status', booking.status)
    .select('id')
  if (error) return { ok: false, error: 'That did not go through. Try again.' }
  if (!claimed?.length) {
    return { ok: false, error: 'That booking changed a moment ago. Reload and try again.' }
  }

  // Cancelling the reservations is what frees the dates: the exclusion
  // constraint ignores cancelled rows, so the units are bookable again at once.
  await supabase.from('rental_reservations').update({ status: 'cancelled' }).eq('booking_id', bookingId)

  await supabase.from('rental_events').insert({
    booking_id: bookingId, kind: 'cancelled', note: 'Cancelled by the customer',
  })

  await refundCancelledBooking(bookingId, 'the customer cancelled', 'customer')
  return { ok: true, refunded: quote?.total ?? 0 }
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
export async function refundCancelledBooking(
  bookingId: string,
  why: string,
  cancelledBy: CancelledBy,
  actorId?: string,
) {
  const supabase = createAdminSupabaseClient()
  const { data: b } = await supabase
    .from('rental_bookings')
    .select('id, created_at, total_amount, amount_paid, payment_status, gateway_payment_id, deposit_state, deposit_taken, deposit_amount, deposit_payment_id, deposit_refunded')
    .eq('id', bookingId)
    .maybeSingle()
  if (!b) return

  const rentPaid = (b.amount_paid as number) ?? 0
  const depositHeld =
    b.deposit_state === 'held' ? ((b.deposit_taken as number | null) ?? (b.deposit_amount as number) ?? 0) : 0
  if (rentPaid <= 0 && depositHeld <= 0) return

  const firstDay = await firstDayOf(bookingId)
  // The FULL quote, not a band lookup. Three things decide this figure and the
  // old call could express only one of them: how much notice there is, whether
  // the booking is inside its grace window, and — the one that matters most —
  // WHO cancelled. A shop-initiated cancellation is always refunded in full,
  // because a shop that keeps money when its own tent breaks is a shop that
  // profits from its failures.
  const plan = cancellationQuote({
    rentPaid,
    depositHeld,
    startsOn: firstDay ?? shopToday(),
    today: shopToday(),
    bookedAt: (b.created_at as string) ?? 0,
    now: new Date(),
    cancelledBy,
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
        .update({
          // 'refunded' means all of it. A band that returns three quarters was
          // writing that word too, so an operator reconciling a statement could
          // not tell a whole refund from a partial one — and neither could the
          // customer reading their own booking.
          payment_status: plan.rentRetained > 0 ? 'part_refunded' : 'refunded',
          rent_refunded: plan.rentRefund,
          amount_paid: Math.max(0, rentPaid - plan.rentRefund),
        })
        .eq('id', bookingId)
      await supabase.from('rental_events').insert({
        booking_id: bookingId, kind: 'refunded', amount: plan.rentRefund, actor_id: actorId ?? null,
        note: `Rent refunded because ${why}. ${plan.summary}`,
      })
      // What was KEPT is its own line in the history, with the reason attached.
      // A customer looking at a partial refund should find the missing quarter
      // named and explained here, not have to work it out from a subtraction.
      if (plan.rentRetained > 0) {
        await supabase.from('rental_events').insert({
          booking_id: bookingId, kind: 'note', actor_id: actorId ?? null,
          note: `Retained ₹${(plan.rentRetained / 100).toFixed(2)} of the rent. ${plan.band.label}`,
        })
      }
    }
  }

  // The deposit is the customer's money. It always comes back.
  if (depositHeld > 0) {
    if (b.deposit_payment_id) {
      const { refundRentalDeposit } = await import('@/actions/rentalPayments')
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
