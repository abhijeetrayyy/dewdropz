'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

const MARK_PATHS = [
  'M50 15C35 35 25 50 25 65a25 25 0 0 0 50 0c0-15-10-30-25-50z',
  'M35 65l10-12 8 8 12-15',
]

const TELEMETRY_PHASES = [
  { max: 25, text: 'PREPARING DEWDROPZ EXPEDITION' },
  { max: 55, text: 'MAPPING ALTITUDE CONTOURS' },
  { max: 80, text: 'ALIGNED TO MOUNTAIN RIDGE' },
  { max: 100, text: 'TRAIL MAP ACTIVE' },
]

export default function Preloader() {
  const { finishIntro } = useIntro()
  const [visible, setVisible] = useState(true)
  const [telemetry, setTelemetry] = useState('CALIBRATING SENSORS')
  const panelRef = useRef<HTMLDivElement>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const counterRef = useRef<HTMLSpanElement>(null)
  const logoRef = useRef<SVGSVGElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const skippedRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    const paths = pathRefs.current.filter(Boolean) as SVGPathElement[]
    paths.forEach((p) => {
      const length = p.getTotalLength()
      gsap.set(p, { strokeDasharray: length, strokeDashoffset: length })
    })

    // Subtly pulse logo glow during load (soft and glowing, not harsh)
    if (logoRef.current) {
      gsap.to(logoRef.current, {
        filter: 'drop-shadow(0 0 10px rgba(123, 164, 111, 0.28))',
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      })
    }

    const counter = { value: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = ''
        setVisible(false)
      },
    })
    tlRef.current = tl

    // Animate drawing paths of the brand mark
    tl.to(paths, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', stagger: 0.18 }, 0)
    
    // Animate percentage count smoothly
    tl.to(
      counter,
      {
        value: 100,
        duration: 1.6,
        ease: 'power2.inOut',
        onUpdate: () => {
          const rounded = Math.round(counter.value)
          if (counterRef.current) {
            counterRef.current.textContent = String(rounded).padStart(3, '0')
          }
          
          // Update telemetry messages based on current value
          const phase = TELEMETRY_PHASES.find(p => rounded <= p.max)
          if (phase) {
            setTelemetry(phase.text)
          }
        },
      },
      0
    )
    
    tl.add(() => finishIntro(), 1.7)
    
    // Custom liquid shrinking wipeout using CSS clip-path ellipse (slower and softer easing)
    tl.to(
      panelRef.current,
      {
        clipPath: 'ellipse(160% 0% at 50% 0%)',
        y: -60,
        duration: 1.1,
        ease: 'power4.inOut',
      },
      1.7
    )

    return () => {
      tl.kill()
      document.body.style.overflow = ''
    }
  }, [finishIntro])

  const handleSkip = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    tlRef.current?.progress(1)
  }

  if (!visible) return null

  return (
    <div
      ref={panelRef}
      onClick={handleSkip}
      className="fixed inset-0 z-[100] bg-ink flex flex-col items-center justify-center gap-8 cursor-pointer overflow-hidden"
      style={{
        clipPath: 'ellipse(160% 100% at 50% 50%)',
      }}
    >
      <div className="flex flex-col items-center gap-6 select-none">
        <svg
          ref={logoRef}
          width="80"
          height="80"
          viewBox="0 0 100 100"
          fill="none"
          stroke="#7BA46F"
          strokeWidth="2"
          className="transition-all duration-300"
        >
          {MARK_PATHS.map((d, i) => (
            <path
              key={i}
              ref={(el) => {
                pathRefs.current[i] = el
              }}
              d={d}
            />
          ))}
        </svg>
        <span ref={counterRef} className="font-mono text-xl tracking-[0.2em] text-paper/90 tabular-nums">
          000
        </span>
      </div>

      <div className="absolute bottom-16 flex flex-col items-center gap-2">
        <span className="font-body text-[9px] tracking-[0.25em] text-sage font-medium uppercase transition-all duration-300">
          {telemetry}
        </span>
        <span className="font-body text-[9px] tracking-[0.1em] text-paper/20 uppercase mt-1">
          Click anywhere to skip
        </span>
      </div>
    </div>
  )
}
