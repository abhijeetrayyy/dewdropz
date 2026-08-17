'use client'

/* eslint-disable react-hooks/set-state-in-effect -- matchMedia/viewport reads are
   only available client-side; same established pattern as TerrainFlythrough. */

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { Collection, Product } from '@/types/database'
import { resolveSeason, type Season } from './HeroWeather'
import { formatPrice } from '@/lib/utils'
import type { DragState } from './TerrainScene'

const TerrainScene = dynamic(() => import('./TerrainScene'), { ssr: false })

// The hero and the terrain flythrough, fused: the page opens on the summit of
// the brand's own 3D range at dawn holding exactly one experience — headline,
// one line, one door — and scrolling doesn't play a video, it descends the
// mountain, revealing the trail and its waypoints as the journey's reward.
// One world, one motion, one thing at a time.
//
// What waits at the bottom changed. The descent used to end at a lit cabin with
// a bonfire, with a single collection swapping through a strip in the corner —
// decoration as the reward, and the catalogue as an afterthought beside it. The
// camp is gone from the scene entirely (see TerrainScene) and the collections
// took its place in the frame: they arrive one per altitude band on the way down
// and settle together where the cabin stood.
//
// They still read whatever collections actually exist, in their admin-set sort
// order, with the real tagline — so a renamed or removed collection can never
// leave a ghost on the front door, and a catalogue with none renders no row.

// ── The shot list ────────────────────────────────────────────────────────────
// One unbroken take. The rule this hero is built on: NOTHING ARRIVES. No element
// slides in from an edge, because a hero assembled from things flying in from
// four directions always reads as assembled rather than directed. Everything
// already exists in one space along the camera's axis, and scrolling moves the
// camera forward through it. You reach things; they do not come to you.
//
// The move is a multiplane push: the range creeps (far plane), the garments rush
// (near plane), and that difference in rate is what makes it read as depth
// rather than as a photo being zoomed.
//
//   ESTABLISHING  the range, the promise, and the first blank already standing
//                 in frame. Nothing to scroll for; the shop is already legible.
//   THE PASS      the camera flies down the line of blanks. Each grows, holds
//                 at full size with its name and price, then passes the lens and
//                 reveals the next one that was always behind it.
//   THE PRINT     the last blank holds and its print boundary draws onto the
//                 chest — the customisation beat, at the structural centre of
//                 the move rather than as a bullet point beside it.
//   THE MAP       the camera keeps pushing until it is inside that print, and
//                 the print resolves into a contour map. Treks, coming soon.
//                 The loop closes: mountain → blank → print → mountain.
//
/** How many blanks act 1 shows. */
const MAX_BLANKS = 3

// Three acts, and the frames where each hands over to the next.
// One day, three acts. The through-line is light: act 1 is dawn on the range,
// act 2 is the working day in the studio, act 3 is night — planning tomorrow's
// company. The background makes that arc literal (night falls during the
// studio's exit), so the acts read as hours of the same day rather than as
// three slides.
const ACT1_OUT = [0.16, 0.28] as const
const ACT2_IN = [0.22, 0.34] as const
// Act 2 is not a screenshot of an editor — it is an edit session, scrubbed:
// guides flash on, the mark draws, the words type, the layer lights as each
// element lands, the selection snaps on last, the zoom readout ticks up.
const GUIDES_ON = [0.35, 0.38] as const
const MARK_DRAW = [0.37, 0.47] as const
const TYPE_ON = [0.49, 0.59] as const
const SELECT_ON = [0.6, 0.635] as const
const ZOOM_TICK = [0.35, 0.6] as const
const ACT2_OUT = [0.67, 0.77] as const
// Act 3's footage decodes only while it is on screen.
const VIDEO_LIVE = 0.66
const ACT3_IN = [0.73, 0.83] as const
// ACT 3 is the loop, run once, scrubbed — the same trick act 2 plays with the
// editor. Describing Trek Buddy in four columns of text was the weak beat of
// this hero: act 2 shows the tool being USED, and act 3 was a list. So the
// walk gets posted, people ask, the host decides, and the meeting point
// unlocks, in that order, as you scroll.
//
// Each beat is where it is because the one before it has to land first — the
// card cannot fill before it exists, and the point cannot unlock before the
// party is there.
const PLAN_IN    = [0.83, 0.865] as const  // the walk appears on the board
const ASKS_IN    = [0.875, 0.915] as const // people ask to come
const CONFIRM_IN = [0.915, 0.945] as const // the host says yes, the party fills
const POINT_IN   = [0.95, 0.975] as const  // the exact spot is released
const CHAPTER_1TO2 = 0.25
const CHAPTER_2TO3 = 0.75
// The range does not leave between acts. It dims to a held level and stays
// there as the room act 2 is standing in — cutting to black and zooming a panel
// at the camera was the "sudden change": two moves at once, and a void between
// them. It only goes fully dark once act 3's footage is ready to replace it.
const RANGE_DIM = [0.12, 0.32] as const
/** What the range holds at behind the studio — present, not competing. */
const RANGE_HELD = 0.26
const RANGE_OUT = [0.62, 0.74] as const
const RANGE_DARK = 0.76

// "Mobile" here means how the page is *consumed*, not just how wide it is: on a
// coarse-pointer device the scroll-scrubbed descent becomes flick-labour — three
// full swipes through darkness — so those devices get the ambient hold instead.
function isTouchConsumption() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 768
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const SEASONS = ['clear', 'fog', 'rain', 'snow'] as const

