'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, X } from 'lucide-react'
import { quoteRentalExtension, requestRentalExtension, verifyExtensionPayment } from '@/actions/rentalExtensions'
import { formatPrice } from '@/lib/utils'

/**
 * Keeping the gear a few more days, without ringing the shop.
 *
 * THE SHAPE OF THIS SCREEN IS THE POINT. It quotes and checks availability in
 * ONE call, because a price with no availability answer invites somebody to pay
 * for days they cannot have, and an availability answer with no price makes
 * them ask twice.
 *
 * And when the answer is no, it says WHY — "the tent is booked from Friday" —
 * because a refusal with no reason is exactly what makes somebody pick up the
 * phone, which is the thing this screen exists to prevent.
 */

type Props = {
  bookingId: string
  bookingNumber: string
  /** The date the rental currently runs to. */
  currentEnd: string
  onDone?: () => void
}

export default function ExtendRental({ bookingId, bookingNumber, currentEnd, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [newEnd, setNewEnd] = useState('')
  const [quote, setQuote] = useState<
    { days: number; total: number; blockedBy: string[] } | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [paying, setPaying] = useState(false)

  // The day after the current end is the first date that adds anything. Offering
  // the current end itself would let somebody submit a zero-day extension and
  // meet an error they could not have predicted.
  const min = new Date(Date.parse(`${currentEnd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

  function check(date: string) {
    setNewEnd(date)
    setQuote(null)
    setError(null)
    if (!date) return

    start(async () => {
      const res = await quoteRentalExtension({ bookingId, newEnd: date })
      if (!res.ok) { setError(res.error); return }
      setQuote({
        days: res.quote.daysAdded,
        total: res.quote.totalAmount,
        blockedBy: res.blockedBy,
      })
    })
  }

  async function submit() {
    if (!newEnd) return
    setPaying(true)
    try {
      const res = await requestRentalExtension({ bookingId, newEnd })
      if (!res.ok) { toast.error(res.error); return }

      // Nothing to pay, or the shop takes it at the counter — either way the
      // extension is recorded and there is no payment step to run.
      if (!res.gatewayOrderId || !res.keyId) {
        toast.success(
          res.amount > 0
            ? `Extension requested — ${formatPrice(res.amount)} to pay at the shop.`
            : 'Extended.',
        )
        onDone?.()
        setOpen(false)
        return
      }

      if (!window.Razorpay) {
        toast.error('The payment window could not load. Refresh and try again.')
        return
      }

      const rzp = new window.Razorpay({
        key: res.keyId,
        order_id: res.gatewayOrderId,
        amount: res.amount,
        currency: 'INR',
        name: 'DEWDROPZ',
        description: `Extra days on ${bookingNumber}`,
        handler: async (r) => {
          const done = await verifyExtensionPayment({
            extensionId: res.extensionId,
            gatewayOrderId: r.razorpay_order_id,
            gatewayPaymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          })
          if (!done.ok) { toast.error(done.error); return }
          toast.success(`Extended — now due back ${done.newEnd}.`)
          onDone?.()
          setOpen(false)
        },
        theme: { color: '#2E5C42' },
      })
      rzp.open()
    } finally {
      setPaying(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink shadow-[var(--shadow-card)] transition-colors hover:border-forest"
      >
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Keep it longer
      </button>
    )
  }

  const blocked = (quote?.blockedBy.length ?? 0) > 0

  return (
    <div className="rounded-[var(--r-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-sm uppercase tracking-[0.1em] text-ink">Keep it longer</h4>
          <p className="mt-1 font-body text-xs text-mid">
            Currently due back {new Date(`${currentEnd}T00:00:00Z`).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', timeZone: 'UTC',
            })}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-[var(--r-tag)] text-mid hover:bg-paper-warm hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">New return date</span>
        <input
          type="date"
          value={newEnd}
          min={min}
          onChange={(e) => check(e.target.value)}
          className="mt-1 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
        />
      </label>

      {pending && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-mid">Checking the calendar…</p>
      )}

      {error && <p className="mt-3 font-body text-[13px] text-clay-deep">{error}</p>}

      {quote && blocked && (
        <p className="mt-3 rounded-[var(--r-input)] border border-clay-deep/30 bg-clay-deep/5 p-3 font-body text-[13px] text-clay-deep">
          We can&rsquo;t hold {quote.blockedBy.join(', ')} that long — somebody else has it booked
          from just after your current end date. Try an earlier date, or bring it back on time and
          we&rsquo;ll sort out the next one.
        </p>
      )}

      {quote && !blocked && (
        <>
          <dl className="mt-4 space-y-1.5 border-t border-rule pt-3 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-mid">{quote.days} more day{quote.days === 1 ? '' : 's'}</dt>
              <dd className="tabular-nums text-ink">{formatPrice(quote.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 font-body text-xs text-light">
            Charged at the daily rate for the extra days only — the days you have already paid for
            are not re-priced. Your deposit stays exactly as it is.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={paying}
            className="mt-4 w-full rounded-[var(--r-input)] bg-forest px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-forest-deep disabled:opacity-50"
          >
            {paying ? 'One moment…' : `Extend for ${formatPrice(quote.total)}`}
          </button>
        </>
      )}
    </div>
  )
}
