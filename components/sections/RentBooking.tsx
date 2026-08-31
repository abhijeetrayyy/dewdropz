'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, Truck, Store } from 'lucide-react'
import { toast } from 'sonner'
import { shopToday } from '@/lib/shopTime'
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
 * quoted a figure the shop did not charge. Days, GST, the long-rental discount
 * and return postage are all decided server-side.
 *
 * And it never decides whether something is available. The count comes from
 * `rental_available_units`, the same database function the booking write uses,
 * so the shelf shown here and the shelf booked against cannot disagree.
 */
export default function RentBooking({ item }: { item: RentalItem }) {
  const router = useRouter()

  // The SHOP's today. This was `toISOString().slice(0,10)`, i.e. UTC, so between
  // midnight and 05:30 IST the date inputs offered yesterday as bookable — the
  // exact bug `mobile/lib/rent/dates.test.ts` was written to guard, on the
  // storefront that never got the fix.
  const today = shopToday()
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
  // A rejected DISCOUNT CODE is not a broken quote. Sharing one state meant a
  // bad code emptied the breakdown — taking the coupon field and its own Remove
  // button with it — and disabled Reserve, with no way out but a page reload.
  const [couponError, setCouponError] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addr, setAddr] = useState({ line1: '', city: '', state: '', postal_code: '' })
  // Applied through the quote rather than held as a separate discount in the
  // browser: the code goes to the server, the server prices it, and the figure
  // shown is the figure charged. A discount computed here would be a second
  // pricer, which is the exact thing this component's header argues against.
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string | null>(null)

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
          couponCode: coupon,
        }),
      ])
      if (cancelled) return
      setAvailable(avail.available)
      if (quote.ok) {
        setPrice(quote.price)
        // `priceRental` pushes a coupon refusal into the same `errors` array as
        // a genuine pricing failure. Split them here: anything mentioning the
        // code is the code's problem, and the rest of the quote is still valid.
        const first = quote.price.errors[0] ?? null
        const isCoupon = !!first && /code/i.test(first)
        setCouponError(isCoupon ? first : null)
        setQuoteError(isCoupon ? null : first)
      } else {
        setPrice(null)
        setCouponError(null)
        setQuoteError(quote.error)
      }
      setChecking(false)
    })()
    return () => { cancelled = true }
    // `coupon` is in this list because the quote READS it (the body above sends
    // `couponCode`) and the server PRICES with it. Without it here, React Query's
    // effect never re-ran on Apply: every code reported "took nothing off this
    // rental" while `book()` — which does send it — charged the discounted
    // total. The price on the screen was not the price on the row.
    //
    // `price` is deliberately NOT in the list; it is what the effect produces.
  }, [item.id, item.slug, startsOn, endsOn, quantity, fulfilment, datesChosen, addr, coupon])

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
        couponCode: coupon,
      })
      if (!res.ok) { toast.error(res.error); return }
      toast.success(`Booked — ${res.bookingNumber}`)
      router.push(`/rent/booked/${res.bookingNumber}`)
    } finally {
      setBooking(false)
    }
  }, [datesChosen, price, email, phone, addr, fulfilment, item.slug, startsOn, endsOn, quantity, coupon, router])

  const short = available !== null && available < quantity
  // Note what is absent: `couponError`. A refused discount code leaves a
  // perfectly valid rental at full price, and blocking the booking over it was
  // the difference between "your code did not work" and "you cannot rent this".
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

      {/* THE REGION IS ALWAYS MOUNTED, and only its text changes.
          This used to sit inside `{datesChosen && …}`, so the element was
          inserted into the DOM already carrying its first message — and a live
          region that appears already populated is not reliably announced by any
          screen reader. The announcement a person most needs, the first
          "3 free for those dates" after choosing a range, was the one most
          likely to be silent. */}
      <p className="mt-4 font-body text-[13px]" aria-live="polite" aria-atomic="true">
        {!datesChosen ? null : (
          <>
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
            <span className="text-forest">{available} free for those dates.</span>
          )}
          </>
        )}
      </p>

      {quoteError && <p className="mt-2 font-body text-[13px] text-clay-deep">{quoteError}</p>}

      {/* `!quoteError` only — a coupon refusal must NOT unmount this block, which
          contains the coupon field and the Remove button that undoes it. */}
      {price && !quoteError && price.lines.length > 0 && (
        <dl className="mt-5 space-y-1.5 border-t border-rule pt-4 font-body text-sm">
          <Row k={`Rental · ${price.lines[0].days} days × ${quantity}`} v={formatPrice(price.rentAmount + price.discountAmount)} />
          {price.discountAmount > 0 && (
            <Row k="Long-rental discount" v={`− ${formatPrice(price.discountAmount)}`} tone="sage" />
          )}
          {price.couponDiscount > 0 && (
            <Row k={`Code ${price.couponCode}`} v={`− ${formatPrice(price.couponDiscount)}`} tone="sage" />
          )}
          {price.deliveryAmount > 0 && <Row k="Delivery, both ways" v={formatPrice(price.deliveryAmount)} />}
          <Row k={`GST ${price.lines[0].gstRate}%`} v={formatPrice(price.taxAmount)} />
          <Row k="Total to pay" v={formatPrice(price.totalAmount)} strong />
          <Row k="Refundable deposit" v={formatPrice(price.depositAmount)} tone="mid" />
          <div className="!mt-3 border-t border-rule pt-3">
            <Row k="At the counter" v={formatPrice(price.payableWithDeposit)} strong />
          </div>

          {/* The field lives inside the breakdown rather than above it, because
              a code is a modification of a price and belongs where the price is.
              It only appears once there is something to discount. */}
          <div className="!mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Discount code"
              aria-label="Discount code"
              className="min-w-0 flex-1 rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-mono text-xs uppercase tracking-[0.08em] text-ink placeholder:text-light"
            />
            <button
              type="button"
              onClick={() => setCoupon(couponInput.trim() || null)}
              className="rounded-[var(--r-input)] border border-forest px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-forest hover:bg-forest hover:text-paper"
            >
              {coupon ? 'Update' : 'Apply'}
            </button>
            {coupon && (
              <button
                type="button"
                onClick={() => { setCoupon(null); setCouponInput('') }}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-mid hover:text-clay-deep"
              >
                Remove
              </button>
            )}
          </div>
          {(couponError || (coupon && price.couponDiscount === 0)) && (
            <p role="status" className="!mt-2 font-body text-[13px] text-clay-deep">
              {couponError ?? 'That code took nothing off this rental.'}
            </p>
          )}
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
        /* `disabled:opacity-40` put the label at 1.33:1 — and because the button
           is disabled while `checking` is true, it strobed to illegible on every
           re-quote AND dropped out of the tab order mid-flow. Keep the label at
           full contrast and drop the FILL instead: --paper on --forest/60 still
           measures about 4.9:1, and the control plainly reads as unavailable. */
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 font-body text-sm font-medium text-paper transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:bg-forest/60"
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
          strong ? 'font-medium text-ink' : tone === 'sage' ? 'text-forest' : 'text-mid'
        }`}
      >
        {v}
      </dd>
    </div>
  )
}