/**
 * What each condition does to the range, said as a thing you would notice
 * rather than as a measurement.
 *
 * Not "visibility 200 m". This sits under a real coordinate on a real hero,
 * and a fabricated reading beside a true one reads as a live weather report
 * for Dehradun, which it is not — it is a switch on a 3D scene.
 */
const SEASON_NOTE: Record<(typeof SEASONS)[number], string> = {
  clear: 'The whole range in view.',
  fog:   'The ridge comes and goes.',
  rain:  'Everything darker, and louder.',
  snow:  'Quiet, and the light goes flat.',
}

// The weather, as a control the scene itself previews.
//
// The last pass drew four little windows, one per condition, each with its own
// rain or drifting fog inside. They were unreadable: at 58x42 on a dark ground
// they are four murky rectangles, and the thing they were previewing is
// already on screen at full size and in three dimensions. A thumbnail of the
// hero, next to the hero, is a worse copy of something you are already
// looking at.
//
// So the previews are gone and the type does the work instead. Bigger, plainly
// set, with the live condition marked and named — and the line underneath says
// what the range looks like in it, which is the only thing a thumbnail was
// ever going to tell you.
function WeatherRail({
  season,
  onPick,
}: {
  season: Season
  onPick: (s: Season) => void
}) {
  return (
    <div data-summit-reveal className="invisible" role="group" aria-label="Weather on the range">
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/50">
        Change the weather
      </p>

      <div className="mt-3 flex flex-col border-t border-paper/20">
        {SEASONS.map((s) => {
          const live = season === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              aria-pressed={live}
              className="group flex items-center gap-2.5 border-b border-paper/12 py-2.5 text-left transition-colors duration-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              {/* The marker keeps its space whether or not it is drawn, so the
                  names never shift as you move between them. */}
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300 ${
                  live ? 'bg-sage' : 'bg-paper/0 group-hover:bg-paper/40'
                }`}
              />
              <span
                className={`font-body text-[15px] capitalize leading-none transition-colors duration-300 ${
                  live ? 'text-paper' : 'text-paper/50 group-hover:text-paper/85'
                }`}
              >
                {s}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3.5 max-w-[11rem] font-body text-[12px] leading-relaxed text-paper/55">
        {SEASON_NOTE[season as (typeof SEASONS)[number]] ?? ''}
      </p>
    </div>
  )
}

export default function SummitHero({
  products = [],
}: {
  products?: Product[]
  collections?: Collection[]
}) {
  const { introDone } = useIntro()
  const sectionRef = useRef<HTMLElement>(null)
  const progressRef = useRef(0)
  const dragRef = useRef<DragState>({ yaw: 0, pitch: 0, active: false })
  const lastPointerRef = useRef({ x: 0, y: 0 })
  // Nodes the timeline writes to directly. None of these is state: the hero is a
  // scrub, and a scrub that sets state re-renders the tree on every frame of
  // every scroll.
  const rangeRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  // Flipped twice in a whole scroll, not per frame: once the range has faded out
  // there is no reason to keep a WebGL loop running behind an opaque frame.
  const [rangeLive, setRangeLive] = useState(true)
  const [videoLive, setVideoLive] = useState(false)
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

  // The rack, heaviest to lightest. Descending price is the narrative order as
  // well as the commercial one: it opens on the piece with the most presence and
  // closes on the easiest yes. Whatever is actually in the catalogue is what
  // hangs here — an empty catalogue simply renders no rack.
  const garments = useMemo(
    () =>
      [...products]
        .filter((p) => p.images?.[0])
        .sort((a, b) => b.price - a.price)
        .slice(0, MAX_BLANKS)
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          price: p.price,
          image: p.images[0],
          blurb: p.short_description,
        })),
    [products]
  )

  // The blank on the bench in act 2 — the cheapest, because it is the one most
  // people will actually print on.
  const studioBlank = garments.length ? garments[garments.length - 1] : null

  const fromPrice = garments.length
    ? formatPrice(Math.min(...garments.map((g) => g.price)))
    : null

  // Pinning re-parents this section into a pin-spacer, and R3F takes its one
  // measurement during that churn — the canvas latches its unsized 300x150
  // default, and because R3F won't finish creating a renderer for a zero-size
  // container, `onReady` never fires either. So the range simply never appeared
  // until an incidental window resize knocked it awake.
  //
  // The nudge can't hang off `onReady` (that is the thing being blocked) or off
  // a single frame (the scene is dynamically imported and arrives later), so it
  // watches for the canvas and re-measures until the canvas has a real size.
  // Self-terminating and bounded: in practice it fires once or twice.
  useEffect(() => {
    if (!mounted || reduceMotion || ambientMobile) return
    let tries = 0
    const id = window.setInterval(() => {
      const canvas = sectionRef.current?.querySelector('canvas')
      if (canvas && canvas.clientWidth > 300) {
        window.clearInterval(id)
        return
      }
      if (canvas) window.dispatchEvent(new Event('resize'))
      if (++tries > 20) window.clearInterval(id)
    }, 120)
    return () => window.clearInterval(id)
  }, [mounted, reduceMotion, ambientMobile])

  // The footage is only decoded while act 3 is on screen. Autoplay can reject
  // (some power-saving modes refuse even muted video); the poster stands in, so
  // the promise is caught rather than left to throw.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (videoLive && inView) void v.play().catch(() => {})
    else v.pause()
  }, [videoLive, inView])

  // Stop rendering the moment the hero leaves the viewport, and pick it up again
  // on the way back. A generous margin means the loop is already running before
  // any of the scene is actually visible, so there is never a stalled first frame.
  //
  // Reports from a hidden document are ignored on purpose. A backgrounded tab has
  // no rendering opportunities, so its observer reports nothing intersecting —
  // and acting on that pinned the loop off permanently, leaving the canvas at its
  // unsized 300x150 default with no scene in it at all. Hidden tabs don't need
  // this anyway: browsers already throttle rAF to a stop on their own, and they
  // do it better, because they also know when to start again.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (document.visibilityState === 'hidden') return
        setInView(entries[0]?.isIntersecting ?? true)
      },
      { rootMargin: '200px 0px' }
    )
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
    setSeason(resolveSeason(window.location.search, 'clear'))
    setMounted(true)
  }, [])

  // Headline entrance, gated on the site preloader finishing.
  useEffect(() => {
    if (!introDone || !sectionRef.current) return
    const ctx = gsap.context(() => {
      // Reduced motion gets the finished frame, not a slower version of the
      // entrance.
      if (reduceMotion) {
        gsap.set('[data-summit-reveal]', { autoAlpha: 1 })
        return
      }
      gsap.fromTo(
        '[data-summit-reveal]',
        { autoAlpha: 0, y: 26, filter: 'blur(8px)' },
        // Deliberately unhurried stagger — each element gets its own beat, so the
        // hold reads as a sequence (headline → line → door → hint), never a wall.
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.26, ease: 'power3.out' }
      )
    }, sectionRef)
    return () => ctx.revert()
  }, [introDone, reduceMotion])

  // The descent — desktop only. Reduced motion and touch devices skip the pin
  // entirely: the summit hold becomes a living, time-driven vista (camera drift,
  // mist, stars) that scrolls away naturally instead of demanding scrub-labour.
  // Detection reads the environment directly (not state) so no transient trigger
  // is ever created on mobile before hydration effects settle.
  // Consumption mode used to be sampled exactly once on mount, so a window that
  // opened narrow and was then widened never got the scrubbed hero at all — no
  // pin, no acts, permanently. Re-sample when the breakpoint or pointer class
  // actually changes; the timeline effect below depends on the result.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)')
    const onChange = () => setAmbientMobile(isTouchConsumption())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || reduceMotion) return
    if (isTouchConsumption()) return

    // Deliberately NOT wrapped in gsap.context. React runs this effect twice in
    // development, and a context that reverts a *pinned* ScrollTrigger on the
    // first teardown leaves the pin spacer standing while the second pass builds
    // a fresh trigger against it — the pin survives, but the timeline it is meant
    // to scrub never advances, so the hero looks frozen on frame one.
    const build = () => {
      // Three acts, one camera. Each act arrives from slightly further away and
      // the one before it recedes — so scrolling still reads as moving forward
      // through a space rather than as panels being swapped.
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=440%',
          pin: true,
          scrub: true,
          // No anticipatePin. It guards against a flicker when a fast native
          // wheel throws you into a pin before ScrollTrigger can react — but
          // Lenis already smooths wheel input (lerp 0.3) so that throw never
          // arrives, and the guard works by engaging the pin EARLY off scroll
          // velocity. Reverse direction near the start boundary and the early
          // pin toggles on and off across it, re-parenting the section between
          // the pin-spacer and normal flow: the jump you feel arriving back at
          // scroll zero.
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressRef.current = self.progress
            const live = self.progress < RANGE_DARK
            setRangeLive((was) => (was === live ? was : live))
            const vid = self.progress > VIDEO_LIVE
            setVideoLive((was) => (was === vid ? was : vid))
            const inStudio = self.progress >= ACT2_IN[0] && self.progress < ACT2_OUT[1]
            const flag = inStudio ? 'studio' : ''
            if (document.body.dataset.heroAct !== flag) document.body.dataset.heroAct = flag
          },
        },
      })

      // ACT 1 → out. A lift and a fade, with no scale: act 1 flying at the
      // camera while act 2 flew in from behind it was two zooms crossing, which
      // is what made the handover feel like a jump cut.
      tl.to(copyRef.current, { opacity: 0, y: -34, duration: ACT1_OUT[1] - ACT1_OUT[0], ease: 'power2.inOut' }, ACT1_OUT[0])
      // Once it is invisible it must also stop catching clicks. This layer is a
      // full-screen z-20 sheet, so at opacity 0 it still sat over the studio and
      // swallowed every press — which is exactly why "Open the studio" did
      // nothing. Scrubbing back up restores it.
      tl.set(copyRef.current, { pointerEvents: 'none' }, ACT1_OUT[1])

      // The range keeps creeping the whole way — one slow continuous move under
      // everything, so the two acts feel like one shot rather than two slides.
      tl.to(rangeRef.current, { scale: 1.24, duration: RANGE_OUT[1] }, 0)
        .to(rangeRef.current, { opacity: RANGE_HELD, duration: RANGE_DIM[1] - RANGE_DIM[0] }, RANGE_DIM[0])
        .to(rangeRef.current, { opacity: 0, duration: RANGE_OUT[1] - RANGE_OUT[0] }, RANGE_OUT[0])

      // ACT 2 → in. The editor comes forward, then its parts settle in order:
      // board first, then the rails either side of it.
      // Barely any scale — it settles into place rather than rushing the lens.
      tl.fromTo(
        studioRef.current,
        { opacity: 0, scale: 0.965, y: 18 },
        { opacity: 1, scale: 1, y: 0, duration: ACT2_IN[1] - ACT2_IN[0], ease: 'power2.out' },
        ACT2_IN[0]
      )
      const panels = studioRef.current?.querySelectorAll('[data-studio-panel]')
      if (panels?.length) {
        tl.fromTo(
          panels,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 0.06, stagger: 0.035, ease: 'power2.out' },
          ACT2_IN[0] + 0.03
        )
      }
      // ── The edit session ───────────────────────────────────────────────
      // Everything below is the studio USED, scrubbed by scroll. Order matters:
      // guides first (the tool wakes up), then the mark draws, then the words
      // type, then the selection snaps on — because that is the order a person
      // works in, and the layer panel lights to confirm each step.
      const q = <T extends Element>(sel: string) => section.querySelector<T>(sel)
      const qa = (sel: string) => section.querySelectorAll<HTMLElement>(sel)

      const guides = qa('[data-snap-guide]')
      if (guides.length) {
        tl.fromTo(guides, { opacity: 0 }, { opacity: 1, duration: GUIDES_ON[1] - GUIDES_ON[0] }, GUIDES_ON[0])
          .to(guides, { opacity: 0.45, duration: 0.02 }, GUIDES_ON[1] + 0.02)
      }

      const mark = q<SVGPathElement>('[data-mark-path]')
      if (mark) {
        const len = mark.getTotalLength()
        gsap.set(mark, { strokeDasharray: len, strokeDashoffset: len })
        tl.to(mark, { strokeDashoffset: 0, duration: MARK_DRAW[1] - MARK_DRAW[0], ease: 'none' }, MARK_DRAW[0])
      }

      const artText = q<SVGTextElement>('[data-art-text]')
      if (artText) {
        const words = 'FEEL ALIVE'
        const type = { n: 0 }
        tl.to(
          type,
          {
            n: words.length,
            duration: TYPE_ON[1] - TYPE_ON[0],
            ease: 'none',
            onUpdate: () => {
              artText.textContent = words.slice(0, Math.round(type.n))
            },
          },
          TYPE_ON[0]
        )
      }

      const selection = q<SVGGElement>('[data-selection]')
      if (selection) {
        tl.fromTo(
          selection,
          { opacity: 0, scale: 0.96, transformOrigin: '50% 50%' },
          { opacity: 1, scale: 1, duration: SELECT_ON[1] - SELECT_ON[0], ease: 'back.out(2)' },
          SELECT_ON[0]
        )
      }

      const zoomEl = q<HTMLElement>('[data-zoom]')
      if (zoomEl) {
        const zoom = { v: 80 }
        tl.to(
          zoom,
          {
            v: 120,
            duration: ZOOM_TICK[1] - ZOOM_TICK[0],
            ease: 'none',
            onUpdate: () => {
              zoomEl.textContent = `${Math.round(zoom.v)}%`
            },
          },
          ZOOM_TICK[0]
        )
      }

      // The layer panel confirms each landing: ridge mark, then the text.
      const layerRows = qa('[data-layer-row]')
      if (layerRows.length >= 2) {
        gsap.set(layerRows, { opacity: 0.3 })
        tl.to(layerRows[1], { opacity: 1, duration: 0.02 }, MARK_DRAW[1])
          .to(layerRows[0], { opacity: 1, duration: 0.02 }, TYPE_ON[1])
      }

      // ACT 2 → out, past the lens like everything else — while night falls
      // behind it, so act 3 opens after dark.
      tl.to(
        studioRef.current,
        { opacity: 0, scale: 1.18, duration: ACT2_OUT[1] - ACT2_OUT[0], ease: 'power2.in' },
        ACT2_OUT[0]
      )

      // ACT 3 → in, dim — the day-arc lights it, not the entrance.
      tl.fromTo(
        mapRef.current,
        { opacity: 0, scale: 0.86 },
        { opacity: 1, scale: 1, duration: ACT3_IN[1] - ACT3_IN[0], ease: 'power2.out' },
        ACT3_IN[0]
      )
      // ── The loop ──────────────────────────────────────────────────────
      // Four beats, each one a thing the product actually does. Written
      // against refs found once, because a scrub that queries the DOM per
      // frame is a scrub that drops frames.
      const planCard = q<HTMLElement>('[data-plan-card]')
      if (planCard) {
        tl.fromTo(planCard, { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: PLAN_IN[1] - PLAN_IN[0], ease: 'power2.out' }, PLAN_IN[0])
      }

      // The people asking, one after another rather than as a block — the
      // point of the beat is that they arrive separately.
      const asks = qa('[data-ask-row]')
      if (asks.length) {
        const per = (ASKS_IN[1] - ASKS_IN[0]) / asks.length
        asks.forEach((row, i) => {
          tl.fromTo(row, { opacity: 0, x: -10 },
            { opacity: 1, x: 0, duration: per * 0.8, ease: 'power2.out' }, ASKS_IN[0] + i * per)
        })
      }

      // The host deciding. The asks resolve into a confirmed party, so the
      // dots fill and the roster line changes state.
      const partyDots = qa('[data-party-dot]')
      if (partyDots.length) {
        const per = (CONFIRM_IN[1] - CONFIRM_IN[0]) / partyDots.length
        partyDots.forEach((dot, i) => {
          tl.to(dot, { backgroundColor: '#7BA46F', borderColor: '#7BA46F', duration: per * 0.6 },
            CONFIRM_IN[0] + i * per)
        })
      }
      const decided = q<HTMLElement>('[data-decided]')
      if (decided) {
        tl.fromTo(decided, { opacity: 0 }, { opacity: 1, duration: 0.02 }, CONFIRM_IN[1] - 0.01)
      }

      // The meeting point. The one moment the product is built around, so it
      // gets the only reveal in the act: the redaction bar slides off it.
      const pointRow = q<HTMLElement>('[data-point-row]')
      const pointMask = q<HTMLElement>('[data-point-mask]')
      if (pointRow) {
        tl.fromTo(pointRow, { opacity: 0.35 }, { opacity: 1, duration: 0.02 }, POINT_IN[0])
      }
      if (pointMask) {
        tl.to(pointMask, { scaleX: 0, transformOrigin: '100% 50%',
          duration: POINT_IN[1] - POINT_IN[0], ease: 'power2.inOut' }, POINT_IN[0])
      }

      // The step caption, which names what you are watching. Without it the
      // sequence is pretty and unreadable.
      const steps = qa('[data-step]')
      if (steps.length === 4) {
        const marks = [PLAN_IN[0], ASKS_IN[0], CONFIRM_IN[0], POINT_IN[0]]
        steps.forEach((el, i) => {
          tl.to(el, { opacity: 1, duration: 0.012 }, marks[i])
          if (i < 3) tl.to(el, { opacity: 0, duration: 0.012 }, marks[i + 1])
        })
      }

      // The chapter rail — the quiet cue that this hero is chaptered.
      const chapters = qa('[data-chapter]')
      if (chapters.length === 3) {
        tl.to(chapters[0], { opacity: 0, duration: 0.04 }, CHAPTER_1TO2)
          .to(chapters[1], { opacity: 1, duration: 0.04 }, CHAPTER_1TO2)
          .to(chapters[1], { opacity: 0, duration: 0.04 }, CHAPTER_2TO3)
          .to(chapters[2], { opacity: 1, duration: 0.04 }, CHAPTER_2TO3)
      }

      return tl
    }

    const tl = build()

    return () => {
      document.body.dataset.heroAct = ''
      tl.scrollTrigger?.kill(true)
      tl.revert()
      tl.kill()
    }
  }, [reduceMotion, ambientMobile, garments])

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

  // Whether the descent runs at all. On touch and reduced-motion the timeline is
  // never built, so the summit hold has to start (and stay) fully visible and the
  // descent layers have to start hidden — hence static values rather than the
  // scrubbed ones. Kept off the render path otherwise: the timeline owns them.
  const staticHero = reduceMotion || ambientMobile



  return (
    <section
      ref={sectionRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative h-[100svh] overflow-hidden bg-[#101E17] select-none"
    >
      {/* Poster behind the canvas — first paint is instant regardless of GPU. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 72% 26%, rgba(185,211,240,0.13), transparent 60%), radial-gradient(ellipse 70% 45% at 26% 82%, rgba(123,164,111,0.09), transparent 65%), #101E17',
        }}
      />

      {/* ── The range ──────────────────────────────────────────────────────────
          Demoted, on purpose. It used to be the whole hero; it is now the room
          the product stands in. It holds the establishing frame, recedes while
          the rack comes past, and is gone by the time the door appears — and
          once it is gone we stop rendering it (`rangeLive`), so the back half of
          the hero costs no WebGL at all. */}
      <div ref={rangeRef} className="absolute inset-0">
        {mounted && (
          <div className={`absolute inset-0 transition-opacity duration-1000 ${sceneReady ? 'opacity-100' : 'opacity-0'}`}>
            <TerrainScene
              progressRef={progressRef}
              reduceMotion={reduceMotion}
              ambient={ambientMobile && !reduceMotion}
              segments={segments}
              treeCount={treeCount}
              active={inView && rangeLive}
              season={season}
              weather={weather}
              dragRef={dragRef}
              onReady={() => setSceneReady(true)}
            />
          </div>
        )}
      </div>

      {/* Two scrims doing two jobs: the horizontal one buys the copy column a
          legible ground on the left without flattening the ridgeline on the
          right; the vertical one seats the garments against the valley floor. */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#101E17] via-[#101E17]/45 to-transparent md:via-[#101E17]/15" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#101E17] via-transparent to-[#101E17]/55" />

      {/* ── ACT 1 — the brand ─────────────────────────────────────────────────
          Place, feeling, what we sell, and the way in. It cannot say everything,
          so it says the whole thing at low resolution: the range behind, the
          line, and the three blanks together as one composed row rather than a
          parade. Act 2 no longer carries product, so the commerce signal lives
          here — price and CTA included, before anyone scrolls. */}
      <div
        ref={copyRef}
        className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-10 lg:px-16"
      >
        {/* Two columns, because a single stack made the brand frame read as a
            list: line, line, three pictures, two buttons. The left column is the
            argument and the right is the evidence, which is how an editorial
            spread carries both without either shouting over the other. The
            blanks sit in a column of their own so the price list reads as a
            price list — scannable down the right edge — instead of as captions
            strung under a row. */}
        {/* Act 1 is one thing: the range, and a reason to be here.
            It used to be a two-column split with the three garments listed down
            the right — the catalogue arriving before anyone had looked at the
            mountain. The client's reference is the original centred frame, and
            it is the better call: the products get their own act moments later,
            and a hero that already sells is a hero nobody reads. */}
        {/* Three columns so the headline stays optically centred while the rail
            sits hard against the frame's left edge. Equal-width side columns are
            what guarantee that — a rail absolutely positioned over a centred
            column collides with it the moment the window narrows.
            `items-start` puts the rail high rather than beside the headline:
            level with the eyebrow, in the upper-left quiet of the frame, where
            it reads as an instrument on the scene instead of a caption on the
            type. */}
        <div className="flex w-full items-start">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center lg:-mt-2">
            <div className="flex flex-col items-center">
              <p data-summit-reveal className="invisible font-mono text-[10px] uppercase tracking-[0.28em] text-sage/85">
                Printed in Dehradun · 30.3165° N
              </p>

              <h1 className="mt-5 font-display text-[clamp(38px,5.6vw,80px)] font-light uppercase leading-[0.88] tracking-[-0.035em] text-paper">
                <span data-summit-reveal className="invisible block">Go where</span>
                <span data-summit-reveal className="invisible block italic text-sage">you feel alive.</span>
              </h1>

              {/* Repositioned per the client brief: the shop is not an expedition
                  outfitter. The line that stood here talked about heavyweight
                  blanks and printing, which reads as a supplier describing its
                  process; the brief asks for apparel and everyday essentials that
                  happen to be mountain-inspired. */}
              <p data-summit-reveal className="invisible mt-6 max-w-sm font-body text-sm leading-relaxed text-paper/70 md:text-base">
                Inspired by mountains. Made for everyday journeys.
                Apparel and drinkware, printed one at a time with your design on it.
              </p>

              <div data-summit-reveal className="invisible mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <Link
                  href="/customize"
                  className="inline-flex items-center gap-2 rounded-full bg-paper px-7 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
                >
                  Design yours <span aria-hidden="true">↗</span>
                </Link>
                <Link
                  href="/shop"
                  className="border-b border-paper/25 pb-1 font-body text-[11px] uppercase tracking-[0.14em] text-paper/65 transition-colors duration-300 hover:text-paper"
                >
                  {fromPrice ? `Shop the drop — from ${fromPrice}` : 'Shop the drop'}
                </Link>
              </div>

              {/* Between 768px and the rail's breakpoint the frame is too narrow
                  for a side column, so the picker folds back into the stack —
                  below the call to action, where it cannot push the headline
                  down. Same ticks, laid on their side. */}
              {weather && (
                <div
                  data-summit-reveal
                  className="invisible mt-10 flex items-center gap-4 lg:hidden"
                  role="group"
                  aria-label="Weather on the range"
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/40">
                    Change the weather
                  </span>
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeason(s)}
                      aria-pressed={season === s}
                      className={`font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-300 ${
                        season === s
                          ? 'border-b border-sage pb-0.5 text-sage'
                          : 'border-b border-transparent pb-0.5 text-paper/45 hover:text-paper/85'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Balances the rail so the column above stays centred in the frame. */}
          <div aria-hidden="true" className="hidden w-[176px] shrink-0 lg:block" />

          {/* Last in the DOM, first in the layout. The intro staggers on document
              order, so putting the rail here lets the headline lead and the
              control arrive after it — while `order-first` keeps it on the left. */}
          <div className="order-first hidden w-[176px] shrink-0 lg:block">
            {weather && <WeatherRail season={season} onPick={setSeason} />}
          </div>
        </div>

      </div>

      {/* ── ACT 2 — the studio ────────────────────────────────────────────────
          A real editor shows the garment, so this one does: the blank IS the
          canvas, lit on its own seamless, with the print boundary on its chest
          and the tools racked either side. The previous pass floated an abstract
          artboard in a void — no ground, no product, nothing to judge the design
          against. You cannot show a customiser without showing the thing being
          customised. Everything here is scrubbed: guides wake, the mark draws,
          the words type, the layers confirm, the selection snaps on. */}
      {!staticHero && (
        <div
          ref={studioRef}
          className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center px-6 opacity-0"
        >
          {/* The room. A pool of light behind the bench so the panels sit on
              something rather than hanging in black. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                // Translucent, so the range still reads behind the bench. Opaque
                // here was what made act 2 arrive as a screen dropping over the
                // world instead of a table set down inside it.
                'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(233,238,228,0.10), transparent 68%), linear-gradient(180deg, rgba(10,17,13,0.86) 0%, rgba(7,12,9,0.94) 100%)',
            }}
          />

          <div className="relative w-full max-w-5xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-sage">The studio</span>
                </div>
                <h2 className="mt-3.5 font-display text-[clamp(24px,2.7vw,40px)] font-light leading-[1.04] text-paper">
                  A studio, not an <span className="italic text-sage">upload box.</span>
                </h2>
              </div>
              <div className="flex max-w-[19rem] flex-col items-start gap-4">
                <p className="font-body text-[12px] leading-relaxed text-paper/50">
                  Type, artwork, layers, front and back — set to the millimetre and
                  previewed on the garment before anything is printed.
                </p>
                {/* The act showed the tool and gave no way to reach it. This is
                    that way in, and it is `pointer-events-auto` because the layer
                    above it is inert by default. */}
                <Link
                  href="/customize"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 font-body text-[10px] uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
                >
                  Open the studio <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[156px_minmax(0,1fr)_176px]">
              {/* Type + ink. */}
              <div data-studio-panel className="hidden origin-right rounded-sm border border-paper/12 bg-ink/55 p-3 backdrop-blur-sm lg:block">
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper/35">Type</div>
                <div className="mt-2 space-y-1">
                  {['Fraunces', 'Archivo', 'Space Mono'].map((f, i) => (
                    <div key={f} className={`rounded-sm px-2 py-1.5 font-body text-[11px] ${i === 0 ? 'bg-paper/10 text-paper' : 'text-paper/45'}`}>
                      {f}
                    </div>
                  ))}
                </div>
                <div className="mt-4 font-mono text-[8px] uppercase tracking-[0.2em] text-paper/35">Ink</div>
                <div className="mt-2 flex gap-1.5">
                  {['#FBF7EF', '#7BA46F', '#C2662A', '#101512'].map((hex, i) => (
                    <span key={hex} className={`h-5 w-5 rounded-full border ${i === 0 ? 'border-sage' : 'border-paper/20'}`} style={{ background: hex }} />
                  ))}
                </div>
                <div className="mt-4 border-t border-paper/10 pt-3 font-mono text-[8px] uppercase tracking-[0.16em] text-paper/30">
                  Print · DTG
                </div>
              </div>

              {/* The bench: the garment, being worked on. */}
              <div data-studio-panel className="relative origin-center overflow-hidden rounded-sm border border-paper/12 bg-[#0B120E]">
                <div className="flex items-center justify-between border-b border-paper/10 px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="rounded-sm bg-paper px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-ink">Front</span>
                    <span className="px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-paper/40">Back</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.12em] text-paper/40 tabular-nums">
                    <span>300 DPI</span>
                    <span data-zoom>80%</span>
                  </div>
                </div>

                <div className="relative mx-auto h-[46vh] max-h-[420px] w-full">
                  {studioBlank && (
                    <Image
                      src={studioBlank.image}
                      alt={`${studioBlank.name} — being designed in the studio`}
                      fill
                      sizes="(min-width: 1024px) 640px, 90vw"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      className="object-contain"
                    />
                  )}

                  {/* Everything below is drawn on the garment's own chest, in the
                      same 4:5 space the photograph occupies, so the boundary and
                      the artwork sit where the press would actually put them. */}
                  <svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
                    <line data-snap-guide className="opacity-0" x1="50" y1="0" x2="50" y2="125" stroke="#7BA46F" strokeOpacity="0.9" strokeWidth="0.3" strokeDasharray="1.6 1.6" />
                    <line data-snap-guide className="opacity-0" x1="0" y1="58" x2="100" y2="58" stroke="#7BA46F" strokeOpacity="0.9" strokeWidth="0.3" strokeDasharray="1.6 1.6" />

                    <rect x="33" y="37" width="34" height="43" fill="none" stroke="#FBF7EF" strokeOpacity="0.5" strokeWidth="0.35" strokeDasharray="2 1.6" />

                    <path data-mark-path d="M39 60 L46 48 L51 56 L55 51 L61 60 Z" fill="none" stroke="#FBF7EF" strokeWidth="0.7" strokeLinejoin="round" />
                    <text data-art-text x="36.5" y="68" fontSize="3.4" letterSpacing="1.1" fill="#FBF7EF" style={{ fontFamily: 'var(--font-mono), monospace' }} />

                    <g data-selection className="opacity-0">
                      <rect x="35" y="44" width="30" height="27" fill="none" stroke="#7BA46F" strokeWidth="0.35" />
                      {[[35, 44], [65, 44], [35, 71], [65, 71]].map(([x, y]) => (
                        <rect key={`${x}-${y}`} x={x - 1} y={y - 1} width="2" height="2" fill="#7BA46F" />
                      ))}
                      <line x1="50" y1="44" x2="50" y2="39" stroke="#7BA46F" strokeWidth="0.35" />
                      <circle cx="50" cy="37.6" r="1.2" fill="none" stroke="#7BA46F" strokeWidth="0.35" />
                    </g>
                  </svg>
                </div>
              </div>

              {/* Layers. */}
              <div data-studio-panel className="hidden origin-left rounded-sm border border-paper/12 bg-ink/55 p-3 backdrop-blur-sm lg:block">
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper/35">Layers</div>
                <div className="mt-2 space-y-1">
                  {[
                    { n: 'Text — “FEEL ALIVE”', on: true, sel: true },
                    { n: 'Ridge mark', on: true, sel: false },
                    { n: 'Back print', on: false, sel: false },
                  ].map((l) => (
                    <div key={l.n} data-layer-row className={`flex items-center gap-2 rounded-sm px-2 py-1.5 ${l.sel ? 'bg-sage/15' : ''}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${l.on ? 'bg-sage' : 'bg-paper/20'}`} />
                      <span className={`truncate font-body text-[10px] ${l.on ? 'text-paper/80' : 'text-paper/30'}`}>{l.n}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-paper/10 pt-3 font-mono text-[8px] uppercase tracking-[0.16em] text-paper/35">
                  <span>Undo</span>
                  <span>Redo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Inside the print: Trek Buddy ──────────────────────────────────────
          The four things people go up there to do are really four times of day —
          the bird walk is at first light, the stargazers are out long after the
          trekkers are asleep. So the frame is a day, not a table: one axis from
          dawn to night, each activity standing at its hour with a tick down to
          the light it happens in. The gradient under it is the sky at that hour.

          This is the third pass at this beat. The first drew six identical
          contour rings (a bullseye, not topography) and lassoed four floating
          labels together. The second was an honest table but visually inert.
          A day reads instantly, carries real information, and is the one shape
          this brand already thinks in. */}
      {!staticHero && (
        <div
          ref={mapRef}
          className="pointer-events-none absolute inset-0 z-20 flex items-center opacity-0"
        >
          {/* The environment, and it is the argument: two people walking a ridge
              together, which is the entire product in one shot. Footage that was
              sitting unused in the repo. Muted, looped, and only decoded while
              this act is on screen — `videoLive` pauses it either side, so it
              costs nothing during acts 1 and 2. */}
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src="/videos/hero-trek.mp4"
            poster="/videos/hero-trek-poster.jpg"
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          />
          {/* Two scrims, two jobs. The first grades the whole clip to dusk so it
              belongs to this palette rather than to a stock library. The second is
              weighted left, where the copy and the board live — the sky in this
              footage is bright, and small mono type on it was unreadable. The
              right stays open so the walkers are still the thing you see. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(8,13,24,0.62) 0%, rgba(9,16,28,0.52) 45%, rgba(6,10,18,0.9) 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(6,10,18,0.94) 0%, rgba(6,10,18,0.86) 38%, rgba(6,10,18,0.42) 68%, rgba(6,10,18,0.2) 100%)',
            }}
          />

          {/* ONE composed frame, not four corners.
              The first pass put the headline top-left, the buttons floating
              mid-right, the step caption bottom-left and the card bottom-right
              — four things in four corners with a dead middle, and the caption
              four hundred pixels from the card it was narrating. Two columns
              on one vertical centre fixes all of it: the argument reads down
              the left, the product sits on the right, and the caption is
              attached to the thing it describes. */}
          <div className="relative mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)] lg:gap-16 lg:px-12">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-sage">
                  Trek Buddy
                </span>
              </div>

              <h2 className="mt-5 font-display text-[clamp(30px,3.6vw,50px)] font-light leading-[1.02] text-paper">
                Never go <span className="italic text-sage">alone.</span>
              </h2>

              <p className="mt-4 max-w-sm font-body text-[15px] leading-relaxed text-paper/75">
                Post the hour you are leaving. Whoever else is going that day finds you, and you
                decide who comes.
              </p>

              {/* The caption for the beat you are watching, on a rail so it
                  reads as narration of the card rather than as more copy. */}
              <div className="relative mt-9 h-[92px] max-w-sm border-l border-paper/25 pl-5">
                {[
                  ['01', 'Somebody posts a walk', 'The place, the hour, and how many can come.'],
                  ['02', 'People ask to come', 'Not a join button — a request, with a message.'],
                  ['03', 'The host decides', 'They pick the group they are spending the day with.'],
                  ['04', 'The meeting point unlocks', 'Only for the confirmed party, and only once it is big enough.'],
                ].map(([n, title, body]) => (
                  <div key={n} data-step className="absolute inset-x-0 top-0 pl-5 opacity-0" style={{ left: 0 }}>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper">
                      <span className="text-sage">{n}</span> · {title}
                    </p>
                    <p className="mt-2 font-body text-[13px] leading-relaxed text-paper/60">{body}</p>
                  </div>
                ))}
              </div>

              <div className="pointer-events-auto mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  href="/trek-buddy"
                  className="inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 font-body text-[10px] uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
                >
                  See the board <span aria-hidden="true">↗</span>
                </Link>
                <Link
                  href="/trek-buddy/people"
                  className="border-b border-paper/25 pb-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-paper/65 transition-colors duration-300 hover:text-paper"
                >
                  Who is out there
                </Link>
              </div>
            </div>

            {/* The card, and it is the point of the act, so it gets the size
                and the ground to hold its own against a bright photograph. */}
            <div ref={boardRef} className="min-w-0">
              <div
                data-plan-card
                className="flex overflow-hidden rounded-sm border border-paper/25 bg-ink/80 opacity-0 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl"
              >
                <span aria-hidden="true" className="w-1.5 shrink-0 bg-[#7FA471]" />
                <div className="min-w-0 flex-1 p-6">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[15px] text-[#9BC08C] tabular-nums">07:00</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55">
                      First light
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-[26px] leading-tight text-paper">
                    Nag Tibba
                  </h3>
                  <p className="mt-1.5 font-body text-[13px] text-paper/60">
                    Trekking · from Dehradun ISBT · back 16:00
                  </p>

                  <div className="mt-5 flex items-center gap-2.5">
                    <div className="flex">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          data-party-dot
                          // A ring in the card's own ground, so four filled
                          // circles overlapping still read as four people
                          // rather than as one green smear.
                          style={{
                            marginLeft: i === 0 ? 0 : -7,
                            boxShadow: '0 0 0 2px rgba(10,14,11,0.92)',
                          }}
                          className="h-6 w-6 rounded-full border border-dashed border-paper/40 bg-transparent"
                        />
                      ))}
                    </div>
                    <span
                      data-decided
                      className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#9BC08C] opacity-0"
                    >
                      4 going
                    </span>
                  </div>

                  <ul className="mt-5 space-y-2 border-t border-paper/15 pt-4">
                    {['Priya', 'Rahul', 'Sara'].map((who) => (
                      <li
                        key={who}
                        data-ask-row
                        className="flex items-center gap-2.5 font-body text-[13px] text-paper/70 opacity-0"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper/15 font-mono text-[10px] text-paper"
                        >
                          {who[0]}
                        </span>
                        {who} asked to come
                      </li>
                    ))}
                  </ul>

                  {/* The withheld line — the rule the product is built on,
                      stated as a picture rather than a sentence. */}
                  <div data-point-row className="mt-5 border-t border-paper/15 pt-4 opacity-40">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper/50">
                      Exact meeting point
                    </p>
                    <div className="relative mt-2 inline-block">
                      <p className="font-body text-[14px] text-paper">
                        Pantwari trailhead, by the forest gate
                      </p>
                      <span
                        data-point-mask
                        aria-hidden="true"
                        className="absolute -inset-x-1 inset-y-0 origin-right bg-paper/30"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The chapter rail — three stacked labels crossfading at the act cuts.
          The quiet cue that this hero is chaptered, and where you are in it. */}
      {!staticHero && (
        <div className="pointer-events-none absolute bottom-8 left-6 z-30 grid md:left-10">
          {['01 · The range', '02 · The studio', '03 · Trek Buddy'].map((c, i) => (
            <span
              key={c}
              data-chapter
              className={`[grid-area:1/1] font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40 ${
                i === 0 ? '' : 'opacity-0'
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {!reduceMotion && !staticHero && (
        <div
          data-summit-reveal
          className="invisible pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 font-body text-[9px] uppercase tracking-[0.2em] text-paper/40"
        >
          Scroll ↓
        </div>
      )}
    </section>
  )
}
