'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'

interface ValuesGridProps {
  eyebrow: string
  title: string
  values: { title: string; body: string }[]
}

export default function ValuesGrid({ eyebrow, title, values }: ValuesGridProps) {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const cards = section.querySelectorAll('.value-card')
    const tween = gsap.fromTo(
      cards,
      { clipPath: 'inset(0% 0% 100% 0%)', y: 20 },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        y: 0,
        stagger: 0.12,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 75%' },
      }
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-altitude px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-lg mx-auto text-center mb-16">
          <div className="font-body text-[10px] tracking-[0.3em] text-sage uppercase">{eyebrow}</div>
          <h2 className="mt-4 font-display font-light text-[clamp(30px,4.5vw,44px)] text-white leading-[1.1]">
            {title}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {values.map((value, i) => (
            <div
              key={value.title}
              className="value-card border border-white/10 rounded-lg p-8 hover:border-sage/40 transition-colors duration-300"
            >
              <span className="font-mono text-xs text-sage/70">0{i + 1}</span>
              <h3 className="mt-3 font-display text-xl text-white leading-snug">{value.title}</h3>
              <p className="mt-3 font-body text-sm text-white/60 leading-relaxed">{value.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
