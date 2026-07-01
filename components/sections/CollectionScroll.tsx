'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { COLLECTIONS } from '@/lib/constants'

export default function CollectionScroll() {
  const sectionRef = useRef<HTMLElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const slides = slideRefs.current.filter(Boolean) as HTMLDivElement[]
    if (!section || slides.length === 0) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${window.innerHeight * 3}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      })

      slides.forEach((slide, i) => {
        if (i === 0) return
        gsap.set(slide, { opacity: 0, y: 40 })
      })

      slides.forEach((slide, i) => {
        if (i === 0) return
        ScrollTrigger.create({
          trigger: section,
          start: () => `top+=${window.innerHeight * i} top`,
          end: () => `top+=${window.innerHeight * (i + 1)} top`,
          invalidateOnRefresh: true,
          onEnter: () => {
            setActive(i)
            gsap.to(slides[i], { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
            gsap.to(slides[i - 1], { opacity: 0, y: -40, duration: 0.5 })
          },
          onLeaveBack: () => {
            setActive(i - 1)
            gsap.to(slides[i], { opacity: 0, y: 40, duration: 0.5 })
            gsap.to(slides[i - 1], { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
          },
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative h-screen bg-paper overflow-hidden">
      {COLLECTIONS.map((c, i) => (
        <div
          key={c.id}
          ref={(el) => {
            slideRefs.current[i] = el
          }}
          className="absolute inset-0 flex items-center"
        >
          <span className="font-display text-[25vw] text-forest/10 leading-none absolute left-6 md:left-12 select-none">
            {String(i + 1).padStart(2, '0')}
          </span>

          <div className="relative z-10 flex-1 flex items-center justify-center px-6">
            <h3 className="font-display font-light text-[clamp(48px,8vw,110px)] text-text text-center leading-tight">
              {c.name}
            </h3>
          </div>

          <div
            className="hidden md:block relative z-10 w-[35vw] h-[60vh] mr-16 rounded-lg"
            style={{ background: c.gradient }}
          />
        </div>
      ))}

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        {COLLECTIONS.map((c, i) => (
          <span
            key={c.id}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              active === i ? 'bg-forest' : 'bg-forest/20'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
