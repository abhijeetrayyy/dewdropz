'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { STATS } from '@/lib/constants'

export default function StatsBand() {
  const sectionRef = useRef<HTMLElement>(null)
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const tweens = STATS.map((stat, i) => {
      const el = numberRefs.current[i]
      if (!el) return null
      const counter = { value: 0 }
      return gsap.to(counter, {
        value: stat.value,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 70%' },
        onUpdate: () => {
          const rounded = Math.round(counter.value)
          el.textContent = (stat.plain ? String(rounded) : rounded.toLocaleString('en-IN')) + stat.suffix
        },
      })
    })

    return () => {
      tweens.forEach((t) => {
        t?.scrollTrigger?.kill()
        t?.kill()
      })
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-ink px-6 md:px-10 py-24">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center">
        {STATS.map((stat, i) => (
          <div key={stat.label}>
            <div className="font-display font-light text-[clamp(32px,5vw,56px)] text-paper tabular-nums">
              <span
                ref={(el) => {
                  numberRefs.current[i] = el
                }}
              >
                0{stat.suffix}
              </span>
            </div>
            <div className="font-body text-xs text-paper/50 tracking-[0.05em] mt-2 leading-relaxed">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
