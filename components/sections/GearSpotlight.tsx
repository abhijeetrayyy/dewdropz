'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { useCart } from '@/providers/CartProvider'
import { BLUR_DATA_URL, PRODUCTS } from '@/lib/constants'

// The three pieces that don't make the top-fold grid, given one unhurried moment
// each instead of being crammed into a second identical card row — same commerce,
// different feeling.
const SPOTLIGHT = [
  {
    slug: 'dew-windbreaker',
    moment: 'Zipped up before you’ve decided it’s really raining.',
  },
  {
    slug: 'ridge-beanie',
    moment: 'Above 5,000m the wind never stops asking questions. This is the answer you stop noticing you’re wearing.',
  },
  {
    slug: 'desert-scarf',
    moment: 'Three days across a dry ridgeline, and the only thing between you and a sun that never once let up.',
  },
]

function SpotlightRow({
  slug,
  moment,
  reverse,
}: {
  slug: string
  moment: string
  reverse: boolean
}) {
  const product = PRODUCTS.find((p) => p.slug === slug)!
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const cta = useMagneticHover(0.35, 12)

  const handleAddToCart = () => {
    addItem({ slug: product.slug, name: product.name, price: product.price, gradient: product.gradient, size: product.sizes[0] })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
      <div className={`md:col-span-7 ${reverse ? 'md:order-2' : ''}`}>
        <div className="spotlight-image relative aspect-[4/3] rounded-sm overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
        </div>
      </div>

      <div className={`md:col-span-5 ${reverse ? 'md:order-1' : ''}`}>
        <div className="font-body text-[10px] tracking-[0.2em] text-forest uppercase">
          {product.desc}
        </div>
        <h3 className="mt-3 font-display font-light text-[clamp(28px,3.4vw,42px)] text-text leading-[1.05]">
          {product.name}
        </h3>
        <p className="mt-4 font-display italic text-mid text-base leading-relaxed max-w-sm">
          {moment}
        </p>

        <div className="mt-7 flex items-center gap-6">
          <span className="font-body text-sm font-medium text-forest">
            Rs. {product.price.toLocaleString('en-IN')}
          </span>

          <motion.div
            ref={cta.ref as React.RefObject<HTMLDivElement>}
            onMouseMove={cta.onMouseMove}
            onMouseLeave={cta.onMouseLeave}
            style={{ x: cta.x, y: cta.y }}
          >
            <button
              type="button"
              onClick={handleAddToCart}
              data-cursor="magnetic"
              className="font-body text-xs tracking-[0.1em] uppercase text-forest border-b border-forest/30 pb-0.5 hover:border-forest transition-colors duration-300"
            >
              {added ? 'Added ✓' : 'Add to cart'}
            </button>
          </motion.div>

          <Link
            href={`/products/${product.slug}`}
            data-cursor="view"
            data-cursor-text="View"
            className="font-body text-xs tracking-[0.1em] uppercase text-mid hover:text-text transition-colors duration-300"
          >
            View →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function GearSpotlight() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.spotlight-image').forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true, invalidateOnRefresh: true },
          }
        )
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-28 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-lg mx-auto mb-20">
          <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">The Rest of the Kit</div>
          <h2 className="mt-4 font-display font-light text-[clamp(30px,4.5vw,48px)] text-text leading-[1.1]">
            One thing rarely gets you up and back down.
          </h2>
        </div>

        <div className="flex flex-col gap-20 md:gap-28">
          {SPOTLIGHT.map((item, i) => (
            <SpotlightRow key={item.slug} slug={item.slug} moment={item.moment} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}
