'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL, COLLECTIONS, PRODUCTS, SEASON_KITS } from '@/lib/constants'
// Treks paused — restore the TREKS import alongside the trek card below.
// import { TREKS } from '@/lib/constants'

// The homepage's heartbeat: mountains have seasons, so the store does too. This
// section knows the calendar — which trek window is open right now and the exact
// kit we'd pack for it — and changes four times a year without a redesign. It
// converts the hero's emotion into a plan within one scroll, and sells the kit
// as a kit, not four separate decisions.
export default function SeasonKit() {
  const month = new Date().getMonth() + 1
  const kit = SEASON_KITS.find((k) => k.months.includes(month)) ?? SEASON_KITS[0]
  // Treks paused — the card below now features the season's collection instead.
  // const trek = TREKS.find((t) => t.slug === kit.trekSlug)
  const collection = COLLECTIONS.find((c) => c.id === kit.collectionId)
  const products = kit.products
    .map((slug) => PRODUCTS.find((p) => p.slug === slug))
    .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p))
  const kitTotal = products.reduce((sum, p) => sum + p.price, 0)

  const { addItem } = useCart()
  const [added, setAdded] = useState(false)

  function addKit() {
    for (const p of products) {
      addItem({ slug: p.slug, name: p.name, price: p.price, gradient: p.gradient, size: p.sizes[0] })
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  return (
    <section className="bg-altitude px-6 md:px-10 py-20 md:py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-center">
        {/* The window */}
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.22em] text-sage uppercase">
              06:10 · First light — {kit.seasonLabel} open
            </span>
          </div>

          <h2 className="mt-5 font-display font-light text-[clamp(32px,4.8vw,54px)] text-paper leading-[1.05]">
            {kit.headline}
          </h2>
          <p className="mt-4 font-body text-sm md:text-base text-paper/65 leading-relaxed max-w-md">
            {kit.line}
          </p>

          {/* Treks paused — this card used to show the season's bookable trek
              (image, dates, spots left). Restore by uncommenting the trek lookup
              above and swapping this collection card back for the original.
              For now: the collection built for these exact conditions. */}
          {collection && (
            <Link
              href={`/collections/${collection.id}`}
              data-cursor="view"
              data-cursor-text="Explore"
              className="group mt-8 flex items-center gap-4 border border-paper/15 rounded-sm p-4 max-w-md hover:border-sage/40 transition-colors duration-300"
            >
              <div className="relative h-16 w-16 rounded-sm overflow-hidden flex-shrink-0">
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  sizes="64px"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-[9px] tracking-[0.15em] text-sage uppercase">Built for this window</div>
                <div className="mt-0.5 font-display text-lg text-paper leading-tight">{collection.name}</div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.08em] text-paper/50 uppercase">
                  {collection.conditions[0].value} · {collection.conditions[1].value}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-body text-[10px] tracking-[0.1em] text-sage uppercase group-hover:text-paper transition-colors">
                  Explore →
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* The kit */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {products.map((p, i) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                data-cursor="view"
                data-cursor-text="View"
                className="group"
              >
                <div className="relative aspect-[3/4] rounded-sm overflow-hidden">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 15vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                  />
                  <span className="absolute top-2 left-2 font-mono text-[9px] text-paper/80 bg-ink/50 backdrop-blur-sm rounded-sm px-1.5 py-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="mt-2 font-body text-xs text-paper leading-tight">{p.name}</div>
                <div className="font-body text-[11px] text-paper/50 mt-0.5">Rs. {p.price.toLocaleString('en-IN')}</div>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-paper/10 pt-5">
            <div>
              <div className="font-body text-[9px] tracking-[0.18em] text-paper/45 uppercase">
                The full kit — {products.length} pieces
              </div>
              <div className="font-display text-2xl text-paper mt-0.5 tabular-nums">
                Rs. {kitTotal.toLocaleString('en-IN')}
              </div>
            </div>
            <button
              type="button"
              onClick={addKit}
              data-cursor="magnetic"
              data-cursor-text="Add"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-paper px-8 py-4 font-body text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-sage"
            >
              {added ? 'Kit added to cart ✓' : 'Add the full kit'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
