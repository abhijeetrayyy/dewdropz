'use client'

/* eslint-disable react-hooks/set-state-in-effect -- matchMedia/viewport reads are
   only available client-side; same established pattern as TerrainFlythrough. */

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { Collection } from '@/types/database'
import { resolveSeason, seasonForDate, type Season } from './HeroWeather'
import type { DragState, WaypointScreenState } from './TerrainScene'
import { WAYPOINTS } from './TerrainScene'

const TerrainScene = dynamic(() => import('./TerrainScene'), { ssr: false })

// The hero and the terrain flythrough, fused: the page opens on the summit of
// the brand's own 3D range at dawn holding exactly one experience — headline,
// one line, one door — and scrolling doesn't play a video, it descends the
// mountain, revealing the trail and its waypoints as the journey's reward.
// One world, one motion, one thing at a time.
//
// The descent card used to name two hardcoded collections with invented
// altitude bands and blurbs. It now reads whatever collections actually exist
// in the catalogue, in their admin-set sort order, and shows the real tagline —
// so a renamed or removed collection can never leave a ghost on the front door.
// With no collections configured the card simply doesn't render.

// Four moods the range actually has. Order runs clear → socked in, so the row
// reads as a scale rather than an arbitrary menu.
const SEASON_CHOICES: { value: Season; label: string; hint: string }[] = [
  { value: 'clear', label: 'Clear', hint: 'Post-monsoon: the clearest air of the year' },
  { value: 'fog', label: 'Fog', hint: 'Valley cloud, sitting in the pines until mid-morning' },
  { value: 'rain', label: 'Rain', hint: 'Monsoon, July to September' },
  { value: 'snow', label: 'Snow', hint: 'Deep winter, December to February' },
]

const PEAK_ALTITUDE = 5200
const VALLEY_ALTITUDE = 3200
// The intro overlay is gone by here; the descent HUD takes over past it.
const INTRO_FADE_END = 0.12
const DESCENT_UI_START = 0.3
// With the hero keyframe occupying p<0.3, the old mid-descent zone switch lands here.
const ZONE_SWITCH = 0.65

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

