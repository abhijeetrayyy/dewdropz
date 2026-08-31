import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import { getRentalItems } from '@/actions/rentals'
import { Camera } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Rent gear — DEWDROPZ',
  description:
    'Tents, bags, packs and poles for rent in Dehradun. Field-checked between every trip, collected from the shop or posted to you.',
}

export default async function RentPage() {
  const items = await getRentalItems()

  return (
    <>
      <NavBar />
      <main id="main" className="bg-paper">
        <section className="mx-auto max-w-6xl px-6 pb-6 pt-28 sm:pt-32">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-forest">The gear locker</p>
          <h1 className="mt-3 max-w-[18ch] font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            Borrow the heavy things.
          </h1>
          <p className="mt-4 max-w-prose font-body text-mid">
            A four-season tent is worth carrying and not worth owning if you use it twice a year.
            Everything here is checked, dried and re-lofted between trips. Collect it in Dehradun on
            your way up, or have it posted.
          </p>
        </section>

        {items.length === 0 ? (
          <section className="mx-auto max-w-6xl px-6 pb-24">
            <p className="font-body text-mid">Nothing is available to rent just now.</p>
          </section>
        ) : (
          <section className="mx-auto max-w-6xl px-6 pb-20">
            <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <li key={it.id}>
                  <Link href={`/rent/${it.slug}`} className="group block">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--r-card)] bg-paper-deep">
                      {it.images?.[0] ? (
                        <Image
                          src={it.images[0]}
                          alt={it.name}
                          fill
                          sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        // A gap in the photography, said plainly. Left as bare
                        // text it read as a broken image and punched a white
                        // hole through the grid; a ruled, tinted frame reads as
                        // a listing awaiting its photograph, which is what it is.
                        <div className="flex h-full flex-col items-center justify-center gap-2 border border-dashed border-rule bg-paper-deep/50">
                          <Camera className="h-5 w-5 text-mid/60" aria-hidden="true" />
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mid">
                            Photograph to come
                          </span>
                        </div>
                      )}

                      {/* The rate belongs ON the photograph. In a rental list
                          the per-day figure is the thing being compared, and
                          set below the fold of the card it lost every scan. */}
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink/75 to-transparent p-3 pt-10">
                        <span className="font-mono text-[15px] tabular-nums text-paper">
                          {formatPrice(it.daily_rate)}
                          <span className="text-[11px] text-paper/70"> / day</span>
                        </span>
                        <span className="rounded-full bg-paper/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper backdrop-blur-sm">
                          {it.allows_pickup && it.allows_shipping
                            ? 'Collect / post'
                            : it.allows_pickup
                              ? 'Collect'
                              : 'Posted'}
                        </span>
                      </div>
                    </div>

                    <h2 className="mt-3 font-display text-lg text-ink transition-colors group-hover:text-forest">
                      {it.name}
                    </h2>
                    {it.summary && (
                      <p className="mt-1 font-body text-[13px] leading-snug text-mid">{it.summary}</p>
                    )}
                    <p className="mt-2 font-mono text-[11px] text-mid">
                      {formatPrice(it.deposit)} deposit, refunded
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
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
                ['Pick your dates', 'Both days count. We show what is free before you commit to anything.'],
                ['Collect or have it posted', 'Pick it up in Dehradun on your way up, or we post it to arrive on day one.'],
                ['Pay when you get it', 'The rental and a refundable deposit, together, at the counter. Nothing is charged online.'],
                ['Bring it back', 'The deposit returns once it is checked. A late return is charged at the day rate, capped at the deposit.'],
              ].map(([title, body], i) => (
                <li key={title}>
                  <span className="font-mono text-[11px] text-forest">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-2 font-display text-lg text-ink">{title}</h3>
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
