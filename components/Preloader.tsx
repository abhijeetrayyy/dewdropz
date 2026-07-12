'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

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
  const logoRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const skippedRef = useRef(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'

    // Subtly pulse logo glow during load (soft and glowing, not harsh). Lives on
    // its own inner element — the entrance tween below also animates `filter`
    // (for the blur-in), and two tweens writing the same CSS property on the
    // same node stomp each other every frame instead of composing.
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        filter: 'drop-shadow(0 0 10px rgba(123, 164, 111, 0.28))',
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      })
    }

    const hidePreloader = () => {
      document.body.style.overflow = ''
      finishIntro()
      setVisible(false)
    }

    // Safety timeout: if gsap fails silently, show the page anyway after 5s
    const safetyTimer = setTimeout(hidePreloader, 5000)

    const counter = { value: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(safetyTimer)
        hidePreloader()
      },
    })
    tlRef.current = tl

    // The mark can't stroke-draw like the old hand-coded SVG did (it's a raster
    // logo now), so the entrance is a soft rise-and-focus instead: starts low,
    // blurred and translucent, settles into place as the counter climbs.
    if (logoRef.current) {
      tl.fromTo(
        logoRef.current,
        { autoAlpha: 0, y: 16, scale: 0.92, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power2.out' },
        0
      )
    }

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
      clearTimeout(safetyTimer)
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
      <div ref={logoRef} className="flex flex-col items-center gap-4 select-none invisible">
        <div ref={glowRef} className="flex flex-col items-center gap-4">
          <Image src="/logo/mountain-mark.png" alt="" width={168} height={97} priority className="h-16 w-auto md:h-20" />
          <span className="font-display text-lg tracking-[0.3em] text-paper/90">DEWDROPZ</span>
        </div>
        <span ref={counterRef} className="mt-2 font-mono text-xl tracking-[0.2em] text-paper/90 tabular-nums">
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
