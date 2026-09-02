'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { BanknoteArrowUp, Loader2 } from 'lucide-react'
import { recordCounterPayment } from '@/actions/rentalPayments'
import { formatPrice } from '@/lib/utils'

/**
 * The counter gets paid — on a screen.
 *
 * `recordCounterPayment` was written, reviewed and correct, and had ZERO
 * CALLERS. Every booking this shop has taken is a collection paid in cash, and
 * nothing in the system could move one to `paid`: no receipt, no invoice — the
 * `rental.invoice` job only ever fired from the gateway path — and the deposit
 * lodged at the counter was recorded nowhere at all. A hire business that
 * cannot say which of its rentals have been paid for is not missing a feature,
 * it is missing its books.
 *
 * SO IT IS A BUTTON FIRST AND A FORM SECOND. The overwhelmingly common case is
 * "they paid the whole thing and handed over the full deposit", and that is one
 * click with both figures shown on it. The fields underneath exist for the
 * cases that are not — a part payment, a part deposit against a regular — and
 * they are behind a disclosure so the common case stays one click.
 */
export default function RentalCounterPayment({
  bookingId,
  balance,
  depositAmount,
  depositState,
  depositMethod,
}: {
  bookingId: string
  /** Rent still outstanding, in paise. */
  balance: number
  depositAmount: number
  depositState: string
  depositMethod: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [rent, setRent] = useState('')
  const [deposit, setDeposit] = useState('')

  // A gateway deposit is not ours to declare held — `verifyDepositPayment` owns
  // that column and the CHECK in migration 100 enforces it. So the deposit half
  // of this control is only offered where cash is actually changing hands.
  const cashDeposit = depositMethod !== 'gateway' && depositState === 'pending' && depositAmount > 0
  const takes = balance > 0 ? balance : 0

  function record(rentPaise?: number, depositPaise?: number) {
    start(async () => {
      const res = await recordCounterPayment({
        bookingId,
        ...(rentPaise !== undefined ? { rentPaid: rentPaise } : {}),
        ...(depositPaise !== undefined ? { depositTaken: depositPaise } : {}),
      })
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Recorded — the receipt and invoice are on their way.')
      setOpen(false); setRent(''); setDeposit('')
      router.refresh()
    })
  }

  // Nothing left to take. Said plainly rather than rendering a dead button.
  if (takes === 0 && !cashDeposit) return null

  const rupeesToPaise = (v: string) => Math.max(0, Math.round((Number(v) || 0) * 100))

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => record(takes || undefined, cashDeposit ? depositAmount : undefined)}
          className="inline-flex items-center gap-1.5 rounded-md border border-forest bg-forest px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:bg-forest/60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BanknoteArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
          {/* Both figures on the control, because the operator is about to
              count them out of somebody's hand. */}
          Take {formatPrice(takes)}
          {cashDeposit && ` + ${formatPrice(depositAmount)} deposit`}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-mid underline underline-offset-4 hover:text-forest"
        >
          {open ? 'Never mind' : 'A different amount'}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-rule bg-paper-deep/50 p-3">
          <label className="text-xs text-mid">
            <span className="block">Rent taken (₹)</span>
            <input
              type="number" min={0} step="0.01" value={rent}
              onChange={(e) => setRent(e.target.value)}
              placeholder={(takes / 100).toFixed(2)}
              className="mt-1 w-28 rounded-md border border-rule bg-surface px-2 py-1.5 font-mono text-sm text-ink"
            />
          </label>
          {cashDeposit && (
            <label className="text-xs text-mid">
              <span className="block">Deposit taken (₹)</span>
              <input
                type="number" min={0} step="0.01" value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder={(depositAmount / 100).toFixed(2)}
                className="mt-1 w-28 rounded-md border border-rule bg-surface px-2 py-1.5 font-mono text-sm text-ink"
              />
            </label>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => record(
              rent === '' ? takes : rupeesToPaise(rent),
              cashDeposit ? (deposit === '' ? depositAmount : rupeesToPaise(deposit)) : undefined,
            )}
            className="rounded-md border border-forest px-3 py-1.5 text-xs text-forest hover:bg-forest hover:text-paper"
          >
            Record it
          </button>
          <p className="w-full text-[11px] leading-relaxed text-mid">
            The balance outstanding is {formatPrice(takes)}. Anything more than that is refused —
            a rental cannot be overpaid into the books.
          </p>
        </div>
      )}
    </div>
  )
}
