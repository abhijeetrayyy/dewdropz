'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { COLLECTIONS } from '@/lib/constants'
import CollectionScrollWebGL from './CollectionScrollWebGL'

// Scroll distance (in viewport-heights) per unit of progress between two adjacent slides.
const UNIT_SCROLL_RATIO = 0.6
// Fraction of the distance to an adjacent slide that a slide holds at full opacity/readability
// before it starts crossfading. Keeps text comfortably readable instead of always mid-fade.
const HOLD_RADIUS = 0.35

function slideOpacity(progress: number, i: number) {
  const d = Math.min(Math.abs(progress - i), 1)
  if (d <= HOLD_RADIUS) return 1
  if (d >= 1 - HOLD_RADIUS) return 0
  return 1 - (d - HOLD_RADIUS) / (1 - 2 * HOLD_RADIUS)
}

function ExploreButton({ id, name }: { id: string; name: string }) {
  const magnetic = useMagneticHover(0.35, 12)
  return (
    <motion.div
      ref={magnetic.ref as React.RefObject<HTMLDivElement>}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      style={{ x: magnetic.x, y: magnetic.y }}
      className="mt-6 w-fit"
    >
      <Link
        href={`/collections/${id}`}
        data-cursor="magnetic"
        data-cursor-text="View"
        className="inline-flex items-center gap-2 bg-paper text-ink px-6 py-3 text-xs tracking-[0.1em] uppercase font-body font-medium rounded-sm shadow-md"
      >
        Explore {name} →
      </Link>
    </motion.div>
  )
}

export default function CollectionScroll() {
  const sectionRef = useRef<HTMLElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const mainTriggerRef = useRef<ScrollTrigger | null>(null)
  const progressRef = useRef(0)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const slides = slideRefs.current.filter(Boolean) as HTMLDivElement[]
    const n = slides.length
    if (!section || n === 0) return

    const ctx = gsap.context(() => {
      slides.forEach((slide, i) => {
        slide.style.opacity = String(i === 0 ? 1 : 0)
      })

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${window.innerHeight * (n - 1) * UNIT_SCROLL_RATIO}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress * (n - 1)
          progressRef.current = progress
          slides.forEach((slide, i) => {
            slide.style.opacity = String(slideOpacity(progress, i))
          })
          const rounded = Math.round(progress)
          setActive((prev) => (prev === rounded ? prev : rounded))
        },
      })
      mainTriggerRef.current = trigger
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const goToSlide = (i: number) => {
    const trigger = mainTriggerRef.current
    const n = COLLECTIONS.length
    if (!trigger || n <= 1) return
    const y = trigger.start + (i / (n - 1)) * (trigger.end - trigger.start) + 1
    gsap.to(window, {
      scrollTo: { y },
      duration: 1,
      ease: 'power2.inOut',
    })
  }

  return (
    <section
      ref={sectionRef}
      data-cursor="drag"
      data-cursor-text="Scroll"
      className="relative h-screen bg-ink overflow-hidden"
    >
      {/* Background WebGL canvas performing liquid texture transitions, synced to scroll every frame */}
      <CollectionScrollWebGL progressRef={progressRef} />

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-ink/30 z-[1] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent z-[1] pointer-events-none" />

      {COLLECTIONS.map((c, i) => (
        <div
          key={c.id}
          ref={(el) => {
            slideRefs.current[i] = el
          }}
          className="absolute inset-0 z-10"
        >
          {/* Topography Altitude details */}
          <div className="absolute top-20 md:top-24 left-6 md:left-12 h-[16vh] md:h-[20vh] max-h-[160px] overflow-hidden z-0 pointer-events-none [@media(max-height:550px)]:hidden select-none">
            <span className="font-display text-[clamp(90px,16vw,200px)] text-paper/10 leading-none select-none">
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>

          <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-16 pb-20 md:pb-24 max-w-3xl">
            <h3 className="font-display font-light text-[clamp(32px,min(6.5vw,7vh),88px)] text-paper leading-[0.95]">
              {c.name}
            </h3>
            <p className="font-display italic text-paper/70 text-base md:text-xl mt-3">{c.tagline}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-paper/25 px-4 py-2 font-body text-[11px] tracking-[0.05em] text-paper/85 uppercase bg-ink/25 backdrop-blur-sm">
                Best for <strong className="font-medium text-sage">{c.bestFor}</strong>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-paper/25 px-4 py-2 font-body text-[11px] tracking-[0.05em] text-paper/85 uppercase bg-ink/25 backdrop-blur-sm">
                Signature <strong className="font-medium text-sage">{c.signature}</strong>
              </span>
            </div>

            <ExploreButton id={c.id} name={c.name} />
          </div>
        </div>
      ))}

      {/* Slide Navigation Pagination */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        {COLLECTIONS.map((c, i) => (
          <button
            key={c.id}
            aria-label={`Go to ${c.name}`}
            onClick={() => goToSlide(i)}
            className="p-2 -m-2"
          >
            <span
              className={`block h-[2px] rounded-full transition-all duration-500 ease-[var(--ease-out)] ${
                active === i ? 'w-10 bg-paper' : 'w-4 bg-paper/35'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
