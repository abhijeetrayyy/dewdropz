import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { RENTAL_POLICY } from '@/lib/rentalPolicy'
import RentPayClient from './RentPayClient'

export const metadata: Metadata = {
  title: 'Complete your rental payment — DEWDROPZ',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The payment step for a rental hold, hosted on the storefront.
 *
 * WHY THIS PAGE EXISTS AT ALL. Gear is now held only while a payment is
 * completed, and the Expo app had no way to complete one — so every booking
 * made on the phone was a hold that expired fifteen minutes later. This is the
 * missing step, and it is a web page for the same reason `/pay/[orderId]` is:
 * `react-native-razorpay` means a native module to maintain, a store rebuild to
 * adopt it, and the publishable key inside the app bundle. Razorpay's own
 * checkout IS a web widget. The app opens this in a browser sheet and is
 * returned by deep link.
 *
 * IT IS ALSO USEFUL ON THE WEB. A hold whose payment sheet was dismissed can be
 * resumed from this URL, which is what makes the booking confirmation email's
 * "finish paying" link possible.
 *
 * WHAT SECURES IT. A booking id is a v4 UUID and is not enumerable — the same
 * reasoning 080 applies to share tokens. Somebody holding one can see the
 * booking number, the amount and the deadline, and can pay it. It deliberately
 * shows no customer, no address, no dates and no gear.
 *
 * A STRONGER VERSION EXISTS and was not built: a single-use pay token minted
 * per attempt, so a leaked URL stops working once used. That is a migration,
 * and it is the right thing to add before this handles real volume — the same
 * note `/pay/[orderId]` carries, and for the same reason.
 */
export default async function RentPayPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params

  const admin = createAdminSupabaseClient()
  const { data: booking } = await admin
    .from('rental_bookings')
    // An explicit, minimal column list. Nothing about who the customer is or
    // what they hired belongs on a page reachable by URL alone.
    .select('id, booking_number, total_amount, payment_status, status, hold_expires_at')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) notFound()

  return (
    <RentPayClient
      bookingId={booking.id}
      bookingNumber={booking.booking_number}
      amount={booking.total_amount}
      alreadyPaid={booking.payment_status === 'paid'}
      // A hold that has already been swept cannot be paid for — the gear is
      // back on the shelf and taking money for it would be selling something
      // the shop no longer has set aside.
      expired={booking.status === 'cancelled'}
      holdExpiresAt={booking.hold_expires_at as string | null}
      holdLabel={RENTAL_POLICY.payment.holdLabel}
      keyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''}
    />
  )
}
