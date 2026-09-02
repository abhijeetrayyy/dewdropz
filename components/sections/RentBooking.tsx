'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Loader2, ShieldCheck, Truck, Store } from 'lucide-react'
import AvailabilityCalendar from '@/components/rent/AvailabilityCalendar'
import { toast } from 'sonner'
import { shopToday } from '@/lib/shopTime'
import { getRentalAvailability, quoteRental, createRentalBooking } from '@/actions/rentals'
import { startRentalPayment, verifyRentalPayment } from '@/actions/rentalPayments'
import { useRazorpay } from '@/hooks/useRazorpay'
import { RENTAL_POLICY, fullRefundDeadline } from '@/lib/rentalPolicy'
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
 *
 * PAYING IS HOW YOU RESERVE, and the whole panel is arranged around that.
 *
 * The customer is told three things before the button, in this order, because
 * it is the order they need them in: what they are paying NOW, what they are
 * paying LATER (the deposit, at the counter or before we post it), and what
 * happens if they change their mind. That last one is not fine print — a person
 * about to send money to a shop they have not visited is deciding whether the
 * shop is trustworthy, and a cancellation policy stated plainly, with a real
 * date on it, is the cheapest trust the page can buy.
 *
 * WHAT HAPPENS IF THE PAYMENT SHEET IS DISMISSED. The booking exists as a HOLD
 * with a deadline, so the gear is genuinely set aside — and the panel says so,
 * counts down, and offers to reopen the sheet. Silently discarding it would
 * mean somebody who fumbled a one-time password has to re-pick their dates and
 * race for the same tent they were already holding.
 */
