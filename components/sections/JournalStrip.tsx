'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL, JOURNAL } from '@/lib/constants'

export default function JournalStrip() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const cards = section.querySelectorAll('.journal-card')
    const tween = gsap.fromTo(
      cards,
      { clipPath: 'inset(0% 0% 100% 0%)', scale: 1.08 },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        scale: 1,
        stagger: 0.15,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 75%' },
      }
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 flex items-end justify-between">
          <div>
            <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">From the Journal</div>
            <h2 className="font-display text-[clamp(34px,5vw,54px)] text-text mt-2">Stories from the trail</h2>
          </div>
          <Link
            href="/journal"
            data-cursor="view"
            data-cursor-text="Read"
            className="hidden md:inline-block font-body text-xs tracking-[0.1em] text-forest uppercase hover:text-text transition-colors duration-300"
          >
            Visit the Journal →
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {JOURNAL.map((entry) => (
            <Link
              key={entry.id}
              href={`/journal/${entry.id}`}
              data-cursor="view"
              data-cursor-text="Read"
              className="journal-card group relative h-[60vw] max-h-[480px] md:h-[65vh] flex-1 rounded-lg overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-[1.02] block"
            >
              <Image
                src={entry.image}
                alt={entry.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.3))' }}
              />
              <div className="absolute top-6 left-6">
                <span className="font-body text-[11px] tracking-[0.15em] text-sage uppercase">{entry.tag}</span>
              </div>
              <div className="absolute bottom-6 left-6 right-6">
                <div className="font-display text-xl text-white leading-snug transition-transform duration-300 group-hover:-translate-y-1">
                  {entry.title}
                </div>
                <div className="font-body text-xs text-white/75 leading-relaxed mt-2">{entry.excerpt}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
