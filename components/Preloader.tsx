'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

// ─────────────────────────────────────────────────────────────────────────────
// The load is the dawn.
// ─────────────────────────────────────────────────────────────────────────────
//
// The previous version was a near-black panel (`bg-ink`) with a percentage
// counter and rotating telemetry strings. It loaded fine and said nothing. Worse,
// it set up four more screens of darkness behind it — the site's first ~4
// screen-heights were all dark surfaces, so a visitor's entire first impression
// was an unlit void.
//
// This inverts that. The whole homepage is built as one day on the mountain
// starting pre-dawn, and the single most valuable moment in that day — first
// light — was never actually rendered anywhere. So the loading screen becomes
// it: the sky moves through a real sunrise as progress climbs, a sun clears the
// ridgeline, and the panel resolves onto warm paper that the hero then inherits.
//
// The wait now BUYS something instead of costing something, and the site opens
// by resolving toward light rather than away from it.

/**
 * Sky keyframes, sampled from an actual Himalayan dawn rather than picked off a
 * colour wheel — astronomical night, nautical twilight, civil twilight, the
 * amber minute before the sun clears the ridge, then full daylight on paper.
 *
 * Each stop is [top, bottom]: the sky is always lighter at the horizon, which is
 * the single cue that makes a two-colour gradient read as "sky" instead of
 * "gradient".
 */
const SKY = [
  { at: 0.0, top: '#080D14', bottom: '#101A26' }, // astronomical night
  { at: 0.3, top: '#132033', bottom: '#2A3A55' }, // nautical twilight
  { at: 0.55, top: '#2B3A5C', bottom: '#7A5C74' }, // civil twilight, violet band
  { at: 0.78, top: '#5E5A78', bottom: '#C98A63' }, // the amber minute
  { at: 0.92, top: '#A48B86', bottom: '#E8B583' }, // sun on the ridge
  { at: 1.0, top: '#E4DCCB', bottom: '#F6F3EA' }, // full day — hero's paper
]

function lerpHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** The sky at a given 0–1 progress, interpolated between the two nearest stops. */
function skyAt(p: number) {
  let lo = SKY[0]
  let hi = SKY[SKY.length - 1]
  for (let i = 0; i < SKY.length - 1; i++) {
    if (p >= SKY[i].at && p <= SKY[i + 1].at) {
      lo = SKY[i]
      hi = SKY[i + 1]
      break
    }
  }
  const span = hi.at - lo.at || 1
  const t = Math.min(1, Math.max(0, (p - lo.at) / span))
  return { top: lerpHex(lo.top, hi.top, t), bottom: lerpHex(lo.bottom, hi.bottom, t) }
}

// Same silhouette language as the mobile app's Ridgeline, so the two products
// share a motif even though they share no layout.
const RIDGE_FAR =
  'M0,150 L70,120 L120,138 L190,86 L245,118 L300,96 L360,130 L430,88 L500,124 L560,100 L640,140 L700,112 L780,146 L850,120 L920,150 L1000,128 L1000,220 L0,220 Z'
const RIDGE_NEAR =
  'M0,186 L80,168 L160,190 L240,154 L320,180 L400,160 L470,188 L550,158 L630,182 L710,162 L790,190 L870,166 L940,184 L1000,172 L1000,220 L0,220 Z'

export default function Preloader() {
  const { finishIntro } = useIntro()
  // Admin is a working tool, not the brand experience — it never gets the
  // dawn. Captured once on mount (not reactive to later navigation) since this
  // is a one-time "first load" component.
  const pathname = usePathname()
  const isAdminRoute = useRef(pathname?.startsWith('/admin') ?? false)
  const [visible, setVisible] = useState(true)

  const panelRef = useRef<HTMLDivElement>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  const sunRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
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
    const safety = setTimeout(hide, 5000)

    const state = { p: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(safety)
        hide()
      },
    })
    tlRef.current = tl

    // The sun climbs and the sky warms off ONE driver, so light and position can
    // never disagree — the sun is always lowest when the sky is darkest.
    tl.to(state, {
      p: 1,
      duration: 2.4,
      ease: 'power2.inOut',
      onUpdate: () => {
        const p = state.p
        const { top, bottom } = skyAt(p)
        if (skyRef.current) {
          skyRef.current.style.background = `linear-gradient(to bottom, ${top} 0%, ${bottom} 100%)`
        }
        if (sunRef.current) {
          // Rises from below the ridge into the sky, and swells slightly as it
          // clears — the atmospheric magnification everyone has seen at a horizon.
          sunRef.current.style.transform = `translate(-50%, ${64 - p * 150}px) scale(${0.7 + p * 0.5})`
          sunRef.current.style.opacity = String(Math.max(0, (p - 0.35) / 0.4))
        }
        if (glowRef.current) {
          glowRef.current.style.opacity = String(Math.max(0, (p - 0.45) / 0.55) * 0.85)
        }
        // A clock, not a percentage. "04:12" says pre-dawn; "087%" says nothing.
        if (timeRef.current) {
          const mins = Math.round(4 * 60 + 10 + p * 105) // 04:10 → 05:55
          timeRef.current.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
        }
      },
    })

    if (markRef.current) {
      tl.fromTo(
        markRef.current,
        { autoAlpha: 0, y: 14, filter: 'blur(7px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out' },
        0.15
      )
    }

    // Let the finished dawn hold for a beat before it lifts — the payoff needs a
    // moment to land or the whole sequence reads as a flicker.
    tl.add(() => finishIntro(), 2.5)
    tl.to(panelRef.current, { autoAlpha: 0, duration: 0.75, ease: 'power2.inOut' }, 2.55)

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
      className="fixed inset-0 z-[100] cursor-pointer overflow-hidden"
      aria-label="Loading DEWDROPZ"
    >
      {/* Sky — the only thing that actually animates colour. */}
      <div ref={skyRef} className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #080D14, #101A26)' }} />

      {/* Warm bloom on the horizon once the sun is up. Sits under the ridges so
          the peaks stay silhouetted against it, which is what sells the depth. */}
      <div
        ref={glowRef}
        className="absolute inset-x-0 bottom-0 h-[55%] opacity-0"
        style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(255,186,120,0.55), transparent 70%)' }}
      />

      {/* The sun */}
      <div
        ref={sunRef}
        className="absolute left-1/2 bottom-[26%] h-24 w-24 rounded-full opacity-0"
        style={{
          background: 'radial-gradient(circle, #FFF3DA 0%, #FFD79A 45%, rgba(255,180,110,0) 72%)',
          transform: 'translate(-50%, 64px) scale(0.7)',
        }}
      />

      {/* Ridgelines */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[38%] w-full"
        viewBox="0 0 1000 220"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={RIDGE_FAR} fill="#0C1219" opacity={0.55} />
        <path d={RIDGE_NEAR} fill="#080D12" />
      </svg>

      {/* Mark + clock */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
        <div ref={markRef} className="invisible flex flex-col items-center gap-4 select-none">
          <Image src="/logo/mountain-mark.png" alt="" width={168} height={97} priority className="h-14 w-auto md:h-16" />
          <span className="font-display text-lg tracking-[0.3em] text-paper/95">DEWDROPZ</span>
          <span ref={timeRef} className="font-body text-[10px] tracking-[0.3em] text-paper/55 tabular-nums">
            04:10
          </span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-1.5">
        <span className="font-body text-[9px] tracking-[0.25em] text-paper/70 uppercase">First light · 30.3165° N</span>
        <span className="font-body text-[9px] tracking-[0.1em] text-paper/30 uppercase">Click anywhere to skip</span>
      </div>
    </div>
  )
}
