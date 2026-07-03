'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { MANIFESTO_TAGS } from '@/lib/constants'
import SplitText from '@/components/SplitText'

export default function WhoGoes() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const tags = section.querySelectorAll('.manifesto-tag')
    const rule = section.querySelector('.manifesto-rule')

    const tagTween = gsap.fromTo(
      tags,
      { opacity: 0, y: 15, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.08,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 65%' },
      }
    )

    const ruleTween = rule
      ? gsap.from(rule, {
          scaleX: 0,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 70%' },
        })
      : null

    return () => {
      tagTween.scrollTrigger?.kill()
      tagTween.kill()
      ruleTween?.scrollTrigger?.kill()
      ruleTween?.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-altitude px-6 md:px-10 py-32">
      <div className="max-w-4xl mx-auto text-center">
        <div className="font-body text-[10px] tracking-[0.3em] text-sage uppercase">Who Goes</div>

        <div className="manifesto-rule w-16 h-px bg-sage/40 mx-auto mt-6 origin-center" />

        {/* Premium Mask-based words split reveal */}
        <div className="mt-12 font-display font-light text-[clamp(28px,4.5vw,52px)] leading-[1.25] text-white">
          <SplitText
            text="Built for people who'd rather be cold and moving than warm and still."
            tag="span"
            splitType="words"
            delay={35}
            duration={1.2}
            ease="power4.out"
            from={{ opacity: 0, y: '100%' }}
            to={{ opacity: 1, y: '0%' }}
            className="!inline"
          />
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
          {MANIFESTO_TAGS.map((tag, i) => (
            <div key={tag} className="flex items-center gap-3">
              <span className="manifesto-tag font-body text-[10px] tracking-[0.15em] text-paper/75 uppercase border border-paper/15 rounded-full px-4 py-2 hover:bg-paper/5 hover:text-paper transition-all duration-300">
                {tag}
              </span>
              {i < MANIFESTO_TAGS.length - 1 && (
                <span className="hidden sm:inline text-sage/30">·</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
