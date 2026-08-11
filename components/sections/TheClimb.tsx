'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import type { ProductWithCollection, HomeClimbStation, HomeConfig } from '@/types/database'

type Station = HomeClimbStation & { product: ProductWithCollection }

function StationRow({ station, index }: { station: Station; index: number }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const flip = index % 2 === 1
  const p = station.product

  function handleAdd() {
    addItem({ slug: p.slug, name: p.name, price: p.price, image: p.images?.[0] ?? '', size: p.variants?.[0]?.name ?? '' })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-14 items-center"
    >
      <div className="absolute -left-[29px] md:-left-[45px] top-8 hidden sm:flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-forest ring-4 ring-paper" />
      </div>

      <div className={`relative aspect-[4/3] rounded-sm overflow-hidden bg-rule/40 ${flip ? 'md:order-2' : ''}`}>
        <Image
          src={p.images?.[0] ?? ''}
          alt={p.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] hover:scale-105"
        />
        <span className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.12em] text-paper bg-ink/55 backdrop-blur-sm rounded-sm px-2 py-1">
          {station.label}
        </span>
      </div>

      <div className={flip ? 'md:order-1 md:text-right' : ''}>
        <div className="font-mono text-[10px] tracking-[0.18em] text-forest uppercase">
          Station {String(index + 1).padStart(2, '0')} · {station.label}
        </div>
        <h3 className="mt-2 font-display text-[clamp(24px,3vw,36px)] text-text leading-tight">
          <Link href={`/products/${p.slug}`} className="hover:text-forest transition-colors duration-300">
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
            data-cursor="magnetic"
            className="font-body text-[10px] tracking-[0.14em] uppercase text-text border-b border-forest/40 pb-0.5 hover:text-forest hover:border-forest transition-colors duration-300"
          >
            {added ? 'Added ✓' : 'Add to cart'}
          </button>
          <Link
            href={`/products/${p.slug}`}
            className="font-body text-[10px] tracking-[0.14em] uppercase text-mid hover:text-text transition-colors duration-300"
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
}: {
  config: HomeConfig['climb']
  products: ProductWithCollection[]
}) {
  if (!config.enabled) return null

  const stations: Station[] = config.stations
    .map((s) => ({ ...s, product: products.find((p) => p.slug === s.product_slug)! }))
    .filter((s) => Boolean(s.product))

  return (
    <section className="bg-paper px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16 md:mb-20 max-w-2xl">
          <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">08:30 · The Climb</div>
          <h2 className="mt-3 font-display font-light text-[clamp(32px,5vw,54px)] text-text leading-[1.05]">
            {config.headline}
          </h2>
          <p className="mt-4 font-body text-sm md:text-base text-mid leading-relaxed max-w-lg">{config.intro}</p>
        </div>

        {stations.length === 0 ? (
          <div className="rounded-sm border border-dashed border-rule p-14 text-center">
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
