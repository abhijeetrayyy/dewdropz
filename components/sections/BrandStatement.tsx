'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import ScrollReveal from '@/components/ScrollReveal'

export default function BrandStatement() {
  const ruleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ruleRef.current) return
    const tween = gsap.from(ruleRef.current, {
      scaleX: 0,
      duration: 1.2,
      ease: 'power3.out',
      scrollTrigger: { trigger: ruleRef.current, start: 'top 80%' },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section className="bg-paper min-h-[50vh] flex flex-col items-center justify-center px-6">
      <ScrollReveal
        baseOpacity={0}
        enableBlur
        containerClassName="max-w-5xl text-center"
        textClassName="!font-display !font-light !text-[clamp(32px,5.5vw,72px)] !leading-[1.1] !text-text"
      >
        For people who go outside to feel something.
      </ScrollReveal>
      <div ref={ruleRef} className="w-16 h-px bg-sage mx-auto mt-10 origin-left" />
    </section>
  )
}
