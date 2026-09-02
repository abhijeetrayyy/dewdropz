import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import RentLocker from '@/components/rent/RentLocker'
import { getRentalItems, getRentalCategories, getRentalItemsAvailability } from '@/actions/rentals'
import type { RentalItemListed } from '@/lib/rental-filter'
import type { RentalCategory } from '@/types/database'

export const metadata: Metadata = {
  title: 'Rent gear — DEWDROPZ',
  description:
    'Tents, bags, packs and poles for rent in Dehradun. Pick your dates and see what is actually free — field-checked between every trip, collected from the shop or posted to you.',
}

/**
 * The gear locker.
 *
 * THE MASTHEAD AND THE COPY ARE SERVER-RENDERED, AND THAT IS WHY THEY ARE IN
 * THIS FILE rather than inside `RentLocker`. That component calls
 * `useSearchParams()`, so everything inside its Suspense boundary is replaced by
 * the fallback in the built HTML — `app/shop/page.tsx` documents the same
 * constraint at length after the shop shipped a page whose entire body was a
 * bailout template. Anything a search engine or a reader-mode has to see lives
 * above the boundary.
 *
 * The availability lookup is done HERE, on the server, for two reasons. It is
 * one round trip for the whole grid rather than one per card. And it is the
 * database's answer rather than the browser's — the rule the rental system is
 * built on is that the shelf shown and the shelf booked against are one opinion.
 */
export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const [items, categories] = await Promise.all([getRentalItems(), getRentalCategories()])

  // Only when both dates are present. `getRentalItemsAvailability` validates
  // them again and returns {} for anything malformed, so a hand-edited URL
  // yields "no availability known" rather than a failed page.
  const availability =
    sp.from && sp.to ? await getRentalItemsAvailability(sp.from, sp.to) : {}

  return (
    <>
      <NavBar />
      <main id="main" className="bg-paper">
        <section className="mx-auto max-w-6xl px-6 pb-8 pt-28 sm:pt-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-forest">The gear locker</p>
          <h1 className="mt-3 max-w-[18ch] font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            Borrow the heavy things.
          </h1>
          <p className="mt-4 max-w-prose font-body text-mid">
            A four-season tent is worth carrying and not worth owning if you use it twice a year.
            Everything here is checked, dried and re-lofted between trips. Tell us when you are
            going and the locker will show you what is free — then collect it in Dehradun on your
            way up, or have it posted.
          </p>
        </section>

        {items.length === 0 ? (
          <section className="mx-auto max-w-6xl px-6 pb-24">
            <p className="font-body text-mid">Nothing is available to rent just now.</p>
          </section>
        ) : (
          // The fallback holds the page's height so the masthead does not jump
          // when the grid arrives.
          <Suspense fallback={<div className="min-h-[60vh]" />}>
            <RentLocker
              items={items as RentalItemListed[]}
              categories={categories as RentalCategory[]}
              availability={availability}
            />
          </Suspense>
        )}

        {/* ── How it actually works ───────────────────────────────────────────
            Renting is an unfamiliar transaction on a shop that otherwise sells
            things outright: people want to know what they pay, when, and what
            happens to the deposit BEFORE they pick dates. Answering it here
            costs one band and removes the main reason to abandon the page. */}
        <section className="border-t border-rule bg-paper-deep/40">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-forest">How it works</p>
            <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Pick your dates', 'Both days count. The locker shows what is free before you commit to anything.'],
                ['Collect or have it posted', 'Pick it up in Dehradun on your way up, or we post it to arrive on day one.'],
                ['Pay when you get it', 'The rental and a refundable deposit, together, at the counter. Nothing is charged online.'],
                ['Bring it back', 'The deposit returns once it is checked. A late return is charged at the day rate, capped at the deposit.'],
              ].map(([title, body], i) => (
                <li key={title}>
                  <span className="font-mono text-[11px] text-forest">{String(i + 1).padStart(2, '0')}</span>
                  <h2 className="mt-2 font-display text-lg text-ink">{title}</h2>
                  <p className="mt-1 font-body text-[13px] leading-relaxed text-mid">{body}</p>
                </li>
              ))}
            </ol>

            <p className="mt-10 border-t border-rule pt-6 font-body text-[14px] text-mid">
              The deposit, late returns and where to collect are all set out in{' '}
              <Link href="/rent/terms" className="text-forest underline underline-offset-4">
                the rental terms
              </Link>.
            </p>
            <p className="mt-3 font-body text-[14px] text-mid">
              Booked without an account?{' '}
              <Link href="/rent/lookup" className="text-forest underline underline-offset-4">
                Find your booking
              </Link>{' '}
              with its number and the email you used.
            </p>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  )
}
