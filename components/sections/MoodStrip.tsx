'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { COLLECTIONS } from '@/lib/constants'

export default function MoodStrip() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const cards = section.querySelectorAll('.mood-card')
    const tween = gsap.from(cards, {
      y: 60,
      opacity: 0,
      stagger: 0.15,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: section, start: 'top 75%' },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
        {COLLECTIONS.map((c) => (
          <div
            key={c.id}
            className="mood-card group relative h-[60vw] max-h-[480px] md:h-[70vh] flex-1 rounded-lg overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
            style={{ background: c.gradient }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%)' }}
            />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="font-display italic text-2xl text-white transition-transform duration-300 group-hover:-translate-y-1">
                {c.name}
              </div>
              <div className="font-body text-xs text-white/75 tracking-[0.05em] mt-1">{c.tagline}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
