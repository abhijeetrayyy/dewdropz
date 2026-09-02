'use client'

import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { startRentalPayment, verifyRentalPayment } from '@/actions/rentalPayments'
import { formatPrice } from '@/lib/utils'

// ⚠ The gateway leg is UNVERIFIED — there are no Razorpay credentials in this
// repository, so the widget below has never opened. Everything around it — the
// hold, its expiry, the availability recovery and the confirmation write — is
// verified against the live database.

type RazorpayResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

/**
 * ONE DEEP LINK, NOT TWO, and it is the interesting decision on this page.
 *
 * `/pay/[orderId]` returns the app to a success route or a cancelled route
 * depending on how the sheet closed. That works for an order, whose state is
 * decided by this page. A rental HOLD is different: it can be paid, still held,
 * or already swept, and the browser is not the authority on which — the sweep
 * runs server-side and may have fired while the sheet was open.
 *
 * So every exit returns to the same place, and the app reads the booking from
 * the database and says what is actually true. A page that guessed would
 * eventually tell somebody "reserved" about gear that had gone back on the
 * shelf while they were typing an OTP.
 */
const backTo = (n: string) => `dewdropz://rent/booked/${encodeURIComponent(n)}`

export default function RentPayClient({
  bookingId, bookingNumber, amount, alreadyPaid, expired, holdExpiresAt, holdLabel, keyId,
}: {
  bookingId: string
  bookingNumber: string
  amount: number
  alreadyPaid: boolean
  expired: boolean
  holdExpiresAt: string | null
  holdLabel: string
  keyId: string
}) {
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'failed'>(
    alreadyPaid ? 'done' : expired ? 'failed' : 'idle',
  )
  const [error, setError] = useState(
    expired ? 'This hold ran out before the payment arrived, so the gear went back on the shelf. Nothing was charged — you are welcome to book it again.' : '',
  )
  const [now, setNow] = useState(() => Date.now())

  // Returning to the app is a navigation, not a redirect we can await — the OS
  // takes over as soon as the scheme resolves. On a desktop browser the scheme
  // simply does not resolve, which is why there is a visible link below too.
  const toApp = useCallback(() => { window.location.href = backTo(bookingNumber) }, [bookingNumber])

  useEffect(() => {
    if (!alreadyPaid) return
    // Re-opening a link for a booking already settled must not present a second
    // payment sheet.
    const t = setTimeout(toApp, 900)
    return () => clearTimeout(t)
  }, [alreadyPaid, toApp])

  // The countdown, derived from the server's deadline rather than a duration
  // this page assumed — the same rule the booking panel follows.
  useEffect(() => {
    if (!holdExpiresAt || alreadyPaid || expired) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [holdExpiresAt, alreadyPaid, expired])

  const secondsLeft = holdExpiresAt
    ? Math.max(0, Math.round((Date.parse(holdExpiresAt) - now) / 1000))
    : null

  const verify = useCallback(
    async (r: RazorpayResponse) => {
      setState('verifying')
      const done = await verifyRentalPayment({
        bookingId,
        gatewayOrderId: r.razorpay_order_id,
        gatewayPaymentId: r.razorpay_payment_id,
        signature: r.razorpay_signature,
      })
      if (!done.ok) {
        // `verifyRentalPayment` owns the hard case — a payment that lands after
        // its hold was swept is refunded there, in full, and the sentence it
        // returns says so. Repeating it verbatim beats inventing a friendlier
        // one that means something different about somebody's money.
        setError(done.error)
        setState('failed')
        return
      }
      setState('done')
      toApp()
    },
    [bookingId, toApp],
  )

  const pay = useCallback(() => {
    if (typeof window.Razorpay !== 'function' || !keyId) {
      setError('Payment is not available just now.')
      setState('failed')
      return
    }
    startRentalPayment(bookingId).then((started) => {
      if (!started.ok) { setError(started.error); setState('failed'); return }
      const rzp = new window.Razorpay({
        key: started.keyId,
        order_id: started.gatewayOrderId,
        amount: started.amount,
        currency: 'INR',
        name: 'DEWDROPZ',
        description: `Rental ${bookingNumber}`,
        handler: (r) => verify(r),
        modal: {
          // Dismissing does not cancel anything. The hold is still running and
          // still payable, so the app is simply returned to and shown the truth.
          ondismiss: () => toApp(),
        },
        theme: { color: '#1F3D2B' },
      })
      rzp.on('payment.failed', (resp) => {
        setError(resp?.error?.description ?? 'That payment did not go through. The gear is still held.')
        setState('failed')
      })
      rzp.open()
    })
  }, [bookingId, bookingNumber, keyId, verify, toApp])

  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      {/* Opened from the script's own ready callback rather than an effect.
          This page exists only to show the sheet — a screen whose single button
          says "Pay" is a tap nobody needed to make. */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => { if (!alreadyPaid && !expired) pay() }}
      />

      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mid">
        Rental {bookingNumber}
      </p>
      <p className="mt-3 font-display text-4xl text-ink">{formatPrice(amount)}</p>

      {state === 'done' ? (
        <p className="mt-4 max-w-sm font-body text-[15px] leading-relaxed text-forest">
          Paid. The gear is reserved for your dates — taking you back to the app.
        </p>
      ) : state === 'verifying' ? (
        <p className="mt-4 font-body text-[15px] text-mid">Confirming with the bank…</p>
      ) : state === 'failed' ? (
        <>
          <p className="mt-4 max-w-sm font-body text-[15px] leading-relaxed text-clay-deep">{error}</p>
          {!expired && (
            <button
              type="button"
              onClick={() => { setError(''); setState('idle'); pay() }}
              className="mt-6 rounded-full bg-forest px-6 py-3 font-body text-sm font-medium text-paper hover:bg-forest-mid"
            >
              Try that again
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 max-w-sm font-body text-[15px] leading-relaxed text-mid">
            Opening the payment window. If nothing happens, tap below.
          </p>
          <button
            type="button"
            onClick={pay}
            className="mt-6 rounded-full bg-forest px-6 py-3 font-body text-sm font-medium text-paper hover:bg-forest-mid"
          >
            Pay {formatPrice(amount)}
          </button>
        </>
      )}

      {/* The deadline, where somebody about to type a card number can see it.
          Nothing is more annoying than a hold that dies silently mid-payment. */}
      {secondsLeft !== null && secondsLeft > 0 && state !== 'done' && !expired && (
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-mid">
          Held for {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} more
        </p>
      )}
      {secondsLeft === 0 && state !== 'done' && !expired && (
        <p className="mt-6 max-w-sm font-body text-[13px] leading-relaxed text-clay-deep">
          The {holdLabel} are up. If a payment is still in progress it will be honoured or refunded
          in full — nothing is taken for gear you do not get.
        </p>
      )}

      {/* The scheme does not resolve in a desktop browser, so there is always a
          way onward that is not a dead end. */}
      <Link href="/account/rentals" className="mt-8 font-body text-[13px] text-forest underline underline-offset-4">
        Open your rentals
      </Link>
    </main>
  )
}
