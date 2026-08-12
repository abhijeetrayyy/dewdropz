import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import type { ResolvedRail } from '@/actions/showcase'

// Admin-defined product rows — "Just added", "Most ordered", or everything in
// one category/collection. Configured in /admin/settings, resolved live in
// actions/showcase.ts.
//
// Empty rails never reach this component (getShowcaseRails drops them), and
// with no rails at all the whole block renders nothing. That's deliberate: an
// almost-empty catalogue should show less, not show filler.
export default function ShowcaseRails({ rails }: { rails: ResolvedRail[] }) {
  if (rails.length === 0) return null

  return (
    <section className="bg-paper px-6 md:px-10 py-20 md:py-24">
      <div className="mx-auto max-w-7xl space-y-16">
        {rails.map((rail) => (
          <div key={rail.id}>
            <div className="mb-7 flex items-end justify-between gap-4 border-b border-forest/15 pb-4">
              <h2 className="font-display text-[clamp(24px,3.2vw,36px)] leading-tight text-text">{rail.title}</h2>
              <Link
                href="/shop"
                className="flex-shrink-0 font-body text-[11px] uppercase tracking-[0.14em] text-forest transition-colors hover:text-text"
              >
                See all →
              </Link>
            </div>

            {/* Horizontal scroll on phones, grid from sm up — a rail of 8 items
                would otherwise stack into an eight-screen column on mobile. */}
            <ul className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {rail.products.map((p) => (
                <li key={p.id} className="w-[42vw] flex-shrink-0 snap-start sm:w-auto">
                  <Link href={`/products/${p.slug}`} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-paper-deep">
                      {p.images?.[0] && (
                        <Image
                          src={p.images[0]}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 33vw, 25vw"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="mt-2.5 font-body text-[13px] leading-tight text-text">{p.name}</div>
                    <div className="mt-0.5 font-body text-[12px] text-mid tabular-nums">{formatPrice(p.price)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
