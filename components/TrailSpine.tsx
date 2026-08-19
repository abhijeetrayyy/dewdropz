'use client'

import { useEffect, useState } from 'react'

interface Stop {
  time: string
  alt: string
  label: string
}

// The page's spine: a small fixed HUD that ticks the time of day and altitude as
// you scroll — the one element that never leaves you, turning eleven sections
// into a single day on the mountain. Sections announce themselves via
// data-trail-time / data-trail-alt / data-trail-label wrappers in page.tsx.
// Hidden while the hero is on screen (it carries its own HUD) and on small
// viewports, where the rail would crowd the content.
export default function TrailSpine() {
  const [stop, setStop] = useState<Stop | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-trail-time]'))
    if (els.length === 0) return

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = window.innerHeight * 0.55
        let active: HTMLElement | null = null
        for (const el of els) {
          if (el.getBoundingClientRect().top <= mid) active = el
        }
        const doc = document.documentElement
        const max = doc.scrollHeight - window.innerHeight
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
        // Guarded. This used to allocate a fresh object every animation frame
        // and hand it to setStop unconditionally, so the rail re-rendered
        // sixty times a second to redraw two strings that change perhaps ten
        // times in the whole page. SummitHero's own scrub guards exactly this
        // way; this one never did.
        const next = active
          ? {
              time: active.dataset.trailTime ?? '',
              alt: active.dataset.trailAlt ?? '',
              label: active.dataset.trailLabel ?? '',
            }
          : null
        setStop((prev) => {
          if (prev === next) return prev
          if (!prev || !next) return next
          return prev.time === next.time && prev.alt === next.alt && prev.label === next.label
            ? prev
            : next
        })
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      // `xl`, not `lg`. Measured at exactly 1024px — the old breakpoint — this
      // rail ends at x=37 and the nearest section content starts at x=40: four
      // pixels of clearance. It does not overlap, but it is one font metric
      // away from doing so, and overlapping content is the original sin this
      // element was rotated ninety degrees to escape. The page's container is
      // max-w-6xl with px-10, so a real gutter only exists once the viewport
      // is wider than the container; below that the content is flush to the
      // padding and the rail is squatting in it. At xl there is ~67px of
      // clearance, which is a margin rather than a coincidence.
      className={`fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col items-center gap-3 pointer-events-none mix-blend-difference text-white transition-opacity duration-500 ${
        stop ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Set vertically, and that is a fix rather than a flourish. Horizontally
          this HUD measured 45px wide from left-5, so it ran to x=65 while every
          section's content starts at x=40 (px-10) — the rail sat on top of
          headlines, card captions and body copy on every section of the page,
          all the way down. `mix-blend-difference` kept it *visible* over them,
          which is probably why it was never caught, but legible-on-top-of is
          still collision. Vertical type puts the whole column inside ~14px, so
          it clears the gutter on the narrow laptop widths where the container
          actually meets its padding. */}
      <div
        className="font-mono text-[11px] tracking-[0.14em] tabular-nums"
        style={{ writingMode: 'vertical-rl' }}
      >
        {stop?.time ?? ''}
      </div>
      <div className="relative h-24 w-px bg-white/25">
        <div
          className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white transition-[top] duration-200"
          style={{ top: `${progress * 100}%` }}
        />
      </div>
      {/* The label. It has been read into state since this component was
          written and never once rendered — `grep -c label` returned three
          hits, all outside the JSX. So every "First light", "Pack check" and
          "The way down" declared in page.tsx was displayed to nobody, on any
          device, while the two numbers that mean least to a stranger got the
          whole rail. It is the readable half of the readout and it goes first. */}
      <div
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ writingMode: 'vertical-rl' }}
      >
        {stop?.label ?? ''}
      </div>
      <div
        className="font-mono text-[9px] tracking-[0.12em] tabular-nums opacity-70"
        style={{ writingMode: 'vertical-rl' }}
      >
        {stop?.alt ?? ''}
      </div>
    </div>
  )
}
