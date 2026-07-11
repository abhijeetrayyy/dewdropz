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
        setStop(
          active
            ? {
                time: active.dataset.trailTime ?? '',
                alt: active.dataset.trailAlt ?? '',
                label: active.dataset.trailLabel ?? '',
              }
            : null
        )
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
      className={`fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-3 pointer-events-none mix-blend-difference text-white transition-opacity duration-500 ${
        stop ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="font-mono text-[12px] tracking-[0.14em] tabular-nums">{stop?.time ?? ''}</div>
      <div className="relative h-28 w-px bg-white/25">
        <div
          className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white transition-[top] duration-200"
          style={{ top: `${progress * 100}%` }}
        />
      </div>
      <div className="font-mono text-[10px] tracking-[0.12em] tabular-nums opacity-70">{stop?.alt ?? ''}</div>
      <div
        className="font-body text-[8px] tracking-[0.28em] uppercase opacity-50"
        style={{ writingMode: 'vertical-rl' }}
      >
        {stop?.label ?? ''}
      </div>
    </div>
  )
}
