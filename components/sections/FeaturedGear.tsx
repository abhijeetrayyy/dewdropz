'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { PRODUCTS } from '@/lib/constants'
import ProductCard from '@/components/ProductCard'

const FEATURED_SLUGS = ['mist-tee', 'altitude-pack', 'trail-cap', 'summit-flask']
const FEATURED = FEATURED_SLUGS.map((slug) => PRODUCTS.find((p) => p.slug === slug)!).filter(Boolean)

export default function FeaturedGear() {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    // Scoped to this grid (not a bare global selector) and `once: true` so the reveal
    // can only ever play forward one time — it can never re-hide the cards on scroll
    // back up, and invalidateOnRefresh keeps the trigger position accurate if layout
    // settles (fonts/preloader) after this effect first runs.
    const ctx = gsap.context(() => {
      gsap.from('.product-card', {
        y: 50,
        opacity: 0,
        stagger: { each: 0.12, from: 'start' },
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 85%',
          once: true,
          invalidateOnRefresh: true,
        },
      })
      gsap.fromTo(
        '.product-image',
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          stagger: { each: 0.12, from: 'start' },
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 85%',
            once: true,
            invalidateOnRefresh: true,
          },
        }
      )
    }, gridRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="bg-paper px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 flex items-end justify-between">
          <div>
            <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">From the Trail</div>
            <h2 className="font-display text-[clamp(34px,5vw,54px)] text-text mt-2">Featured Gear</h2>
          </div>
          <Link
            href="/collections"
            data-cursor="view"
            data-cursor-text="View"
            className="hidden md:inline-block font-body text-xs tracking-[0.1em] text-forest uppercase hover:text-text transition-colors duration-300"
          >
            Shop All Collections →
          </Link>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {FEATURED.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
