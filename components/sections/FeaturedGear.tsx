'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { PRODUCTS } from '@/lib/constants'

export default function FeaturedGear() {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const tween = gsap.from('.product-card', {
      y: 50,
      opacity: 0,
      stagger: { each: 0.12, from: 'start' },
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: gridRef.current, start: 'top 80%' },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section className="bg-paper px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14">
          <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">From the Trail</div>
          <h2 className="font-display text-[clamp(34px,5vw,54px)] text-text mt-2">Featured Gear</h2>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {PRODUCTS.map((p) => (
            <div key={p.slug} className="product-card group">
              <div
                className="aspect-[3/4] rounded-sm overflow-hidden"
                style={{ background: p.gradient }}
              />
              <h3 className="font-display text-xl mt-4 mb-1">{p.name}</h3>
              <p className="font-body text-sm text-mid">{p.desc}</p>
              <div className="mt-2 overflow-hidden relative h-6">
                <div className="transition-transform duration-300 group-hover:-translate-y-full">
                  <span className="font-body text-sm font-medium text-forest block h-6">
                    Rs. {p.price.toLocaleString('en-IN')}
                  </span>
                  <span className="font-body text-sm font-medium text-forest block h-6">Add to cart</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
