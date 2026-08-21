'use client'

import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import { formatPrice } from '@/lib/utils'

// ⚠ UNVERIFIED — no Razorpay credentials exist in this repository, so the
// widget below has never opened. See app/api/mobile/orders/razorpay/route.ts.

type RazorpayResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

/** Where the app is waiting. Deep links back into the native checkout flow. */
const APP_SUCCESS = 'dewdropz://checkout/success'
const APP_CANCEL = 'dewdropz://checkout/cancelled'

export default function PayClient({
  orderId,
  orderNumber,
  amount,
  razorpayOrderId,
  alreadyPaid,
  keyId,
}: {
  orderId: string
  orderNumber: string
  amount: number
  razorpayOrderId: string
  alreadyPaid: boolean
  keyId: string
}) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<'idle' | 'verifying' | 'done' | 'failed'>(
    alreadyPaid ? 'done' : 'idle'
  )
  const [error, setError] = useState('')

  // Returning to the app is a navigation, not a redirect we can await — the OS
  // takes over as soon as the scheme resolves.
  const backToApp = useCallback((url: string) => {
    window.location.href = url
  }, [])

  useEffect(() => {
    if (alreadyPaid) {
      // Re-opening a link for an order that is already settled should not
      // present a second payment sheet.
      const t = setTimeout(() => backToApp(`${APP_SUCCESS}?orderId=${orderId}`), 900)
      return () => clearTimeout(t)
    }
  }, [alreadyPaid, orderId, backToApp])

  async function verify(r: RazorpayResponse) {
    setState('verifying')
    try {
      const res = await fetch('/api/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...r }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // The webhook is the durable source of truth and will confirm this
        // order independently, so a failed client-side verify is reported
        // without claiming the payment did not happen.
        setError(
          typeof data?.error === 'string'
            ? `${data.error}. If money left your account, the confirmation will follow shortly.`
            : 'We could not confirm that instantly. If money left your account, the confirmation will follow shortly.'
        )
        setState('failed')
        return
      }
      setState('done')
      backToApp(`${APP_SUCCESS}?orderId=${orderId}`)
    } catch {
      setError('We could not reach us to confirm. If money left your account, the confirmation will follow shortly.')
      setState('failed')
    }
  }

  function pay() {
    if (typeof window.Razorpay !== 'function' || !keyId) {
      setError('Payment is not available just now.')
      setState('failed')
      return
    }
    const rzp = new window.Razorpay({
      key: keyId,
      order_id: razorpayOrderId,
      amount,
      currency: 'INR',
      name: 'DEWDROPZ',
      description: `Order ${orderNumber}`,
      handler: (r) => verify(r),
      modal: {
        // Abandoning leaves the order pending and re-payable — it is not
        // cancelled here, because a customer who closes the sheet by accident
        // should be able to try again rather than rebuild their cart.
        ondismiss: () => backToApp(`${APP_CANCEL}?orderId=${orderId}`),
      },
      theme: { color: '#1F3D2B' },
    })
    rzp.on('payment.failed', (resp) => {
      setError(resp?.error?.description ?? 'That payment did not go through.')
      setState('failed')
    })
    rzp.open()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      {/* Opened from the script's own ready callback rather than an effect.
          This page exists only to show the sheet — a screen whose single button
          says "Pay" is a tap nobody needed to make — and `onReady` is an event,
          so the state `pay()` sets on its failure path is set in a handler
          rather than during render, which is what the effect version got wrong. */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => {
          setReady(true)
          if (!alreadyPaid) pay()
        }}
      />

      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mid">
        Order {orderNumber}
      </p>
      <p className="mt-3 font-mono text-3xl tabular-nums text-ink">{formatPrice(amount)}</p>

      {state === 'idle' && (
        <p className="mt-6 font-body text-sm text-mid">
          {ready ? 'Opening payment…' : 'Getting the payment window ready…'}
        </p>
      )}
      {state === 'verifying' && (
        <p className="mt-6 font-body text-sm text-mid">Confirming your payment — do not close this.</p>
      )}
      {state === 'done' && (
        <p className="mt-6 font-body text-sm text-forest">Paid. Taking you back to the app…</p>
      )}
      {state === 'failed' && (
        <div className="mt-6 max-w-sm">
          <p className="font-body text-sm text-clay-deep">{error}</p>
          <div className="mt-5 flex flex-col gap-3">
            <button
              onClick={() => { setError(''); setState('idle'); pay() }}
              className="rounded-full bg-ink px-6 py-3 font-body text-sm text-paper"
            >
              Try again
            </button>
            <button
              onClick={() => backToApp(`${APP_CANCEL}?orderId=${orderId}`)}
              className="font-body text-sm text-mid underline"
            >
              Back to the app
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
