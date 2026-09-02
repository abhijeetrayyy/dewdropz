'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { cancelMyRentalBooking, getMyCancellationQuote } from '@/actions/rentals'
import { formatPrice } from '@/lib/utils'

type Quote = NonNullable<Awaited<ReturnType<typeof getMyCancellationQuote>>>

/**
 * Calling off a booking, with the figure on screen before the button is pressed.
 *
 * WHAT THIS USED TO BE. A link, a confirm line reading "the dates go back on
 * the shelf", and a success toast congratulating the customer — with no mention
 * of money anywhere in the flow. That was survivable while nothing had been
 * charged. Under pay-to-reserve it is not: the person pressing this has paid,
 * the notice bands decide how much comes back, and finding that out from a bank
 * statement four days later is how a cancellation becomes a chargeback.
 *
 * SO THE QUOTE IS FETCHED BEFORE THE CONFIRMATION IS OFFERED, and it is the
 * SAME `cancellationQuote` the refund itself runs, on the same inputs. Not a
 * second implementation that agrees today — the number shown and the number
 * paid are one function call apart, which is the only version of this that
 * cannot drift.
 *
 * The retained amount is shown as its own line even when it is zero. A refund
 * figure presented alone reads as "this is what you get" and leaves the
 * customer to work out whether anything was kept; naming both, and naming the
 * rule that decided it, is the difference between a policy and a deduction.
 */
export default function CancelRentalButton({ bookingId, number }: { bookingId: string; number: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, start] = useTransition()

  function ask() {
    setAsking(true)
    // Fetched on open, never on render: a page listing six bookings must not
    // price six cancellations nobody asked about.
    if (!quote) start(async () => setQuote(await getMyCancellationQuote(bookingId)))
  }

  async function cancel() {
    setBusy(true)
    try {
      const res = await cancelMyRentalBooking(bookingId)
      if (!res.ok) { toast.error(res.error); return }
      toast.success(
        quote && quote.total > 0
          ? `${number} cancelled — ${formatPrice(quote.total)} is on its way back to you.`
          : `${number} cancelled.`,
      )
      setAsking(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={ask}
        className="font-body text-[13px] text-mid underline underline-offset-4 hover:text-clay-deep"
      >
        Cancel this booking
      </button>
    )
  }

  return (
    <div className="w-full rounded-[var(--r-panel)] border border-rule bg-paper-deep/40 p-4">
      <p className="font-body text-[14px] text-ink">Cancel {number}?</p>

      {loading || !quote ? (
        <p className="mt-2 flex items-center gap-2 font-body text-[13px] text-mid">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Working out what comes back…
        </p>
      ) : (
        <>
          <p className="mt-1 font-body text-[13px] leading-relaxed text-mid">{quote.summary}</p>

          <dl className="mt-3 space-y-1.5 border-t border-rule pt-3 font-body text-[13px]">
            {quote.rentRefund > 0 && (
              <Line k="Rental refunded" v={formatPrice(quote.rentRefund)} tone="good" />
            )}
            {/* Named, always, when there is one. The whole difference between a
                published policy and an unexplained deduction is whether the
                customer had to notice it themselves. */}
            {quote.rentRetained > 0 && (
              <Line k="Kept by the shop" v={`− ${formatPrice(quote.rentRetained)}`} tone="bad" />
            )}
            {quote.depositRefund > 0 && (
              <Line k="Deposit returned in full" v={formatPrice(quote.depositRefund)} tone="good" />
            )}
            <div className="!mt-2.5 border-t border-rule pt-2.5">
              <Line k="Coming back to you" v={formatPrice(quote.total)} strong />
            </div>
          </dl>

          {quote.rentRetained > 0 && (
            <p className="mt-2.5 font-body text-[12px] leading-relaxed text-mid">{quote.band.label}</p>
          )}
          <p className="mt-2 font-body text-[12px] leading-relaxed text-mid">
            Refunds go back to the card or account you paid from, and usually land within five to
            seven working days.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={cancel}
          disabled={busy || loading}
          className="inline-flex items-center gap-2 rounded-full bg-clay-deep px-4 py-2 font-body text-[13px] text-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {quote && quote.total > 0 ? `Cancel and refund ${formatPrice(quote.total)}` : 'Yes, cancel it'}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="font-body text-[13px] text-mid hover:text-ink"
        >
          Keep it
        </button>
      </div>
    </div>
  )
}

function Line({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-medium text-ink' : 'text-mid'}>{k}</dt>
      <dd
        className={`font-mono tabular-nums ${
          strong ? 'font-medium text-ink' : tone === 'bad' ? 'text-clay-deep' : tone === 'good' ? 'text-forest' : 'text-mid'
        }`}
      >
        {v}
      </dd>
    </div>
  )
}
