'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import ScrollReveal from '@/components/ScrollReveal'

export default function BrandStatement() {
  const sectionRef = useRef<HTMLElement>(null)
  const ruleRef = useRef<HTMLDivElement>(null)
  const pathsRef = useRef<(SVGPathElement | null)[]>([])
  
  // Track cursor offsets for interactive topographic shift
  const [coords, setCoords] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const paths = pathsRef.current.filter(Boolean) as SVGPathElement[]
    
    // Initialize stroke animation offsets
    paths.forEach((p) => {
      const length = p.getTotalLength()
      gsap.set(p, { strokeDasharray: length, strokeDashoffset: length })
    })

    // Draw topography lines on scroll entry
    const terrainTween = gsap.to(paths, {
      strokeDashoffset: 0,
      duration: 2.2,
      ease: 'power2.out',
      stagger: 0.15,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 80%',
      },
    })

    const ruleTween = gsap.from(ruleRef.current, {
      scaleX: 0,
      duration: 1.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: ruleRef.current,
        start: 'top 85%',
      },
    })

    return () => {
      terrainTween.scrollTrigger?.kill()
      terrainTween.kill()
      ruleTween.scrollTrigger?.kill()
      ruleTween.kill()
    }
  }, [])

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = sectionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // Calculate normalized cursor coordinates (-0.5 to 0.5)
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setCoords({ x: px, y: py })
  }

  const handlePointerLeave = () => {
    setCoords({ x: 0, y: 0 })
  }

  return (
    <section
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="bg-paper min-h-[55vh] flex flex-col items-center justify-center px-6 py-28 relative overflow-hidden"
    >
      {/* Topographic mapping outlines (ambient background with multi-depth transforms) */}
      <div className="absolute top-1/2 left-[-100px] md:left-[-50px] -translate-y-1/2 w-[350px] h-[350px] md:w-[450px] md:h-[450px] opacity-[0.08] pointer-events-none select-none z-0">
        <svg viewBox="0 0 100 100" className="w-full h-full fill-none" strokeWidth="0.4">
          <path
            ref={(el) => { pathsRef.current[0] = el }}
            d="M50 10 C70 12, 85 25, 90 50 C95 75, 75 90, 50 90 C25 90, 5 70, 10 50 C15 30, 30 8, 50 10 Z"
            className="stroke-forest transition-transform duration-500 ease-out"
            style={{ transform: `translate3d(${coords.x * 6}px, ${coords.y * 6}px, 0)` }}
          />
          <path
            ref={(el) => { pathsRef.current[1] = el }}
            d="M50 25 C62 27, 72 35, 75 50 C78 65, 68 75, 50 75 C32 75, 20 62, 25 50 C30 38, 38 23, 50 25 Z"
            className="stroke-forest transition-transform duration-500 ease-out"
            style={{ transform: `translate3d(${coords.x * 12}px, ${coords.y * 12}px, 0)` }}
          />
          <path
            ref={(el) => { pathsRef.current[2] = el }}
            d="M50 40 C55 41, 60 45, 62 50 C64 55, 58 60, 50 60 C42 60, 36 54, 38 50 C40 46, 45 39, 50 40 Z"
            className="stroke-forest transition-transform duration-500 ease-out"
            style={{ transform: `translate3d(${coords.x * 20}px, ${coords.y * 20}px, 0)` }}
          />
        </svg>
      </div>

      <div className="absolute top-1/2 right-[-100px] md:right-[-50px] -translate-y-1/2 w-[380px] h-[380px] md:w-[480px] md:h-[480px] opacity-[0.08] pointer-events-none select-none z-0">
        <svg viewBox="0 0 100 100" className="w-full h-full fill-none" strokeWidth="0.4">
          <path
            ref={(el) => { pathsRef.current[3] = el }}
            d="M50 5 C75 10, 95 30, 90 55 C85 80, 65 95, 45 90 C25 85, 8 65, 10 40 C12 15, 25 0, 50 5 Z"
            className="stroke-forest transition-transform duration-500 ease-out"
            style={{ transform: `translate3d(${coords.x * 6}px, ${coords.y * 6}px, 0)` }}
          />
          <path
            ref={(el) => { pathsRef.current[4] = el }}
            d="M50 22 C65 25, 78 38, 75 55 C72 72, 58 80, 45 75 C32 70, 20 58, 22 40 C24 22, 35 19, 50 22 Z"
            className="stroke-forest transition-transform duration-500 ease-out"
            style={{ transform: `translate3d(${coords.x * 12}px, ${coords.y * 12}px, 0)` }}
          />
          <path
            ref={(el) => { pathsRef.current[5] = el }}
            d="M50 40 C57 41, 62 48, 60 55 C58 62, 52 65, 45 62 C38 59, 32 52, 33 45 C34 38, 43 39, 50 40 Z"
            className="stroke-forest transition-transform duration-500 ease-out"
            style={{ transform: `translate3d(${coords.x * 20}px, ${coords.y * 20}px, 0)` }}
          />
        </svg>
      </div>

      <ScrollReveal
        enableBlur={true}
        baseOpacity={0}
        containerClassName="max-w-5xl mx-auto text-center z-10"
        textClassName="font-display font-light text-[clamp(32px,5.5vw,72px)] leading-[1.1] text-text"
      >
        For people who go outside to feel something.
      </ScrollReveal>

      <div ref={ruleRef} className="w-16 h-px bg-sage mx-auto mt-10 origin-center z-10" />
    </section>
  )
}
