import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NavBar from '@/components/layout/NavBar'
import FooterSection from '@/components/layout/FooterSection'
import RentBooking from '@/components/sections/RentBooking'
import RentalGallery from '@/components/sections/RentalGallery'
import { getRentalItem } from '@/actions/rentals'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = await getRentalItem(slug)
  if (!item) return {}
  return { title: `Rent the ${item.name} — DEWDROPZ`, description: item.summary ?? undefined }
}

export default async function RentItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getRentalItem(slug)
  if (!item) notFound()

  return (
    <>
      <NavBar />
      <main id="main" className="bg-paper">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 sm:pt-32">
          <Link href="/rent" className="font-mono text-[11px] uppercase tracking-[0.14em] text-mid hover:text-forest">
            ← The gear locker
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div>
              <RentalGallery images={item.images ?? []} name={item.name} />

              <h1 className="mt-6 font-display text-3xl leading-tight text-ink sm:text-4xl">{item.name}</h1>
              <p className="mt-2 font-mono text-sm text-ink">
                {formatPrice(item.daily_rate)}<span className="text-mid"> / day</span>
              </p>
              {item.description && (
                <p className="mt-4 max-w-prose font-body text-mid">{item.description}</p>
              )}

              {/* The same gear, to own. A quiet alternative rather than a
                  competing button: somebody on this page has decided to rent,
                  and the job is to answer "could I just buy it?" without
                  derailing that. */}
              {item.product && (
                <Link
                  href={`/products/${item.product.slug}`}
                  className="mt-5 flex items-center gap-3 rounded-[var(--r-panel)] border border-forest/15 bg-forest/[0.06] p-4 transition-colors hover:bg-forest/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest">
                    <ShoppingBag className="h-4 w-4 text-paper" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-mid">Or own it</span>
                    <span className="mt-0.5 block font-body text-[15px] text-ink">
                      Buy it outright for {formatPrice(item.product.price)}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-forest" aria-hidden="true" />
                </Link>
              )}

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-5 font-body text-sm">
                <Spec k="Deposit" v={`${formatPrice(item.deposit)}, refunded`} />
                <Spec k="Rental period" v={`${item.min_days}–${item.max_days} days`} />
                <Spec k="Between rentals" v={item.buffer_days === 0 ? 'Same-day turnaround' : `${item.buffer_days} day${item.buffer_days === 1 ? '' : 's'} to clean and dry`} />
                <Spec k="GST" v={`${item.gst_rate}% on the rental${item.sac_code ? ` · SAC ${item.sac_code}` : ''}`} />
              </dl>

              <p className="mt-5 font-body text-[13px] leading-relaxed text-mid">
                The deposit is not a charge. It is held when you collect and returned when the gear
                comes back, less anything owed for a late return or damage — and every deduction is
                itemised.
              </p>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <RentBooking item={item} />
            </div>
          </div>
        </div>
      </main>
      <FooterSection />
    </>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  )
}