// "Mobile" here means how the page is *consumed*, not just how wide it is: on a
// coarse-pointer device the scroll-scrubbed descent becomes flick-labour — three
// full swipes through darkness — so those devices get the ambient hold instead.
function isTouchConsumption() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 768
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function SummitHero({ collections = [] }: { collections?: Collection[] }) {
  const { introDone } = useIntro()
  const sectionRef = useRef<HTMLElement>(null)
  const progressRef = useRef(0)
  const dragRef = useRef<DragState>({ yaw: 0, pitch: 0, active: false })
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const waypointLabelRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [progress, setProgress] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [ambientMobile, setAmbientMobile] = useState(false)
  const [segments, setSegments] = useState(90)
  const [treeCount, setTreeCount] = useState(90)
  const [sceneReady, setSceneReady] = useState(false)
  // Whether the hero is on screen at all. Drives the WebGL render loop.
  const [inView, setInView] = useState(true)
  const [mounted, setMounted] = useState(false)
  // The weather layer is the one effect a mid-range phone would actually feel,
  // and phones already get the ambient hero rather than the scrubbed descent —
  // so it is desktop/laptop only. Season is read on the client so the hero
  // shows whatever is genuinely happening on the range today.
  const [weather, setWeather] = useState(false)
  const [season, setSeason] = useState<Season>('clear')
  const [liveSeason, setLiveSeason] = useState<Season>('clear')

  // Stop rendering the moment the hero leaves the viewport, and pick it up again
  // on the way back. A generous margin means the loop is already running before
  // any of the scene is actually visible, so there is never a stalled first frame.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => setInView(entries[0]?.isIntersecting ?? true), {
      rootMargin: '200px 0px',
    })
    io.observe(section)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const mobile = isTouchConsumption()
    setAmbientMobile(mobile)
    setSegments(mobile ? 48 : 90)
    setTreeCount(mobile ? 40 : 90)
    setWeather(!mobile)
    const live = seasonForDate()
    setLiveSeason(live)
    setSeason(resolveSeason(window.location.search, 'clear'))
    setMounted(true)
  }, [])

  // Headline entrance, gated on the site preloader finishing.
  useEffect(() => {
    if (!introDone || !sectionRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-summit-reveal]',
        { autoAlpha: 0, y: 26, filter: 'blur(8px)' },
        // Deliberately unhurried stagger — each element gets its own beat, so the
        // hold reads as a sequence (headline → line → door → hint), never a wall.
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.26, ease: 'power3.out' }
      )
    }, sectionRef)
    return () => ctx.revert()
  }, [introDone])

  // The descent — desktop only. Reduced motion and touch devices skip the pin
  // entirely: the summit hold becomes a living, time-driven vista (camera drift,
  // mist, stars) that scrolls away naturally instead of demanding scrub-labour.
  // Detection reads the environment directly (not state) so no transient trigger
  // is ever created on mobile before hydration effects settle.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || reduceMotion) return
    if (isTouchConsumption()) return
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=260%',
      pin: true,
      scrub: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        progressRef.current = self.progress
        setProgress(self.progress)
      },
    })
    return () => {
      trigger.kill()
    }
  }, [reduceMotion])

  // Click-and-drag free look, mouse only — touch is never hijacked from scrolling.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    dragRef.current.active = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    dragRef.current.yaw = clampRange(dragRef.current.yaw - dx * 0.0022, -0.6, 0.6)
    dragRef.current.pitch = clampRange(dragRef.current.pitch - dy * 0.0016, -0.32, 0.32)
  }

  const handlePointerUp = () => {
    dragRef.current.active = false
  }

  const handleWaypointProject = useCallback((states: Record<string, WaypointScreenState>) => {
    for (const id in states) {
      const el = waypointLabelRefs.current[id]
      if (!el) continue
      const s = states[id]
      // The summit hold belongs to the headline alone — every label waits for the
      // descent, collections arriving a beat before the trek pins. Gates mirror
      // the 3D markers in TerrainScene so dot and label always move together.
      const kind = WAYPOINTS.find((w) => w.id === id)?.kind
      const gate = clamp01((progressRef.current - (kind === 'trek' ? 0.16 : 0.13)) / 0.1)
      const opacity = s.visible ? gate : 0
      el.style.left = `${s.x}%`
      el.style.top = `${s.y}%`
      el.style.opacity = String(opacity)
      el.style.pointerEvents = s.visible && opacity > 0.5 ? 'auto' : 'none'
    }
  }, [])

  const introOpacity = reduceMotion || ambientMobile ? 1 : 1 - clamp01(progress / INTRO_FADE_END)
  const descentOpacity = reduceMotion || ambientMobile ? 0 : clamp01((progress - DESCENT_UI_START) / 0.15)
  // The descent walks through the real collections: the first one holds the
  // high ground, and crossing ZONE_SWITCH hands over to the next. Clamped, so a
  // catalogue with a single collection (or none) degrades instead of indexing
  // off the end.
  const zone = collections.length
    ? collections[Math.min(progress < ZONE_SWITCH ? 0 : 1, collections.length - 1)]
    : null
  const altitude = Math.round(PEAK_ALTITUDE - progress * (PEAK_ALTITUDE - VALLEY_ALTITUDE))

  return (
    <section
      ref={sectionRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative h-[100svh] bg-[#182b22] overflow-hidden select-none"
    >
      {/* Poster behind the canvas — a dawn glow that holds until WebGL breathes in,
          so first paint is instant regardless of GPU. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 70% 28%, rgba(185,211,240,0.14), transparent 60%), radial-gradient(ellipse 70% 45% at 30% 80%, rgba(123,164,111,0.10), transparent 65%), #182b22',
        }}
      />

      {mounted && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${sceneReady ? 'opacity-100' : 'opacity-0'}`}>
          <TerrainScene
            progressRef={progressRef}
            reduceMotion={reduceMotion}
            ambient={ambientMobile && !reduceMotion}
            segments={segments}
            treeCount={treeCount}
            active={inView}
            season={season}
            weather={weather}
            dragRef={dragRef}
            onWaypointProject={handleWaypointProject}
            onReady={() => setSceneReady(true)}
          />
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#182b22] via-transparent to-[#182b22]/45 z-[1]" />

      {/* In-world waypoints — collections sell gear, treks link to the trails. */}
      {WAYPOINTS.map((w) => (
        <Link
          key={w.id}
          ref={(el) => {
            waypointLabelRefs.current[w.id] = el
          }}
          href={w.href}
          className="group absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 opacity-0 transition-opacity duration-300"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${w.kind === 'trek' ? 'bg-clay/60' : 'bg-sage/60'}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full bg-paper ring-2 ${w.kind === 'trek' ? 'ring-clay/40' : 'ring-sage/40'}`} />
          </span>
          <span className="whitespace-nowrap rounded-sm bg-ink/60 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.15em] text-paper backdrop-blur-sm transition-colors duration-300 group-hover:bg-ink/85">
            {w.name} ↗
          </span>
        </Link>
      ))}

      {/* ——— Summit hold: one experience, one axis. Headline, one line, one door.
          Everything else (waypoints, trail, HUD) belongs to the descent. ——— */}
      <div
        className="absolute inset-0 z-10"
        style={{ opacity: introOpacity, pointerEvents: introOpacity < 0.15 ? 'none' : undefined }}
      >
        <div className="absolute left-6 top-24 md:left-10">
          <p data-summit-reveal className="invisible pointer-events-none font-mono text-[9px] uppercase leading-relaxed tracking-[0.24em] text-paper/55">
            04:30 — The start
            <br />
            30.3165° N, 78.0322° E
          </p>

          {/* Conditions — a readout you can argue with.
              It opens on whatever is genuinely happening on the range today, so
              the default is information, not a toggle. But the range has four
              distinct moods and most visitors will only ever see one, so the
              row underneath lets them look at the others. Written as a field
              instrument reporting a reading, not as a settings control. */}
          {weather && !reduceMotion && (
            // NOT tagged data-summit-reveal. That attribute ships with an
            // `invisible` class which GSAP only clears when the intro reveal
            // runs — so this control was permanently visibility:hidden while
            // still occupying its box, and every click fell straight through to
            // the layer behind it. Decorative reveals must never gate a control.
            <div className="mt-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/70">
                  Conditions
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-dawn/80">
                  {season === liveSeason ? 'live' : 'simulated'}
                </span>
              </div>
              <p className="mt-1 font-body text-[11px] leading-relaxed text-paper/45">
                Change the weather on the range →
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SEASON_CHOICES.map((c) => {
                  const on = season === c.value
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setSeason(c.value)}
                      aria-pressed={on}
                      title={c.hint}
                      className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] backdrop-blur-sm transition-colors duration-300 ${
                        on
                          ? // Solid amber: at 9px on a dark photograph, a tinted
                            // border and 20% fill did not read as "selected" at all.
                            'border-dawn bg-dawn text-forest-deep'
                          : 'border-paper/30 bg-ink/55 text-paper/70 hover:border-dawn/60 hover:text-paper'
                      }`}
                    >
                      {c.label}
                      {c.value === liveSeason && <span className="ml-1.5 text-dawn" aria-hidden>•</span>}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/35">
                <span className="text-dawn">•</span> on the range today
              </div>
            </div>
          )}
        </div>

        {/* Soft scrim so the type never fights the ridgeline behind it */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 62% 52% at 50% 55%, rgba(12,16,13,0.44), transparent 72%)',
          }}
        />

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {/* Back to h1 — DawnHero/FirstLight are unplugged (see app/page.tsx),
              so this is the page's hero again. */}
          <h1 className="font-display font-light uppercase leading-[0.86] tracking-[-0.04em] text-[clamp(46px,8vw,116px)] text-paper">
            <span data-summit-reveal className="invisible block">Go where</span>
            <span data-summit-reveal className="invisible block italic text-sage">you feel alive.</span>
          </h1>
          <p data-summit-reveal className="invisible mt-6 font-body text-sm md:text-base text-paper/70 leading-relaxed max-w-md">
            Gear built by the guides who live at 3,800 metres.
          </p>
          <div data-summit-reveal className="invisible pointer-events-auto mt-9 flex flex-col items-center gap-5 sm:flex-row">
            <Link
              href="/shop"
              data-cursor="magnetic"
              data-cursor-text="Shop"
              className="inline-flex items-center gap-3 rounded-full bg-paper px-8 py-4 font-body text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-sage"
            >
              Shop the Gear
              <span aria-hidden="true">↗</span>
            </Link>
            {/* Treks paused — the quiet door pointed to /treks ("or find your trek"). */}
            <Link
              href="/collections"
              className="font-body text-[10px] uppercase tracking-[0.16em] text-paper/60 border-b border-paper/25 pb-1 transition-colors duration-300 hover:text-paper hover:border-sage"
            >
              or explore the collections
            </Link>
          </div>
        </div>

        {/* "Scroll to descend" is only true where the pin exists; on mobile the
            page simply continues, so the hint is a plain arrow. */}
        {!reduceMotion && (
          <div data-summit-reveal className="invisible absolute bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-2 font-body text-[9px] tracking-[0.2em] text-paper/40 uppercase pointer-events-none">
            {ambientMobile ? '↓' : 'Scroll to descend ↓'}
          </div>
        )}
      </div>

      {/* ——— Descent HUD: takes over once the summit hold is released ——— */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{ opacity: descentOpacity }}>
        <div className="absolute top-24 left-6 md:left-10">
          <div className="font-body text-[10px] tracking-[0.3em] text-sage/80 uppercase">The Range</div>
          <div className="mt-1 font-mono text-[9px] tracking-[0.15em] text-paper/50 uppercase tabular-nums">
            {altitude.toLocaleString('en-IN')}m — descending
          </div>
        </div>

        <div className="hidden md:flex absolute top-40 bottom-24 left-10 flex-col items-center">
          <span className="font-mono text-[8px] tracking-[0.1em] text-paper/40">5,200M</span>
          <div className="relative flex-1 w-px bg-paper/20 mt-2 mb-2">
            <div
              className="absolute left-1/2 h-1.5 w-1.5 rounded-full bg-sage"
              style={{ top: `${progress * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <span className="font-mono text-[8px] tracking-[0.1em] text-paper/40">3,200M</span>
        </div>

        {zone && (
          <div className="absolute bottom-8 left-6 right-6 md:bottom-10 md:left-10 md:right-10" style={{ pointerEvents: descentOpacity > 0.5 ? 'auto' : 'none' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6"
              >
                <div className="flex items-center gap-4 max-w-lg">
                  {/* Collections have no image until an admin uploads one — fall
                      back to the collection's own gradient rather than a broken
                      <Image> or a stock photo standing in for real work. */}
                  <div
                    className="relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-sm overflow-hidden flex-shrink-0 border border-paper/15"
                    style={zone.image_url ? undefined : { background: zone.gradient ?? '#2A3B31' }}
                  >
                    {zone.image_url && (
                      <Image
                        src={zone.image_url}
                        alt={zone.name}
                        fill
                        sizes="80px"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-body text-[9px] tracking-[0.15em] text-sage uppercase tabular-nums">
                      {altitude.toLocaleString()}M
                    </div>
                    <div className="font-display text-lg md:text-xl text-paper leading-tight mt-0.5">
                      {zone.name}
                    </div>
                    {zone.tagline && (
                      <p className="font-body text-xs text-paper/60 leading-relaxed mt-1 max-w-xs sm:max-w-sm">
                        {zone.tagline}
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  href={`/collections/${zone.slug}`}
                  data-cursor="magnetic"
                  data-cursor-text="Explore"
                  className="inline-flex items-center gap-2 font-body text-[10px] tracking-[0.12em] uppercase text-paper border border-paper/25 rounded-sm px-5 py-3 whitespace-nowrap hover:bg-paper/10 transition-colors duration-300 flex-shrink-0 w-fit"
                >
                  Shop {zone.name} →
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  )
}
