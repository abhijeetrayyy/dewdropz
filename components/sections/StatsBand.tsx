'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL, STATS, STATS_BG_IMAGE } from '@/lib/constants'

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
    <section ref={sectionRef} className="relative bg-ink px-6 md:px-10 py-28 md:py-36 overflow-hidden">
      <Image
        src={STATS_BG_IMAGE}
        alt="Sunrise over a Himalayan summit, seen from above the clouds"
        fill
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/70 to-ink pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center mb-16">
        <div className="font-body text-[10px] tracking-[0.3em] text-sage uppercase">Not Just Numbers</div>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mt-4 font-display font-light text-[clamp(24px,3.4vw,36px)] text-paper leading-snug"
        >
          None of this happened in a lab. It happened one ridge, one whiteout,
          one exhausted last mile at a time.
        </motion.p>
      </div>

      <div className="relative max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center">
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
