'use client'

import SectionHeader from '@/components/SectionHeader'
import { stopEyebrow, type TrailStop } from '@/lib/trail'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { firstAvailableVariant, isSoldOut, priceFor } from '@/lib/variants'
import { trackEvent } from '@/lib/analytics'
import { toast } from 'sonner'
import type { ProductWithCollection, HomeClimbStation, HomeConfig } from '@/types/database'

type Station = HomeClimbStation & { product: ProductWithCollection }

function StationRow({ station, index }: { station: Station; index: number }) {
  const stationNo = String(index + 1).padStart(2, '0')
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const flip = index % 2 === 1
  const p = station.product

  // `variants[0]` used to decide your size. It is not the smallest size and
  // not a default — `sort_order` is DEFAULT 0 and set by no migration, so the
  // rows tie and the database returns them in whatever order it likes, which
  // can differ between two renders. Nothing checked stock either.
  const variant = firstAvailableVariant(p)
  const soldOut = isSoldOut(p)

  function handleAdd() {
    if (soldOut) return
    const price = priceFor(p, variant)
    addItem({
      slug: p.slug,
      name: p.name,
      price,
      image: p.images?.[0] ?? '',
      size: variant?.name ?? '',
      variantId: variant?.id ?? null,
    })
    // The funnel had never seen a homepage add-to-cart: `trackEvent` was
    // imported at three call sites and none of them was on this page.
    trackEvent('add_to_cart', {
      currency: 'INR',
      value: price,
      items: [{ item_id: p.slug, item_name: p.name, item_variant: variant?.name ?? '' }],
    })
    // The button label changing for 1,600ms was the entire confirmation, and
    // it did not say WHAT had been added. Now the size is named, in the toast
    // and in the label, so a wrong pick is visible immediately rather than on
    // the doorstep.
    toast.success('Added to cart', {
      description: `${p.name}${variant ? `, size ${variant.name}` : ''} — ${formatPrice(price)}`,
      action: { label: 'View cart', onClick: () => { window.location.href = '/cart' } },
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }
  // OPEN GROUND. This band went cream -> sand -> `--snow`. The sand step was
  // measured and defensible and the client did not like it: too heavy, and the
  // page it sat in was already two beiges and six dark slabs. The direction now
  // is an open white page where green is the CONTRAST rather than the fill, so
  // this is near-white with forest-green labels and prices on it.
  return (
    <motion.li
      // The rise stays; the fade is gone. This shipped `opacity: 0` in the
      // server HTML, so every station — a product, its price and its
      // add-to-cart — was not dimmed without JavaScript, it was absent. A
      // stalled transform leaves the row legible and 28px low; a stalled
      // opacity leaves a hole where the product was, and a background tab
      // stalls animations as a matter of course. This is the rule the hero's
      // entrance was rewritten in CSS to obey — see THE HERO ENTRANCE in
      // globals.css — arriving one section later.
      initial={{ y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-14 items-center"
    >
      <div className="absolute -left-[29px] md:-left-[45px] top-8 hidden sm:flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-forest ring-4 ring-paper" />
      </div>

      <div className={`relative aspect-[4/3] rounded-[var(--r-card)] overflow-hidden bg-paper-warm ${flip ? 'md:order-2' : ''}`}>
        <Image
          src={p.images?.[0] ?? ''}
          alt={p.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] hover:scale-105"
        />
        <span className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.12em] text-paper bg-ink/55 backdrop-blur-sm rounded-[var(--r-tag)] px-2 py-1">
          {station.label}
        </span>
      </div>

      <div className={flip ? 'md:order-1 md:text-right' : ''}>
        {/* `station.label` is admin-set and is currently just the station's own
            number, so this printed "Station 01 · 01" — the same digits twice in
            one eyebrow, with the image badge above making it three times. The
            label is only appended when it actually says something the number
            does not, so a meaningful label ("Base camp") still reads. */}
        <div className="font-mono text-[10px] tracking-[0.18em] text-forest uppercase">
          Station {stationNo}
          {station.label && station.label.trim() !== stationNo ? ` · ${station.label}` : ''}
        </div>
        <h3 className="mt-2 font-display text-[clamp(24px,3vw,36px)] text-text leading-tight">
          <Link href={`/products/${p.slug}`} className="hover:text-forest-deep transition-colors duration-300">
            {p.name}
          </Link>
        </h3>
        <p className="mt-3 font-display italic text-base text-mid leading-relaxed max-w-md md:max-w-none">
          &ldquo;{station.line}&rdquo;
        </p>
        <div className={`mt-5 flex items-center gap-6 ${flip ? 'md:justify-end' : ''}`}>
          <span className="font-body text-sm font-medium text-forest tabular-nums">{formatPrice(p.price)}</span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            data-cursor="magnetic"
            className="font-body text-[10px] tracking-[0.14em] uppercase text-text border-b border-forest/40 pb-0.5 hover:text-forest-deep hover:border-forest-deep transition-colors duration-300"
          >
            {soldOut ? 'Sold out' : added ? `Added${variant ? ` · ${variant.name}` : ''} ✓` : 'Add to cart'}
          </button>
          <Link
            href={`/products/${p.slug}`}
            className="font-body text-[10px] tracking-[0.14em] uppercase text-forest hover:text-text transition-colors duration-300"
          >
            View →
          </Link>
        </div>
      </div>
    </motion.li>
  )
}

// Used to be a fixed 5-slot "altitude stations" narrative (lib/constants.ts
// CLIMB_STATIONS) hardcoded to specific trekking-gear slugs. It's a flexible
// list now — however many entries store_settings.home_config.climb.stations
// actually has — each still just a product plus a line of copy, edited from
// /admin/settings instead of a code change.
export default function TheClimb({
  config,
  products,
  stop,
}: {
  config: HomeConfig['climb']
  products: ProductWithCollection[]
  /** The day-arc stop. This section printed "08:30 · The Climb" under a
   *  wrapper reading 11:00 — the one that made the sun run backwards, since
   *  the section above it printed 13:00. */
  stop: TrailStop
}) {
  if (!config.enabled) return null

  const stations: Station[] = config.stations
    .map((s) => ({ ...s, product: products.find((p) => p.slug === s.product_slug)! }))
    .filter((s) => Boolean(s.product))

  return (
    <section className="bg-mist border-t border-rule px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-measure mx-auto">
        {/* INDEX — this section is a numbered list of stations, so the
            numbered rule is not a costume, it is what the content already is.
            It follows a statement and is followed by a stamp. */}
        <SectionHeader
          species="index"
          no="09"
          eyebrow={stopEyebrow(stop)}
          title={config.headline}
          lede={config.intro}
          className="mb-16 md:mb-20"
        />

        {stations.length === 0 ? (
          <div className="rounded-[var(--r-panel)] border border-dashed border-rule p-14 text-center">
            <p className="font-body text-sm text-mid">New pieces are on the way — check back soon.</p>
          </div>
        ) : (
          <ol className="relative space-y-20 md:space-y-28 sm:border-l border-dashed border-forest/25 sm:pl-7 md:pl-11">
            {stations.map((station, i) => (
              <StationRow key={station.product_slug} station={station} index={i} />
            ))}
          </ol>
        )}

        <div className="mt-16 sm:pl-7 md:pl-11">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 font-body text-xs tracking-[0.12em] uppercase text-forest hover:text-text transition-colors duration-300"
          >
            The full catalogue →
          </Link>
        </div>
      </div>
    </section>
  )
}
