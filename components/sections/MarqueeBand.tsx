'use client'

import { useRef } from 'react'
import Marquee from '@/components/Marquee'
import { gsap } from '@/lib/gsap'
import { useGSAP } from '@gsap/react'

function MountainIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`inline mx-2 ${className}`}>
      <path d="M12 3L2 20h20L12 3z" strokeLinejoin="round" />
      <path d="M12 3v17" />
    </svg>
  )
}

function DewdropIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6" className={`inline mx-2 ${className}`}>
      <path d="M50 15C35 35 25 50 25 65a25 25 0 0 0 50 0c0-15-10-30-25-50z" />
    </svg>
  )
}

export default function MarqueeBand() {
  const sectionRef = useRef<HTMLElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current || !wrapperRef.current) return
    
    // Add a slight scroll-based tilt and scale effect to the marquee wrapper
    gsap.fromTo(
      wrapperRef.current,
      { rotateX: 15, scale: 0.95, opacity: 0.8 },
      {
        rotateX: 0,
        scale: 1,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'center center',
          scrub: true,
        },
      }
    )
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="overflow-hidden bg-paper py-24 relative flex flex-col select-none" style={{ perspective: '1000px' }}>
      <div ref={wrapperRef} className="w-full flex flex-col gap-0 shadow-2xl transform-gpu">
        
        {/* Ribbon 1: Moving Left (Dark Editorial Ribbon) */}
        <div className="bg-ink py-6 border-b border-sage/10 transition-colors duration-300">
          <Marquee speed={40} className="font-display text-[clamp(24px,4vw,56px)] leading-none">
            <span className="font-display italic text-paper font-light">TREK</span>
            <MountainIcon className="text-sage/60" />
            <span className="font-body font-semibold tracking-[0.12em] text-transparent [-webkit-text-stroke:1px_var(--paper)]">CLIMB</span>
            <DewdropIcon className="text-sage/60" />
            <span className="font-display italic text-sage font-light">BREATHE</span>
            <MountainIcon className="text-sage/60" />
            <span className="font-body font-light tracking-[0.05em] text-paper">EXPLORE</span>
            <DewdropIcon className="text-sage/60" />
            <span className="font-display italic text-paper font-semibold">REPEAT</span>
            <MountainIcon className="text-sage/60" />
            <span className="font-body font-semibold tracking-[0.12em] text-transparent [-webkit-text-stroke:1px_var(--sage)]">ASCEND</span>
            <DewdropIcon className="text-sage/60" />
          </Marquee>
        </div>

        {/* Ribbon 2: Moving Right (Light Editorial Ribbon) */}
        <div className="bg-[#EBE7DD] py-6 transition-colors duration-300">
          <Marquee speed={45} reverse className="font-display text-[clamp(24px,4vw,56px)] leading-none">
            <span className="font-body font-medium tracking-[0.05em] text-ink/80">FEEL ALIVE</span>
            <DewdropIcon className="text-forest/40" />
            <span className="font-display italic text-forest font-light">CHASE MIST</span>
            <MountainIcon className="text-forest/40" />
            <span className="font-body font-semibold tracking-[0.12em] text-transparent [-webkit-text-stroke:1px_var(--ink)]">ALTITUDE</span>
            <DewdropIcon className="text-forest/40" />
            <span className="font-display italic text-ink font-semibold">DECORUM</span>
            <MountainIcon className="text-forest/40" />
            <span className="font-body font-semibold tracking-[0.12em] text-transparent [-webkit-text-stroke:1px_var(--forest)]">SURRENDER</span>
            <DewdropIcon className="text-forest/40" />
            <span className="font-display italic text-ink/75 font-light">QUIET</span>
            <MountainIcon className="text-forest/40" />
          </Marquee>
        </div>

      </div>
    </section>
  )
}
