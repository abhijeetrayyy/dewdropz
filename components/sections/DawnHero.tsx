'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'
import { BLUR_DATA_URL, DAY_ARC } from '@/lib/constants'

// ─────────────────────────────────────────────────────────────────────────────
// 06:20 — The walk in.
// ─────────────────────────────────────────────────────────────────────────────
//
// The homepage used to open on the 3D range held at the summit. That scene is
// genuinely good — but at scroll progress 0 the terrain sits beyond the fog's
// far plane (`fog(['#1c2f24', 10, 40])`), so the opening frame fogged out to a
// flat #182b22 rectangle. Three thousand lines of WebGL resolving to a green
// void, with a headline floating on it.
//
// So the descent moved to where it earns its keep (The Climb, where scroll
// actually drives the camera through the terrain) and the front door became
// this: one photograph, two people, headlamps, the moment before a walk. It
// costs one image request and it does in 100ms what the void never did at all.
//
// There are people in it on purpose. The site ran on 23 images of empty
// landscape and flat-lay product — beautiful, expensive, and impossible to
// feel anything about, because there was nobody in the frame to feel it with.

export default function DawnHero() {
  const { introDone } = useIntro()
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!introDone || !sectionRef.current) return
    const ctx = gsap.context(() => {
      // Unhurried stagger — each element gets its own beat, so the opening
      // reads as a sequence (dateline → headline → line → doors) rather than a
      // wall of text arriving at once.
      gsap.fromTo(
        '[data-dawn-reveal]',
        { autoAlpha: 0, y: 24, filter: 'blur(8px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.22, ease: 'power3.out' }
      )
      // A very slow push-in on the photograph. Nothing you'd consciously
      // notice — it just stops the frame feeling like a dead JPEG.
      gsap.fromTo(
        '[data-dawn-plate]',
        { scale: 1.06 },
        { scale: 1, duration: 14, ease: 'none' }
      )
    }, sectionRef)
    return () => ctx.revert()
  }, [introDone])

  return (
    <section ref={sectionRef} className="relative h-[100svh] overflow-hidden bg-ink select-none">
      <div data-dawn-plate className="absolute inset-0">
        <Image
          src={DAY_ARC.theStart}
          alt="Two trekkers walking a mountain trail toward snow-capped peaks"
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
      </div>

      {/* A LEFT ramp, not a full-frame wash.
          The first attempt laid two vertical gradients across the whole frame
          and the photograph vanished — a flat slab of colour with a headline on
          it. But the copy is left-aligned and the subjects are centre-right, so
          the protection only needs to be where the words are. This keeps the
          hikers and the peaks essentially untouched while giving the type a
          solid ground to sit on, which is how an editorial cover has always
          done it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(16,21,18,0.88) 0%, rgba(16,21,18,0.62) 32%, rgba(16,21,18,0.12) 58%, rgba(16,21,18,0) 74%)',
        }}
      />
      {/* Nav protection only — 18% of the height, then gone. */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(16,21,18,0.62) 0%, rgba(16,21,18,0) 18%)' }}
      />
      {/* Floor, for the scroll hint. */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(16,21,18,0.72) 0%, rgba(16,21,18,0) 34%)' }}
      />

      {/* Dateline */}
      <div className="absolute left-6 top-24 md:left-10 md:top-28">
        <p data-dawn-reveal className="invisible font-mono text-[9px] uppercase leading-relaxed tracking-[0.24em] text-paper/60">
          06:20 — the walk in
          <br />
          30.3165° N, 78.0322° E
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-6 pb-20 md:px-10 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-[clamp(44px,8.5vw,116px)] font-light leading-[0.92] tracking-[-0.02em] text-paper">
            <span data-dawn-reveal className="invisible block">Go where</span>
            <span data-dawn-reveal className="invisible block italic text-sage">you feel alive.</span>
          </h1>

          <p
            data-dawn-reveal
            className="invisible mt-7 max-w-md font-body text-sm leading-relaxed text-paper/75 md:text-base"
          >
            The sun is up, the packs are on, and the col is four hours away. Everything we make was built by the guides
            walking this trail beside you.
          </p>

          <div data-dawn-reveal className="invisible mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-paper px-8 py-4 font-body text-[11px] uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
            >
              Shop the gear ↗
            </Link>
            <Link
              href="/collections"
              className="border-b border-paper/25 pb-1 font-body text-[10px] uppercase tracking-[0.16em] text-paper/70 transition-colors duration-300 hover:border-paper/70 hover:text-paper"
            >
              Or explore the collections
            </Link>
          </div>
        </div>
      </div>

      <div
        data-dawn-reveal
        className="invisible pointer-events-none absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2 font-body text-[9px] uppercase tracking-[0.2em] text-paper/40"
      >
        Keep walking ↓
      </div>
    </section>
  )
}
