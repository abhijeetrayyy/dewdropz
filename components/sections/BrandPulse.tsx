'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL, STATS, STATS_BG_IMAGE, FOUNDER_QUOTE } from '@/lib/constants'

// The single brand statement of the page. This absorbs what BrandStatement,
// TrekManifesto, WhoGoes, MarqueeBand, StatsBand, and BrandStory used to say
// across six separate sections — one headline, one paragraph, the numbers, and
// the founder's voice, then back to the store. Emotion works by contrast, not
// repetition; one strong beat beats six matching ones.
export default function BrandPulse() {
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

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="font-mono text-[10px] tracking-[0.24em] text-sage uppercase">19:30 · Basecamp</div>
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mt-4 font-display font-light text-[clamp(30px,4.6vw,52px)] text-paper leading-tight"
        >
          For people who go outside <br className="hidden sm:block" />
          <span className="italic text-sage">to feel something.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          className="mt-6 font-body text-sm md:text-base text-paper/70 leading-relaxed max-w-xl mx-auto"
        >
          Founded in Dehradun by three trekking guides tired of gear that didn&apos;t survive
          the monsoon. Every piece is refined on the ridges we guide on and tested above
          five thousand metres — none of it happened in a lab.
        </motion.p>
      </div>

      <div className="relative max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center mt-16">
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

      <div className="relative max-w-2xl mx-auto text-center mt-16 border-t border-paper/10 pt-10">
        <p className="font-display italic text-base md:text-lg text-paper/75 leading-relaxed">
          &ldquo;{FOUNDER_QUOTE.quote}&rdquo;
        </p>
        <div className="mt-4 font-body text-[10px] tracking-[0.18em] uppercase text-paper/50">
          {FOUNDER_QUOTE.name} — {FOUNDER_QUOTE.role}
        </div>
        <Link
          href="/about"
          data-cursor="view"
          data-cursor-text="Story"
          className="mt-6 inline-block font-body text-xs tracking-[0.12em] uppercase text-sage hover:text-paper transition-colors duration-300 border-b border-sage/40 pb-0.5"
        >
          Read Our Story →
        </Link>
      </div>
    </section>
  )
}
