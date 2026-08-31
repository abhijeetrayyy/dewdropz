'use client'

import { useEffect, useRef } from 'react'
import SectionHeader from '@/components/SectionHeader'
import Image from 'next/image'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL, STATS_BG_IMAGE } from '@/lib/constants'
import type { HomeStat } from '@/types/database'

// The single brand statement of the page. This absorbs what BrandStatement,
// TrekManifesto, WhoGoes, MarqueeBand, StatsBand, and BrandStory used to say
// across six separate sections — one headline, one paragraph, the numbers, and
// the founder's voice, then back to the store. Emotion works by contrast, not
// repetition; one strong beat beats six matching ones.
// `stats` comes from store_settings.home_config and defaults to empty. It used
// to be four hardcoded claims ("12,000+ trekkers geared up") that nobody had
// measured; a storefront should not publish invented numbers, so the band now
// renders only what an owner actually entered in /admin/settings.
// No chapter prop: the band opens on a statement, which carries no eyebrow.
export default function BrandPulse({ stats = [] }: { stats?: HomeStat[] }) {
  const sectionRef = useRef<HTMLElement>(null)
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const tweens = stats.map((stat, i) => {
      const el = numberRefs.current[i]
      if (!el) return null
      const counter = { value: 0 }
      return gsap.to(counter, {
        value: stat.value,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 70%' },
        onUpdate: () => {
          const rounded = Math.round(counter.value)
          el.textContent = (stat.plain ? String(rounded) : rounded.toLocaleString('en-IN')) + stat.suffix
        },
      })
    })

    return () => {
      tweens.forEach((t) => {
        t?.scrollTrigger?.kill()
        t?.kill()
      })
    }
  }, [stats])

  return (
    <section ref={sectionRef} className="on-dark relative bg-forest-deep border-t border-paper/10 px-6 md:px-10 py-28 md:py-36 overflow-hidden">
      <Image
        src={STATS_BG_IMAGE}
        alt="Sunrise over a Himalayan summit, seen from above the clouds"
        fill
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/70 to-ink pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        {/* STATEMENT — the page's one brand statement, opening the way a
            statement opens: alone, at scale, with no label above it announcing
            that a statement is coming.

            Both entry animations are gone rather than merely de-faded. They
            existed to stagger a headline and a paragraph that are the first
            thing in the band anyway, and the words now ship finished in the
            server HTML — which is the only property that mattered about them.
            `--sage-lit`, not `--sage`: 7.6:1 against this ground where sage
            measured 4.8:1, on the largest italic on the page. */}
        <SectionHeader
          species="statement"
          ground="ink"
          title={
            <>
              For those still searching. <br className="hidden sm:block" />
              <span className="italic text-sage-lit">More than a destination.</span>
            </>
          }
          lede={
            <>
              We didn&apos;t start with a product. We started with a feeling — the quiet after
              heartbreak, the hope that follows a difficult season, the solitude of an empty
              trail, and the wonder of standing beneath a sky larger than yourself. Somewhere
              between mountains, campfires, long walks, and unfamiliar paths, we rediscover who
              we are. DEWDROPZ is an invitation to spend more time in those places.
            </>
          }
          className="mx-auto max-w-2xl text-center [&>h2]:mx-auto [&>p]:mx-auto"
        />
      </div>

      {stats.length > 0 && (
      <div className="relative max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center mt-16">
        {stats.map((stat, i) => (
          <div key={stat.label}>
            <div className="font-display font-light text-[clamp(32px,5vw,56px)] text-paper tabular-nums">
              <span
                ref={(el) => {
                  numberRefs.current[i] = el
                }}
              >
                0{stat.suffix}
              </span>
            </div>
            <div className="font-body text-xs text-paper/50 tracking-[0.05em] mt-2 leading-relaxed">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* The founder's pull-quote and their name and title are both struck out
          in the mark-up — "Remove the We didn't set out to build a brand
          with…" and "Remove — Founder and Name". What is left below the rule
          is the one thing the mock-up keeps: the way through to the story.
          FOUNDER_QUOTE still lives in lib/constants and still renders on
          /about, where a named quote belongs. */}
      <div className="relative max-w-2xl mx-auto text-center mt-16 border-t border-paper/10 pt-10">
        <Link
          href="/about"
          className="inline-block font-body text-xs tracking-[0.12em] uppercase text-sage hover:text-paper transition-colors duration-300 border-b border-sage/40 pb-0.5"
        >
          Read Our Story →
        </Link>
      </div>
    </section>
  )
}
