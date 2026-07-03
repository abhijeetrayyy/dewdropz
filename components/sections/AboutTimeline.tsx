'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { TIMELINE } from '@/lib/constants'

export default function AboutTimeline() {
  const sectionRef = useRef<HTMLElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const rows = section.querySelectorAll('.timeline-row')

    const rowTween = gsap.fromTo(
      rows,
      { opacity: 0, x: -20 },
      {
        opacity: 1,
        x: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 70%' },
      }
    )

    const lineTween = lineRef.current
      ? gsap.fromTo(
          lineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            transformOrigin: 'top',
            scrollTrigger: { trigger: section, start: 'top 70%', end: 'bottom 60%', scrub: true },
          }
        )
      : null

    return () => {
      rowTween.scrollTrigger?.kill()
      rowTween.kill()
      lineTween?.scrollTrigger?.kill()
      lineTween?.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <div className="font-body text-[10px] tracking-[0.3em] text-forest uppercase">The Climb So Far</div>
          <h2 className="mt-4 font-display font-light text-[clamp(30px,4.5vw,44px)] text-text leading-[1.1]">
            Seven years, one ridgeline at a time.
          </h2>
        </div>

        <div className="relative pl-10 md:pl-14">
          <div className="absolute left-[3px] md:left-[5px] top-1 bottom-1 w-px bg-rule">
            <div ref={lineRef} className="absolute inset-0 w-px bg-forest" />
          </div>

          <div className="flex flex-col gap-12">
            {TIMELINE.map((item) => (
              <div key={item.year} className="timeline-row relative">
                <div className="absolute -left-10 md:-left-14 top-1 h-2 w-2 rounded-full bg-forest" />
                <span className="font-display text-2xl text-forest">{item.year}</span>
                <p className="mt-2 font-body text-sm text-mid leading-relaxed max-w-lg">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
