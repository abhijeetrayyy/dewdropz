'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import {
  startRentalPayment, verifyRentalPayment,
  startDepositPayment, verifyDepositPayment,
} from '@/actions/rentalPayments'
import { formatPrice } from '@/lib/utils'

/**
 * Paying for a rental, and lodging the deposit.
 *
 * TWO PAYMENTS, IN ORDER, AND THE ORDER MATTERS. The rent first, because it is
 * the thing being bought and the thing that gets invoiced. The deposit second,
 * and only for a posted rental — gear collected in person has a counter, and a
 * counter can take cash, which is both cheaper for the shop and less money out
 * of the customer's account.
 *
 * WHY THE DEPOSIT IS A REAL PAYMENT RATHER THAN A HOLD. A pre-authorisation is
 * the better instrument in principle and is not reliably available on Indian
 * cards and UPI through this gateway. A captured payment refunded on return
 * works on every method somebody will actually use. The trade — being out of
 * pocket for a few days — is stated here, in the copy, rather than discovered.
 */

type Props = {
  bookingId: string
  bookingNumber: string
  amount: number
  depositAmount: number
  depositState: string
  fulfilment: 'pickup' | 'ship'
}

export default function RentalPayButton({
  bookingId, bookingNumber, amount, depositAmount, depositState, fulfilment,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Loaded on mount rather than on click: a customer who taps Pay and then
  // waits for a script to download is a customer who taps it again.
  //
  // The already-present case is read at render rather than pushed into state
  // from inside the effect — setting state synchronously in an effect is a
  // second render for a value that was knowable in the first.
  useEffect(() => {
    if (window.Razorpay) return
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => setLoaded(true)
    document.body.appendChild(script)
    return () => { script.remove() }
  }, [])

  const ready = loaded || (typeof window !== 'undefined' && Boolean(window.Razorpay))

  const needsDeposit = fulfilment === 'ship' && depositAmount > 0 && depositState !== 'held'

  async function payDeposit() {
    const dep = await startDepositPayment(bookingId)
    if (!dep.ok) { toast.error(dep.error); return }

    const rzp = new window.Razorpay({
      key: dep.keyId,
      order_id: dep.gatewayOrderId,
      amount: dep.amount,
      currency: 'INR',
      name: 'DEWDROPZ',
      description: `Refundable deposit · ${bookingNumber}`,
      handler: async (r) => {
        const done = await verifyDepositPayment({
          bookingId,
          gatewayOrderId: r.razorpay_order_id,
          gatewayPaymentId: r.razorpay_payment_id,
          signature: r.razorpay_signature,
        })
        if (!done.ok) { toast.error(done.error); return }
        toast.success('Deposit held. It comes back when the gear does.')
        router.refresh()
      },
      theme: { color: '#2E5C42' },
    })
    rzp.open()
  }

  async function pay() {
    if (!ready) { toast.error('The payment window is still loading — try again in a moment.'); return }
    setBusy(true)
    try {
      const res = await startRentalPayment(bookingId)
      if (!res.ok) { toast.error(res.error); return }

      const rzp = new window.Razorpay({
        key: res.keyId,
        order_id: res.gatewayOrderId,
        amount: res.amount,
        currency: 'INR',
        name: 'DEWDROPZ',
        description: `Rental ${bookingNumber}`,
        handler: async (r) => {
          const done = await verifyRentalPayment({
            bookingId,
            gatewayOrderId: r.razorpay_order_id,
            gatewayPaymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          })
          if (!done.ok) { toast.error(done.error); return }

          // The deposit follows immediately rather than being left as a second
          // thing to remember. Chained inside the handler so the two screens are
          // one flow from the customer's side.
          if (needsDeposit) {
            toast.success('Paid. One more step — the refundable deposit.')
            await payDeposit()
          } else {
            toast.success('Paid. See you on the day.')
            router.refresh()
          }
        },
        theme: { color: '#2E5C42' },
      })

      rzp.on('payment.failed', (e) => {
        // Distinct from the modal being dismissed: "you closed it" and "your
        // bank said no" are different problems with different next steps.
        toast.error(e.error?.description ?? 'That payment was declined. Try another method.')
      })

      rzp.open()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-[var(--r-input)] bg-forest px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-deep disabled:opacity-50"
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Pay {formatPrice(amount)}
      </button>
      {needsDeposit && (
        <span className="font-body text-[11px] text-mid">
          plus {formatPrice(depositAmount)} deposit, refunded on return
        </span>
      )}
    </div>
  )
}
