'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'

// ─────────────────────────────────────────────────────────────────────────────
// 05:55 — First light.
// ─────────────────────────────────────────────────────────────────────────────
//
// The page has always been built as one day on the mountain, with a HUD ticking
// time and altitude down the side. But dawn — the single moment that whole
// conceit exists to deliver, and the moment the brand is named after — was
// never rendered. It was only ever *asserted*, by swapping a section's
// background from dark blue to cream between two components.
//
// This is that moment, given the room it deserves: the night scrim burns off as
// you scroll, the frame warms, and the copy is the brand's own journal entry
// rather than marketing. It is also the page's structural pivot — everything
// above it is night, everything below it is day, so it's where the site stops
// being dark and stays light.
//
// Scroll-linked rather than autoplaying: the reader lifts the darkness
// themselves, which is a materially different feeling from watching a video of
// someone else's sunrise.

export default function FirstLight() {
  const sectionRef = useRef<HTMLElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const warmRef = useRef<HTMLDivElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = gsap.context(() => {
      // Reduced motion still gets the sunrise — it just arrives already risen
      // instead of being scrubbed. The content must never depend on the scrub.
      if (reduce) {
        gsap.set(scrimRef.current, { opacity: 0.15 })
        gsap.set(warmRef.current, { opacity: 0.5 })
        gsap.fromTo(
          '[data-firstlight-copy]',
          { autoAlpha: 0, y: 20 },
          { autoAlpha: 1, y: 0, duration: 1, stagger: 0.15, scrollTrigger: { trigger: section, start: 'top 70%' } }
        )
        return
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      })

      // Night lifting. Never reaches zero — a sunrise with no shadow left in it
      // looks like an overexposed stock photo, not 5:55am.
      tl.fromTo(scrimRef.current, { opacity: 0.88 }, { opacity: 0.12, ease: 'none' }, 0)
      // Warmth arrives after the darkness starts lifting, peaks, then settles —
      // that overshoot is what makes it read as the sun clearing a ridge rather
      // than a brightness slider being dragged.
      tl.fromTo(warmRef.current, { opacity: 0 }, { opacity: 0.62, ease: 'none' }, 0.15)
      tl.to(warmRef.current, { opacity: 0.34, ease: 'none' }, 0.7)
      tl.fromTo(plateRef.current, { scale: 1.12 }, { scale: 1, ease: 'none' }, 0)

      gsap.fromTo(
        '[data-firstlight-copy]',
        { autoAlpha: 0, y: 26, filter: 'blur(6px)' },
        {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.1,
          stagger: 0.18,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 55%' },
        }
      )
    }, section)

    // The pinned hero above this changes page height after mount; without a
    // refresh these triggers compute against a stale document and fire late.
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative min-h-[115svh] overflow-hidden bg-altitude">
      <div ref={plateRef} className="absolute inset-0">
        <Image
          src={DAY_ARC.firstLight}
          alt="The sun clearing a Himalayan ridge at first light"
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
      </div>

      {/* Night, lifting */}
      <div ref={scrimRef} className="absolute inset-0 bg-altitude" style={{ opacity: 0.88 }} />
      {/* Sun warmth, low and wide on the horizon */}
      <div
        ref={warmRef}
        className="absolute inset-0 opacity-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 62% at 62% 74%, rgba(255,183,110,0.85), rgba(255,140,80,0.28) 42%, rgba(0,0,0,0) 72%)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Bottom ramp so the copy always has something to sit on */}
      <div className="absolute inset-0 bg-gradient-to-t from-altitude/85 via-transparent to-transparent" />

      <div className="relative flex min-h-[115svh] items-end px-6 pb-24 md:px-10 md:pb-32">
        <div className="mx-auto w-full max-w-6xl">
          <p
            data-firstlight-copy
            className="invisible font-mono text-[9px] uppercase tracking-[0.24em] text-sage"
          >
            05:55 — first light · 4,200 m
          </p>

          <h2
            data-firstlight-copy
            className="invisible mt-5 max-w-3xl font-display text-[clamp(30px,5.4vw,64px)] font-light leading-[1.04] tracking-[-0.02em] text-paper"
          >
            The fog lifted for <span className="italic text-sage">eleven minutes.</span>
          </h2>

          <p
            data-firstlight-copy
            className="invisible mt-7 max-w-xl font-body text-sm leading-relaxed text-paper/75 md:text-base"
          >
            We know because we counted. Eleven minutes of the entire Trishul massif laid out above a sea of cloud, close
            enough to touch, gone before anyone thought to say something profound about it.
          </p>

          <p
            data-firstlight-copy
            className="invisible mt-8 max-w-xl border-l-2 border-sage/50 pl-5 font-body text-[13px] leading-relaxed text-paper/55"
          >
            We didn&apos;t come back with a summit photo. We came back understanding why people keep returning to a
            mountain that mostly refuses to be seen.
            <span className="mt-3 block font-mono text-[9px] uppercase tracking-[0.2em] text-paper/40">
              Field notes — Roopkund ridge
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
