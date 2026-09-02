import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Clock, ShieldCheck, ReceiptText, CalendarX, CreditCard } from 'lucide-react'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import { getRentalItems } from '@/actions/rentals'
import { SITE } from '@/lib/constants'
import { RENTAL_POLICY } from '@/lib/rentalPolicy'
import { formatPrice } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Renting: the terms — DEWDROPZ',
  description:
    'What the deposit is for, what a late return costs, how damage is assessed, and where to collect gear in Dehradun.',
}

/**
 * The rules of renting, in one place.
 *
 * These existed only as sentences scattered across a booking form and a
 * confirmation screen — for a transaction where a customer hands over a
 * refundable deposit of up to ₹15,000 and collects gear in person. "What
 * happens if I'm late" and "where do I actually go" had no page to live on.
 *
 * The figures are read from the live catalogue rather than typed, so this page
 * cannot quietly disagree with what the booking form charges.
 */
export default async function RentalTermsPage() {
  const items = await getRentalItems()
  const maxDeposit = items.length ? Math.max(...items.map((i) => i.deposit)) : 0
  const buffers = [...new Set(items.map((i) => i.buffer_days))].sort((a, b) => a - b)
  const gstRate = items[0]?.gst_rate ?? 18
  const sac = items.find((i) => i.sac_code)?.sac_code

  return (
    <>
      <NavBar />
      <main id="main" className="bg-paper">
        <div className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:pt-32">
          <Link href="/rent" className="font-mono text-[11px] uppercase tracking-[0.14em] text-mid hover:text-forest">
            ← The gear locker
          </Link>

          <h1 className="mt-6 font-display text-4xl leading-tight text-ink sm:text-5xl">
            Renting, in plain terms.
          </h1>
          <p className="mt-4 max-w-prose font-body text-mid">
            Nothing here is buried. The deposit is the part people ask about most, so it is first.
          </p>

          {/* ── Deposit ───────────────────────────────────────────────────── */}
          {/* ── How paying works ───────────────────────────────────────────
              FIRST, above even the deposit, because it is the thing that
              changed and the thing a returning customer will get wrong. This
              page previously contained no explanation of payment at all — it
              was written for a shop where the rent was settled at a counter,
              and it went on saying nothing while the storefront began taking
              money to hold gear.

              The two payments are described separately and in the order they
              happen, for the same reason `actions/rentalPayments.ts` keeps them
              as two gateway orders: one is consideration for a supply and the
              other is the customer's own money held. Blurring them is how a
              refundable deposit starts looking like a charge. */}
          <section className="mt-12 rounded-[var(--r-panel)] border border-rule bg-surface p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-forest" aria-hidden="true" />
              <h2 className="font-display text-xl text-ink">Paying is what reserves it</h2>
            </div>
            <p className="mt-3 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              Gear is held when the rental is paid, not when the form is submitted. There is one
              of each thing in the locker and a booking that costs nothing to make is a booking
              that costs nothing to abandon — which, on a Friday in October, means somebody who
              actually wanted the tent could not have it.
            </p>
            <p className="mt-3 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              While you are paying, the gear is set aside for you for{' '}
              <strong className="text-ink">{RENTAL_POLICY.payment.holdLabel}</strong>. If the
              payment does not go through in that time it simply goes back on the shelf and
              nothing is charged — you are welcome to start again.
            </p>
            <dl className="mt-5 grid gap-4 border-t border-rule pt-4 font-body text-[15px] sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">You pay now</dt>
                <dd className="mt-1 leading-relaxed text-ink">
                  The rental, any delivery, and GST. This is the payment that holds the gear.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">You pay later</dt>
                <dd className="mt-1 leading-relaxed text-ink">
                  The refundable deposit — at the counter when you collect, or before we post it
                  if it is coming to you. It is never taken twice and it always comes back.
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-12 rounded-[var(--r-panel)] border border-forest/15 bg-forest/[0.06] p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest">
                <ShieldCheck className="h-4 w-4 text-paper" aria-hidden="true" />
              </span>
              <h2 className="font-display text-2xl text-ink">The deposit is not a charge</h2>
            </div>
            <ul className="mt-4 space-y-3 font-body text-[15px] leading-relaxed text-mid">
              <li><strong className="text-ink">It is held, not taken.</strong> You hand it over at the counter when you collect — or pay it separately if the gear is coming to you — and it comes back when the gear does.</li>
              <li><strong className="text-ink">It is not taxed.</strong> GST applies to the rental and any delivery, never to the deposit — it is refundable money, not payment for anything.</li>
              <li><strong className="text-ink">Every deduction is itemised.</strong> If something is owed for a late return or damage, you are told what and why, and the rest is returned.</li>
              {maxDeposit > 0 && (
                <li><strong className="text-ink">It varies by item</strong>, up to {formatPrice(maxDeposit)} for the largest kit. The exact figure is shown before you book.</li>
              )}
            </ul>
          </section>

          {/* ── Late, damage, tax ─────────────────────────────────────────── */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <section className="rounded-[var(--r-panel)] border border-rule bg-surface p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-clay" aria-hidden="true" />
                <h2 className="font-display text-xl text-ink">If you are late</h2>
              </div>
              <p className="mt-3 font-body text-[15px] leading-relaxed text-mid">
                A late return is charged at the same daily rate as the rental, for each day past the
                end date — and it is <strong className="text-ink">capped at the deposit</strong>. We
                will never invoice you for more than we are already holding.
              </p>
              <p className="mt-3 font-body text-[15px] leading-relaxed text-mid">
                Bring it back early and the unused days go straight back on the shelf for somebody
                else; the rental itself is priced on the dates you booked.
              </p>
            </section>

            <section className="rounded-[var(--r-panel)] border border-rule bg-surface p-6">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-clay" aria-hidden="true" />
                <h2 className="font-display text-xl text-ink">Damage, wear and tax</h2>
              </div>
              <p className="mt-3 font-body text-[15px] leading-relaxed text-mid">
                Gear comes back scuffed; that is what it is for. Wear is expected and never charged.
                Damage that stops a piece going out again is assessed when it is checked in, deducted
                from the deposit, and itemised.
              </p>
              <p className="mt-3 font-body text-[15px] leading-relaxed text-mid">
                Renting is a supply of service, so it carries GST at {gstRate}%
                {sac ? <> under SAC {sac}</> : null} — charged on the rental and any delivery.
              </p>
            </section>
          </div>

          {/* ── Turnaround ────────────────────────────────────────────────── */}
          {buffers.some((b) => b > 0) && (
            <section className="mt-8 rounded-[var(--r-panel)] border border-rule bg-paper-deep/40 p-6">
              <h2 className="font-display text-xl text-ink">Why a tent is not free the day after it comes back</h2>
              <p className="mt-3 max-w-prose font-body text-[15px] leading-relaxed text-mid">
                Every piece rests between rentals so it can be dried, checked and re-lofted — wet
                canvas is the reason this exists. Depending on the item that is{' '}
                {buffers.filter((b) => b > 0).join(' or ')} day
                {buffers.filter((b) => b > 0).some((b) => b > 1) ? 's' : ''}. We hold that rest
                period against the item when you book, so a range we accept is a range you can
                have.
              </p>
            </section>
          )}

          {/* ── Cancelling ────────────────────────────────────────────────
              Rendered from `RENTAL_POLICY`, which is the same object
              `cancellationRefund` uses to decide what actually goes back. The
              page and the refund cannot drift apart, which is the failure mode
              this shop has already had once: TRUST_POINTS printed a shipping
              promise beside the live setting that governed it, and they agreed
              only by coincidence. */}
          <section className="mt-8 rounded-[var(--r-panel)] border border-rule bg-surface p-6">
            <div className="flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-clay" aria-hidden="true" />
              <h2 className="font-display text-xl text-ink">If you change your mind</h2>
            </div>
            <p className="mt-3 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              You can cancel a booking yourself, from your rentals, right up until the gear leaves
              the shop — and the exact figure is shown to you before you confirm, never after.
            </p>

            {/* The generous rules FIRST. A policy that opens with its penalties
                reads as a penalty policy; these two cover most cancellations
                this shop will ever see, and burying them under the bands would
                hide the only part worth advertising. */}
            <div className="mt-4 rounded-[var(--r-panel)] border border-forest/20 bg-forest/[0.05] p-4">
              <p className="font-body text-[15px] leading-relaxed text-forest">
                <strong>Change your mind {RENTAL_POLICY.cancellation.graceLabel} and everything
                comes back</strong>, however close the dates. And if <strong>we</strong> cancel —
                a tent comes back damaged, anything at all on our side — you get every rupee back,
                whatever the notice.
              </p>
            </div>

            <p className="mt-4 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              After that first day, what comes back depends on how much notice we have. The gear is
              set aside for you from the moment you pay, so the closer to the start, the smaller the
              chance we can let it to somebody else:
            </p>
            <ul className="mt-4 space-y-2 font-body text-[15px] leading-relaxed text-mid">
              {RENTAL_POLICY.cancellation.bands.map((band) => (
                <li key={band.daysBefore} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-forest" />
                  <span>{band.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              <strong className="text-ink">We never keep all of it.</strong> Even a cancellation on
              the day returns {RENTAL_POLICY.cancellation.bands.at(-1)!.short} of the rent.
            </p>
            <p className="mt-3 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              <strong className="text-ink">The deposit always comes back in full.</strong> It is
              your money held against the gear, not payment for anything — so a cancellation
              returns every rupee of it, whatever the notice.
            </p>
            <p className="mt-3 max-w-prose font-body text-[15px] leading-relaxed text-mid">
              Refunds go back to whatever you paid from, and usually land within five to seven
              working days.
            </p>
          </section>

          {/* ── Where ─────────────────────────────────────────────────────── */}
          <section className="mt-8 rounded-[var(--r-panel)] border border-rule bg-surface p-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-forest" aria-hidden="true" />
              <h2 className="font-display text-xl text-ink">Collecting and returning</h2>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 font-body text-[15px]">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">The shop</dt>
                <dd className="mt-1 text-ink">{SITE.address}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Bring with you</dt>
                <dd className="mt-1 text-ink">Your booking number and some photo ID.</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Posted rentals</dt>
                <dd className="mt-1 text-ink">Delivery is charged both ways. The return label is in the box.</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Questions</dt>
                <dd className="mt-1 text-ink">
                  <a href={`mailto:${SITE.email}`} className="text-forest underline underline-offset-4">{SITE.email}</a>
                  {' · '}
                  <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="text-forest underline underline-offset-4">{SITE.phone}</a>
                </dd>
              </div>
            </dl>
          </section>

          <p className="mt-10 border-t border-rule pt-6 font-body text-[14px] text-mid">
            Booked already?{' '}
            <Link href="/rent/lookup" className="text-forest underline underline-offset-4">Find your booking</Link>
            {' '}or see{' '}
            <Link href="/account/rentals" className="text-forest underline underline-offset-4">your rentals</Link>.
          </p>
        </div>
      </main>
      <FooterSection />
    </>
  )
}
