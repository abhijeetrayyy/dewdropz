'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, Truck, Store } from 'lucide-react'
import { toast } from 'sonner'
import { getRentalAvailability, quoteRental, createRentalBooking } from '@/actions/rentals'
import type { RentalItem } from '@/types/database'
import type { RentalPrice } from '@/lib/rentalPricing'
import { formatPrice } from '@/lib/utils'

/**
 * Picking dates, seeing the real price, and booking.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO.
 *
 * It never computes a total. Every rupee on screen comes back from
 * `quoteRental`, which calls the same `priceRental` the booking write calls —
 * the rule `lib/checkoutPricing.ts` had to learn the hard way when the app
 * quoted a figure the shop did not charge. Days, GST, the long-hire discount
 * and return postage are all decided server-side.
 *
 * And it never decides whether something is available. The count comes from
 * `rental_available_units`, the same database function the booking write uses,
 * so the shelf shown here and the shelf booked against cannot disagree.
 */
export default function RentBooking({ item }: { item: RentalItem }) {
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [fulfilment, setFulfilment] = useState<'pickup' | 'ship'>(
    item.allows_pickup ? 'pickup' : 'ship',
  )

  const [available, setAvailable] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [price, setPrice] = useState<RentalPrice | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addr, setAddr] = useState({ line1: '', city: '', state: '', postal_code: '' })

  const datesChosen = Boolean(startsOn && endsOn && endsOn >= startsOn)

  // Availability and price, refreshed together whenever the terms change.
  useEffect(() => {
    if (!datesChosen) {
      // Syncing with an external system — the server's view of the shelf and
      // the price — when the terms change. That is what an effect is for, and
      // neither figure may be computed on the client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailable(null); setPrice(null); setQuoteError(null)
      return
    }
    let cancelled = false
    setChecking(true)
    ;(async () => {
      const [avail, quote] = await Promise.all([
        getRentalAvailability(item.id, startsOn, endsOn),
        quoteRental({
          lines: [{ slug: item.slug, startsOn, endsOn, quantity }],
          fulfilment,
          // A quote needs an email to satisfy the same schema the booking uses.
          // Nothing is written, and the figure does not depend on who is asking.
          email: 'quote@dewdropz.shop',
          address: fulfilment === 'ship' ? { ...addr } : null,
        }),
      ])
      if (cancelled) return
      setAvailable(avail.available)
      if (quote.ok) { setPrice(quote.price); setQuoteError(quote.price.errors[0] ?? null) }
      else { setPrice(null); setQuoteError(quote.error) }
      setChecking(false)
    })()
    return () => { cancelled = true }
  }, [item.id, item.slug, startsOn, endsOn, quantity, fulfilment, datesChosen, addr])

  const book = useCallback(async () => {
    if (!datesChosen || !price) return
    if (!email.trim()) { toast.error('We need an email to send the booking to.'); return }
    if (fulfilment === 'ship' && (!addr.line1 || !addr.city || !addr.state || !addr.postal_code)) {
      toast.error('Fill in the delivery address, or choose collection instead.')
      return
    }
    setBooking(true)
    try {
      const res = await createRentalBooking({
        lines: [{ slug: item.slug, startsOn, endsOn, quantity }],
        fulfilment,
        email: email.trim(),
        phone: phone.trim() || undefined,
        address: fulfilment === 'ship' ? { ...addr, country: 'India' } : null,
      })
      if (!res.ok) { toast.error(res.error); return }
      toast.success(`Booked — ${res.bookingNumber}`)
      router.push(`/rent/booked/${res.bookingNumber}`)
    } finally {
      setBooking(false)
    }
  }, [datesChosen, price, email, phone, addr, fulfilment, item.slug, startsOn, endsOn, quantity, router])

  const short = available !== null && available < quantity
  const canBook = datesChosen && !!price && !quoteError && !short && !checking

  return (
    <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-forest">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        Choose your dates
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">From</span>
          <input
            type="date" value={startsOn} min={today}
            onChange={(e) => setStartsOn(e.target.value)}
            className="mt-1 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Until</span>
          <input
            type="date" value={endsOn} min={startsOn || today}
            onChange={(e) => setEndsOn(e.target.value)}
            className="mt-1 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
          />
        </label>
      </div>
      <p className="mt-2 font-body text-[12px] text-mid">
        Both days count. Minimum {item.min_days} day{item.min_days === 1 ? '' : 's'}, maximum{' '}
        {item.max_days}.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">How many</span>
          <input
            type="number" min={1} max={10} value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-[var(--r-input)] border border-rule bg-surface px-2 py-1.5 text-center font-mono text-sm text-ink"
          />
        </label>

        {item.allows_pickup && item.allows_shipping && (
          <div className="flex gap-2" role="group" aria-label="How you want it">
            {([
              ['pickup', 'Collect', Store],
              ['ship', 'Post it', Truck],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value} type="button" onClick={() => setFulfilment(value)}
                aria-pressed={fulfilment === value}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-body text-[13px] transition-colors ${
                  fulfilment === value
                    ? 'border-forest bg-forest text-paper'
                    : 'border-rule text-mid hover:border-forest'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {datesChosen && (
        <p className="mt-4 font-body text-[13px]" aria-live="polite">
          {checking ? (
            <span className="inline-flex items-center gap-2 text-mid">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the locker…
            </span>
          ) : available === null ? null : short ? (
            <span className="text-clay-deep">
              {available === 0
                ? 'None free for those dates.'
                : `Only ${available} free for those dates.`}
            </span>
          ) : (
            <span className="text-sage">{available} free for those dates.</span>
          )}
        </p>
      )}

      {quoteError && <p className="mt-2 font-body text-[13px] text-clay-deep">{quoteError}</p>}

      {price && !quoteError && price.lines.length > 0 && (
        <dl className="mt-5 space-y-1.5 border-t border-rule pt-4 font-body text-sm">
          <Row k={`Rental · ${price.lines[0].days} days × ${quantity}`} v={formatPrice(price.rentAmount + price.discountAmount)} />
          {price.discountAmount > 0 && (
            <Row k="Long-rental discount" v={`− ${formatPrice(price.discountAmount)}`} tone="sage" />
          )}
          {price.deliveryAmount > 0 && <Row k="Delivery, both ways" v={formatPrice(price.deliveryAmount)} />}
          <Row k={`GST ${price.lines[0].gstRate}%`} v={formatPrice(price.taxAmount)} />
          <Row k="Total to pay" v={formatPrice(price.totalAmount)} strong />
          <Row k="Refundable deposit" v={formatPrice(price.depositAmount)} tone="mid" />
          <div className="!mt-3 border-t border-rule pt-3">
            <Row k="At the counter" v={formatPrice(price.payableWithDeposit)} strong />
          </div>
        </dl>
      )}

      <div className="mt-5 grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" aria-label="Email"
          className="rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
        />
        <input
          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)" aria-label="Phone"
          className="rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
        />
      </div>

      {fulfilment === 'ship' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([
            ['line1', 'Address'], ['city', 'City'], ['state', 'State'], ['postal_code', 'Pincode'],
          ] as const).map(([key, label]) => (
            <input
              key={key} value={addr[key]} onChange={(e) => setAddr((a) => ({ ...a, [key]: e.target.value }))}
              placeholder={label} aria-label={label}
              className="rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
            />
          ))}
        </div>
      )}

      <button
        type="button" onClick={book} disabled={!canBook || booking}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 font-body text-sm font-medium text-paper transition-colors hover:bg-forest-mid disabled:opacity-40"
      >
        {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {booking ? 'Holding it…' : 'Reserve this gear'}
      </button>

      <p className="mt-3 font-body text-[12px] leading-relaxed text-mid">
        Nothing is charged now. You pay the rental and hand over the deposit when you collect —
        the deposit comes back when the gear does, less anything owed for damage or a late return.{' '}
        <Link href="/rent/terms" className="text-forest underline underline-offset-4">The terms</Link>.
      </p>
    </div>
  )
}

function Row({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: 'sage' | 'mid' }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-medium text-ink' : 'text-mid'}>{k}</dt>
      <dd
        className={`font-mono tabular-nums ${
          strong ? 'font-medium text-ink' : tone === 'sage' ? 'text-sage' : 'text-mid'
        }`}
      >
        {v}
      </dd>
    </div>
  )
}
