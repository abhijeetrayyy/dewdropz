'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

// ─────────────────────────────────────────────────────────────────────────────
// The loader — flat, quiet, fast.
// ─────────────────────────────────────────────────────────────────────────────
//
// The previous version tried to simulate a sunrise in CSS: a colour-shifting
// sky gradient, a radial-gradient sun disc with a glow blend, an SVG ridgeline
// silhouette. In practice a browser gradient standing in for a photographic sky
// doesn't read as "dawn" — it reads as a rendered orb on a coloured backdrop,
// closer to a screensaver than to the brand. Simulating something photographic
// with flat CSS shapes was the wrong instinct twice over: it looked cheap, and
// it fought the site's own typographic, editorial voice instead of extending it.
//
// This version doesn't try to depict anything. It's the mark, the wordmark, and
// one thin line filling left to right — the same restraint the rest of the site
// asks of its typography. Solid ink background, no colour animation, no shapes
// pretending to be terrain. It's also materially faster to run: one width
// tween instead of five synced properties recalculated every frame.

export default function Preloader() {
  const { finishIntro } = useIntro()
  // Admin is a working tool, not the brand experience — it never gets this.
  // Captured once on mount (not reactive to later navigation) since this is a
  // one-time "first load" component.
  const pathname = usePathname()
  const isAdminRoute = useRef(pathname?.startsWith('/admin') ?? false)
  const [visible, setVisible] = useState(true)

  const panelRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const lineFillRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const skippedRef = useRef(false)

  useEffect(() => {
    if (isAdminRoute.current) {
      finishIntro()
      setVisible(false)
      return
    }

    document.body.style.overflow = 'hidden'

    const hide = () => {
      document.body.style.overflow = ''
      finishIntro()
      setVisible(false)
    }

    // Safety net: if gsap ever fails silently, show the site anyway.
    const safety = setTimeout(hide, 4000)

    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(safety)
        hide()
      },
    })
    tlRef.current = tl

    if (markRef.current) {
      tl.fromTo(
        markRef.current,
        { autoAlpha: 0, y: 10, filter: 'blur(4px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out' },
        0
      )
    }

    tl.fromTo(
      lineFillRef.current,
      { width: '0%' },
      { width: '100%', duration: 1.3, ease: 'power1.inOut' },
      0.15
    )

    // Same start time, duration and easing as the line fill, so the number
    // and the bar always agree — a counter that raced ahead of (or lagged)
    // the thing it's supposedly counting would read as a bug, not a detail.
    const counter = { value: 0 }
    tl.to(
      counter,
      {
        value: 100,
        duration: 1.3,
        ease: 'power1.inOut',
        onUpdate: () => {
          if (countRef.current) countRef.current.textContent = String(Math.round(counter.value)).padStart(3, '0')
        },
      },
      0.15
    )

    // A short, still hold once the line completes — long enough to register as
    // a deliberate beat, short enough to never feel like a stall.
    tl.add(() => finishIntro(), 1.55)
    tl.to(panelRef.current, { autoAlpha: 0, duration: 0.5, ease: 'power2.inOut' }, 1.6)

    return () => {
      clearTimeout(safety)
      tl.kill()
      document.body.style.overflow = ''
    }
  }, [finishIntro])

  const skip = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    tlRef.current?.progress(1)
  }

  if (!visible) return null

  return (
    <div
      ref={panelRef}
      onClick={skip}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-7 bg-ink"
      aria-label="Loading DEWDROPZ"
    >
      <div ref={markRef} className="invisible flex select-none flex-col items-center gap-3.5">
        <Image src="/logo/mountain-mark.png" alt="" width={168} height={97} priority className="h-11 w-auto md:h-12" />
        <span className="font-display text-base tracking-[0.32em] text-paper">DEWDROPZ</span>
      </div>

      <div className="flex w-40 flex-col items-center gap-2.5">
        <div className="h-px w-full overflow-hidden bg-paper/12">
          <div ref={lineFillRef} className="h-full w-0 bg-sage" />
        </div>
        {/* Same telemetry voice as the hero's "04:30 — THE START" readout —
            a number counting up reads as instrumentation here, not a spinner. */}
        <span className="font-mono text-[10px] tabular-nums tracking-[0.25em] text-paper/40">
          <span ref={countRef} className="text-sage/80">
            000
          </span>
          {' / 100'}
        </span>
      </div>
    </div>
  )
}