export default function RentBooking({
  item,
  initialFrom = '',
  initialTo = '',
}: {
  item: RentalItem
  /** Carried from the locker's date bar, so a visitor who has already said when
   *  they are going does not say it a second time on every item they open. */
  initialFrom?: string
  initialTo?: string
}) {
  const router = useRouter()

  // The SHOP's today. This was `toISOString().slice(0,10)`, i.e. UTC, so between
  // midnight and 05:30 IST the date inputs offered yesterday as bookable — the
  // exact bug `mobile/lib/rent/dates.test.ts` was written to guard, on the
  // storefront that never got the fix.
  const today = shopToday()
  // Seeded from the URL, and floored at the shop's today: a link shared last
  // week must not open with dates that have since gone past.
  const [startsOn, setStartsOn] = useState(initialFrom >= today ? initialFrom : '')
  const [endsOn, setEndsOn] = useState(initialFrom >= today ? initialTo : '')
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
  // A hold that exists and is not paid for yet: the payment sheet was dismissed,
  // the bank timed out, or the card was declined. The gear is still set aside
  // until `expiresAt`, so the panel offers to finish rather than starting over.
  const [held, setHeld] = useState<{ id: string; number: string; expiresAt: string } | null>(null)
  // A ticking clock, not a ticking counter. The seconds remaining are DERIVED
  // from the server's deadline and this value, so there is one source of truth
  // and no second countdown to fall out of step with it — and the only setState
  // is inside an interval callback, which is what an effect is actually for.
  const [now, setNow] = useState(() => Date.now())
  const razorpayReady = useRazorpay()

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

  // ── The countdown on a live hold ──────────────────────────────────────────
  // Driven off the deadline the SERVER returned, not off a duration this
  // component assumed, so the number on screen and the deadline the sweep
  // enforces are the same fact.
  useEffect(() => {
    if (!held) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [held])

  const secondsLeft = held ? Math.max(0, Math.round((Date.parse(held.expiresAt) - now) / 1000)) : null
  // Once the deadline passes the gear really has gone back on the shelf, so the
  // panel stops offering to finish paying for something nobody is holding.
  const liveHold = held && secondsLeft !== null && secondsLeft > 0 ? held : null

  /** Open the gateway for a hold that already exists. Shared by the first
   *  attempt and every retry, so there is one payment path rather than two. */
  const openGateway = useCallback(
    async (bookingId: string, bookingNumber: string) => {
      const started = await startRentalPayment(bookingId)
      if (!started.ok) { toast.error(started.error); return }

      if (typeof window.Razorpay !== 'function') {
        toast.error('The payment window could not load. Check your connection and try again.')
        return
      }

      const rzp = new window.Razorpay({
        key: started.keyId,
        order_id: started.gatewayOrderId,
        amount: started.amount,
        currency: 'INR',
        name: 'DEWDROPZ',
        description: `Rental ${bookingNumber}`,
        prefill: { email: email.trim(), contact: phone.trim() || undefined },
        handler: async (r) => {
          const done = await verifyRentalPayment({
            bookingId,
            gatewayOrderId: r.razorpay_order_id,
            gatewayPaymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          })
          if (!done.ok) { toast.error(done.error); return }
          toast.success(`Reserved — ${bookingNumber}`)
          router.push(`/rent/booked/${bookingNumber}`)
        },
        modal: {
          // Dismissing the sheet is not an error and must not read like one.
          // The gear IS held; they simply have not finished.
          ondismiss: () => {
            toast('Your gear is still held while you decide.', { icon: '⏳' })
          },
        },
      })
      rzp.open()
    },
    [email, phone, router],
  )

  const payAndReserve = useCallback(async () => {
    if (!datesChosen || !price) return
    if (!email.trim()) { toast.error('We need an email to send the booking to.'); return }
    if (fulfilment === 'ship' && (!addr.line1 || !addr.city || !addr.state || !addr.postal_code)) {
      toast.error('Fill in the delivery address, or choose collection instead.')
      return
    }
    setBooking(true)
    try {
      // An existing hold is paid for again rather than duplicated. Without this,
      // a dismissed sheet followed by a second click would create a SECOND hold
      // on a second unit — and on an item with two tents left, one customer
      // would silently take both.
      if (liveHold) { await openGateway(liveHold.id, liveHold.number); return }

      const res = await createRentalBooking({
        lines: [{ slug: item.slug, startsOn, endsOn, quantity }],
        fulfilment,
        email: email.trim(),
        phone: phone.trim() || undefined,
        address: fulfilment === 'ship' ? { ...addr, country: 'India' } : null,
        couponCode: coupon,
      })
      if (!res.ok) { toast.error(res.error); return }
      setHeld({ id: res.bookingId, number: res.bookingNumber, expiresAt: res.holdExpiresAt })
      await openGateway(res.bookingId, res.bookingNumber)
    } finally {
      setBooking(false)
    }
  }, [
    datesChosen, price, email, phone, addr, fulfilment, item.slug,
    startsOn, endsOn, quantity, coupon, liveHold, openGateway,
  ])

  // The date the top band actually expires on, so the panel can say "cancel
  // free until the 13th" instead of making somebody do arithmetic on "a week or
  // more before it starts" while holding a card.
  const refundDeadline = startsOn ? fullRefundDeadline(startsOn, today) : null

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

      {/* The calendar, not two blind date fields. It shows which days this
          particular item is on the shelf — buffer included — so picking is
          reading rather than guessing and being refused. It narrows the choice;
          the sentence below still comes from the range check, for the reason
          the calendar's own header sets out. */}
      <div className="mt-4">
        <AvailabilityCalendar
          itemId={item.id}
          from={startsOn}
          to={endsOn}
          onChange={(f, t) => { setStartsOn(f); setEndsOn(t) }}
          minDays={item.min_days}
          maxDays={item.max_days}
        />
      </div>

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
          {/* ── WHAT IS DUE, WHERE, AND WHEN ────────────────────────────────
              This block used to end with a single strong line reading "At the
              counter — ₹11,124", which was the rent AND the deposit summed
              together because both were handed over at handover. Under
              pay-to-reserve that figure is due in two places at two times, and
              a total that names neither is the most expensive kind of wrong: a
              customer reads ₹11,124, expects to pay it later, and is charged
              ₹2,124 now instead.
              So the two are separated and each says when. Nothing is summed
              across the boundary, because nothing is paid across it. */}
          <div className="!mt-3 border-t border-rule pt-3">
            <Row k="Pay now to reserve" v={formatPrice(price.totalAmount)} strong />
          </div>
          {price.depositAmount > 0 && (
            <Row
              k={fulfilment === 'ship' ? 'Deposit, before we post it' : 'Deposit, at the counter'}
              v={formatPrice(price.depositAmount)}
              tone="mid"
            />
          )}
          {price.depositAmount > 0 && (
            <p className="!mt-1.5 font-body text-[11.5px] leading-relaxed text-mid">
              Refundable, and not part of what you pay today.
            </p>
          )}

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

      {/* ── What happens if you change your mind ─────────────────────────────
          ABOVE the button, not below it and not on another page. A person
          about to send money to a shop they have never visited is deciding
          whether the shop is trustworthy; a cancellation policy with a real
          date on it is the cheapest trust this page can buy — and burying it
          would make the one generous thing about the policy invisible at
          exactly the moment it is worth something. */}
      {datesChosen && price && (
        <div className="mt-5 flex gap-2.5 rounded-[var(--r-panel)] border border-forest/15 bg-forest/[0.05] p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden="true" />
          <div className="font-body text-[12.5px] leading-relaxed text-forest">
            <p className="font-medium">
              {refundDeadline
                ? `Cancel free until ${prettyDay(refundDeadline)}.`
                : `Cancel free ${RENTAL_POLICY.cancellation.graceLabel}.`}
            </p>
            <p className="mt-0.5 text-mid">
              After that you get {RENTAL_POLICY.cancellation.bands[1].short} back up to three days
              before, and never less than {RENTAL_POLICY.cancellation.bands.at(-1)!.short} — and
              the deposit always comes back in full.{' '}
              <Link href="/rent/terms" className="underline underline-offset-4 hover:text-forest">
                The terms
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* A hold that has not been paid for. The gear IS set aside, so this says
          so and counts down against the deadline the server set. */}
      {liveHold && secondsLeft !== null && (
        <p role="status" className="mt-4 rounded-[var(--r-panel)] border border-clay-deep/25 bg-clay-deep/[0.06] px-3.5 py-3 font-body text-[12.5px] leading-relaxed text-clay-deep">
          <strong className="font-medium">{liveHold.number} is held for you.</strong>{' '}
          Finish paying within {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} or
          it goes back on the shelf. Nothing has been charged.
        </p>
      )}

      <button
        type="button" onClick={payAndReserve} disabled={!canBook || booking || !razorpayReady}
        /* `disabled:opacity-40` put the label at 1.33:1 — and because the button
           is disabled while `checking` is true, it strobed to illegible on every
           re-quote AND dropped out of the tab order mid-flow. Keep the label at
           full contrast and drop the FILL instead: --paper on --forest/60 still
           measures about 4.9:1, and the control plainly reads as unavailable. */
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 font-body text-sm font-medium text-paper transition-colors hover:bg-forest-mid disabled:cursor-not-allowed disabled:bg-forest/60"
      >
        {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {/* The figure is ON the button. "Reserve this gear" was honest when
            nothing was charged; under pay-to-reserve a button that does not say
            what it costs is a button that takes money by surprise. */}
        {booking
          ? 'Setting it aside…'
          : held
            ? `Finish paying ${price ? formatPrice(price.totalAmount) : ''}`
            : price
              ? `Pay ${formatPrice(price.totalAmount)} and reserve`
              : 'Pick your dates'}
      </button>

      <p className="mt-3 font-body text-[12px] leading-relaxed text-mid">
        {/* The two payments, in the order they happen, and never merged. The old
            copy — "nothing is charged now" — is the exact sentence that stops
            being true the moment a reservation requires payment, and it appeared
            on three surfaces at once. */}
        You pay the rental now; that is what reserves the gear.{' '}
        {price && price.depositAmount > 0 && (
          fulfilment === 'ship'
            ? <>The refundable {formatPrice(price.depositAmount)} deposit is taken separately before we post it, and comes back when the gear does.</>
            : <>The refundable {formatPrice(price.depositAmount)} deposit is handed over at the counter when you collect, and comes back when the gear does.</>
        )}{' '}
        <Link href="/rent/terms" className="text-forest underline underline-offset-4">The terms</Link>.
      </p>
    </div>
  )
}

/** Read at UTC, like every other plain day in this system — a deadline that
 *  disagrees with the one the server enforces is worse than no deadline. */
function prettyDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  })
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
