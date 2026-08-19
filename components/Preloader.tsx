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

const SESSION_KEY = 'dewdropz_intro_seen'

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
    // ── Who never sees this ────────────────────────────────────────────────
    //
    // The loader gated on nothing. Its readout counted a plain object from 0
    // to 100 with a `power1.inOut` ease, so the number decelerated into 100 as
    // though it were straining against real work; it waited on no fetch, no
    // font, no decode, no `readyState`. It held the page for 2.1 seconds with
    // `body.overflow = hidden` throughout, and `sessionStorage` appeared
    // nowhere in the file — so it replayed on every refresh, every back from
    // checkout, every return visit. It had no reduced-motion check.
    //
    // A loading screen on a storefront is latency the business chose to add.
    // It now runs once per session, never for reduced motion, never in admin.
    let alreadySeen = false
    try {
      alreadySeen = window.sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      // Private browsing can throw on sessionStorage. Treat as seen: showing
      // the loader is the failure mode that costs the visitor time.
      alreadySeen = true
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (isAdminRoute.current || alreadySeen || reduceMotion) {
      finishIntro()
      setVisible(false)
      return
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // nothing to do — worst case it shows again next load
    }

    document.body.style.overflow = 'hidden'

    const hide = () => {
      document.body.style.overflow = ''
      finishIntro()
      setVisible(false)
    }

    // Safety net: if gsap ever fails silently, show the site anyway.
    const safety = setTimeout(hide, 1600)

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
      { width: '100%', duration: 0.6, ease: 'power1.inOut' },
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
        duration: 0.6,
        ease: 'power1.inOut',
        onUpdate: () => {
          if (countRef.current) countRef.current.textContent = String(Math.round(counter.value)).padStart(3, '0')
        },
      },
      0.15
    )

    // The hold, cut from 1.55s to 0.62s. The hero's copy is released by
    // `finishIntro`, so every millisecond here is a millisecond the headline
    // and the price are not on screen — that is how the first call to action
    // came to land at 3.79s. The bar and counter still complete; they just do
    // it in the time a loading screen is actually worth.
    tl.add(() => finishIntro(), 0.62)
    tl.to(panelRef.current, { autoAlpha: 0, duration: 0.34, ease: 'power2.inOut' }, 0.66)

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
