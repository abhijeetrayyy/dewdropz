'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL, CLIMB_STATIONS, PRODUCTS } from '@/lib/constants'

// The page's one gear story: five stations in ascending altitude order, strung
// on a single trail line. Each product appears exactly once on the homepage and
// earns its place on the mountain — replacing the old FeaturedGear grid and
// GearSpotlight rows, which between them re-sold a 7-SKU catalog three times.
const STATIONS = CLIMB_STATIONS.map((s) => ({
  ...s,
  product: PRODUCTS.find((p) => p.slug === s.slug)!,
})).filter((s) => Boolean(s.product))

function StationRow({
  station,
  index,
}: {
  station: (typeof STATIONS)[number]
  index: number
}) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const flip = index % 2 === 1
  const p = station.product

  function handleAdd() {
    addItem({ slug: p.slug, name: p.name, price: p.price, gradient: p.gradient, size: p.sizes[0] })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-14 items-center ${flip ? '' : ''}`}
    >
      {/* Altitude tick on the trail line */}
      <div className="absolute -left-[29px] md:-left-[45px] top-8 hidden sm:flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-forest ring-4 ring-paper" />
      </div>

      <div className={`relative aspect-[4/3] rounded-sm overflow-hidden ${flip ? 'md:order-2' : ''}`}>
        <Image
          src={p.image}
          alt={p.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] hover:scale-105"
        />
        <span className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.12em] text-paper bg-ink/55 backdrop-blur-sm rounded-sm px-2 py-1">
          {station.altitude}
        </span>
      </div>

      <div className={flip ? 'md:order-1 md:text-right' : ''}>
        <div className="font-mono text-[10px] tracking-[0.18em] text-forest uppercase">
          Station {String(index + 1).padStart(2, '0')} · {station.altitude}
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
          <span className="font-body text-sm font-medium text-forest tabular-nums">
            Rs. {p.price.toLocaleString('en-IN')}
          </span>
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
            data-cursor="view"
            data-cursor-text="View"
            className="font-body text-[10px] tracking-[0.14em] uppercase text-mid hover:text-text transition-colors duration-300"
          >
            View →
          </Link>
        </div>
      </div>
    </motion.li>
  )
}

export default function TheClimb() {
  return (
    <section className="bg-paper px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16 md:mb-20 max-w-2xl">
          <div className="font-mono text-[10px] tracking-[0.2em] text-forest uppercase">08:30 · The Climb</div>
          <h2 className="mt-3 font-display font-light text-[clamp(32px,5vw,54px)] text-text leading-[1.05]">
            Five stations to the summit.
          </h2>
          <p className="mt-4 font-body text-sm md:text-base text-mid leading-relaxed max-w-lg">
            Every piece earns its altitude. Start low, layer up — by the time the wind
            gets serious, everything you need is already on your back.
          </p>
        </div>

        {/* The trail line the stations hang from */}
        <ol className="relative space-y-20 md:space-y-28 sm:border-l border-dashed border-forest/25 sm:pl-7 md:pl-11">
          {STATIONS.map((station, i) => (
            <StationRow key={station.slug} station={station} index={i} />
          ))}
        </ol>

        <div className="mt-16 sm:pl-7 md:pl-11">
          <Link
            href="/shop"
            data-cursor="view"
            data-cursor-text="Shop"
            className="inline-flex items-center gap-2 font-body text-xs tracking-[0.12em] uppercase text-forest hover:text-text transition-colors duration-300"
          >
            The full catalogue →
          </Link>
        </div>
      </div>
    </section>
  )
}
