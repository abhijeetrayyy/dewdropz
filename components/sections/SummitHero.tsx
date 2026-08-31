'use client'

/* eslint-disable react-hooks/set-state-in-effect -- matchMedia/viewport reads are
   only available client-side; same established pattern as TerrainFlythrough. */

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL } from '@/lib/constants'
import AliveHeadline from '@/components/AliveHeadline'
import type { Collection, Product } from '@/types/database'
// From `lib/season`, NOT `./HeroWeather` — that module imports three.js and
// @react-three/fiber at module scope, so pulling one pure helper out of it put
// the whole engine in the initial document. See lib/season.ts.
import { resolveSeason, type Season } from '@/lib/season'
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
//   THE RANGE     the mountain, the promise, one line, one door. Nothing to
//                 scroll for; the shop is already legible.
//   THE RANGES    the collections, one plate each, arriving one at a time out
//                 of the same space. What there IS, before what you can do to
//                 it — this act was added because the film used to go straight
//                 from the brand to a design tool, handing somebody an editor
//                 before showing them anything to edit.
//   THE PRINT     a blank on a lit seamless, its print boundary drawing onto
//                 the chest — the customisation beat, at the structural centre
//                 of the move rather than as a bullet point beside it.
//   THE COMPANY   the camera reaches a ridge with two people on it. Trek Buddy,
//                 and the invitation. The loop closes: mountain → range →
//                 print → mountain.
//
/**
 * The garment colourways act 3's studio rail shows.
 *
 * HARDCODED ON PURPOSE. This is a hero — a scroll-scrubbed film that has to
 * paint at 60fps from the first frame — so it does not fetch the catalogue to
 * draw a 20px swatch. But it should not invent colours either, which is what it
 * was doing: the rail was labelled "Ink" and held #FBF7EF / #7BA46F / #C2662A /
 * #101512 — four brand tokens, none of them a garment colour, against a real
 * studio that offers three. So the film advertised a palette the customiser
 * does not have.
 *
 * These three are copied verbatim from what the backend serves today. All three
 * customizable products — custom-hoodie, custom-sweatshirt, custom-print-tee —
 * carry the identical set in `customization_config.colors`:
 *
 *   Jet Black     #2B2B2F   available: true
 *   Hunter Green  #355E4B   available: false
 *   Vanilla Ice   #E8E1D1   available: false
 *
 * TO RE-SYNC when the catalogue's colourways change, read them straight off the
 * API rather than guessing:
 *
 *   curl -s localhost:3010/api/products \
 *     | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['customization_config']['colors'])"
 *
 * The selected treatment mirrors CustomizerStudio's own colour rail: a sage
 * ring on the live one, a diagonal bar on the two that are not orderable yet.
 * The studio ALSO drops those two to 25% opacity; that is deliberately not
 * copied here. It works at 28px on the studio's light panel, but on a 20px dot
 * against near-black it turns #E8E1D1 into a mid grey — the frame would be
 * showing a colour the catalogue does not have, which is the exact fault this
 * constant was written to fix.
 */
const STUDIO_COLORWAYS = [
  { name: 'Jet Black', hex: '#2B2B2F', available: true },
  { name: 'Hunter Green', hex: '#355E4B', available: false },
  { name: 'Vanilla Ice', hex: '#E8E1D1', available: false },
] as const

/** The one the rail opens on — the only orderable colourway today. */
const STUDIO_COLOR_SELECTED = STUDIO_COLORWAYS.find((c) => c.available) ?? STUDIO_COLORWAYS[0]

/** How many blanks act 1 shows. */
const MAX_BLANKS = 3
/** How many collection plates act 2 racks up. Three is the catalogue today. */
const MAX_RANGES = 3

// FOUR acts, and the frames where each hands over to the next.
//
// One day, four acts. The through-line is light: act 1 is dawn on the range,
// act 2 is the collections in that first light, act 3 is the working day in the
// studio, act 4 is night — planning tomorrow's company. The background makes
// that arc literal (night falls during the studio's exit), so the acts read as
// hours of the same day rather than as four slides.
//
// ── WHY THE WHOLE BUDGET WAS RE-CUT ─────────────────────────────────────────
//
// The collections act is new and it goes SECOND, which is the one position that
// cannot be added to without moving everything: the studio and Trek Buddy each
// slide a whole act later. So rather than squeezing a fourth act into three
// acts' worth of scroll, the pin grew from +=180% to +=250% — the same distance
// per act as before, near enough — and every marker below was re-derived from
// scratch against the new normalised 0..1.
//
// The shape of each handover is unchanged and deliberate: the incoming act's IN
// starts BEFORE the outgoing act's OUT finishes, so the two cross-dissolve
// through each other rather than cutting. Those overlaps are the ~0.05 you can
// see between each pair below, and they are the reason this reads as one camera
// move instead of four.
//
// ── ACT 1 IS NOW TWICE AS LONG ──────────────────────────────────────────────
//
// It used to hold to 0.11 and be gone by 0.20 — half a screen of scroll for the
// frame that introduces the brand, and the shortest of the four. Worse, the
// range's zoom ran as ONE linear scale across the whole hero, so the part of it
// act 1 actually contained was 1.00 → 1.09: a move too small to read as a move.
// The brand frame looked static and then left.
//
// It now holds to 0.23 and hands over at 0.32 — near enough a full screen — and
// the zoom is cut in two so that the act-1 half COMPLETES at exactly the moment
// act 1 does (see RANGE_ZOOM_ACT1 below). The mountain arrives, settles, and
// only then does the story move on.
const ACT1_OUT = [0.23, 0.32] as const

// ── ACT 2 — the collections ────────────────────────────────────────────────
// The catalogue's top level, in the film, before the tool that customises it.
// The order matters and is the reason this act was asked for: a visitor met
// the brand (act 1) and was then handed a design editor (the old act 2) without
// ever being shown what there was to design ON. Ranges first, then the bench.
const ACT2_IN = [0.28, 0.37] as const
/** The three plates land one at a time rather than as a row appearing. */
const RANGES_IN = [0.37, 0.47] as const
const ACT2_OUT = [0.47, 0.535] as const

// ── ACT 3 — the studio ─────────────────────────────────────────────────────
// Not a screenshot of an editor — an edit session, scrubbed: guides flash on,
// the mark draws, the words type, the layer lights as each element lands, the
// selection snaps on last, the zoom readout ticks up.
const ACT3_IN = [0.545, 0.615] as const
const GUIDES_ON = [0.625, 0.65] as const
const MARK_DRAW = [0.645, 0.705] as const
const TYPE_ON = [0.71, 0.765] as const
const SELECT_ON = [0.765, 0.79] as const
const ZOOM_TICK = [0.625, 0.77] as const
const ACT3_OUT = [0.79, 0.85] as const

// ── ACT 4 — Trek Buddy ─────────────────────────────────────────────────────
// Act 4's footage decodes only while it is on screen.
const VIDEO_LIVE = 0.78
const ACT4_IN = [0.86, 0.915] as const
// ACT 4 is one moment, not a lesson.
//
// It has been three other things: a day-arc of four columns, then a scrubbed
// walkthrough of the product's loop, then that walkthrough with a progress
// spine. Each was more informative than the last and each was wrong for the
// same reason — a hero act is a few seconds of scroll, and this one was
// carrying a headline, a lede, four numbered steps, two buttons and a card of
// 13px detail. It also wore the studio's exact layout, left copy against a
// right panel, so the film had two identical frames in it.
//
// The explaining now happens further down the page, where TrekBuddyBand has
// the room to do it properly. So this returns to the hero's own stated rule:
// one thing at a time. Centred, like act one — and with the collections act
// now sitting second, the film alternates rather than repeating a composition:
//   centred type → a rack of plates → an offset workbench → centred type.
const ACT4_COPY = [0.91, 0.97] as const

/**
 * Which act holds the frame, as published on `<body data-hero-act>`.
 *
 * NavBar reads that attribute and lights the matching door, so these strings
 * are an interface, not a local enum — '' means act 1, which owns no nav link.
 */
export type HeroAct = '' | 'collections' | 'studio' | 'trek'

const CHAPTER_1TO2 = 0.30
const CHAPTER_2TO3 = 0.53
const CHAPTER_3TO4 = 0.85
// The range does not leave between acts. It dims to a held level and stays
// there as the room acts 2 and 3 are standing in — cutting to black and zooming
// a panel at the camera was the "sudden change": two moves at once, and a void
// between them. It only goes fully dark once act 4's footage is ready to
// replace it, which is now two acts later than it used to be: the collections
// plates want the ridge behind them as much as the workbench does.
// Tracks act 1's exit rather than leading it. At [0.09, 0.24] against the old
// cut this was roughly act 1's own window; against the longer act 1 it would
// have started dimming the mountain a fifth of the way into the brand story,
// with the headline still at full opacity on top of a range going dark.
const RANGE_DIM = [0.21, 0.36] as const
/** What the range holds at behind the plates and the bench — present, not competing.
 *
 * Was 0.26, which did not clear the bar its own comment sets. Against the near
 * black the acts sit on, a quarter-opacity range is not "present" — it is a
 * muddy smear that reads as an empty screen, and it became obvious once the
 * act-2 → act-3 handover was retimed to pass THROUGH the range rather than
 * dissolving one dense layout into another: that beat is now a frame of pure
 * mountain, and at 0.26 the frame looked broken. At 0.38 the ridge line, the
 * treeline and the dawn band behind the summit all actually read, and the acts
 * still sit clearly in front of it. */
const RANGE_HELD = 0.38
const RANGE_OUT = [0.72, 0.83] as const
const RANGE_DARK = 0.85

// ── THE ZOOM, IN TWO HALVES ────────────────────────────────────────────────
//
// One linear `scale: 1.24` across the whole hero meant act 1 only ever showed
// the first tenth of it. Cutting it in two gives act 1 a move with a beginning
// and an end: the range pushes from 1 to RANGE_ZOOM_ACT1 and settles there
// exactly as the brand frame hands over — eased, so it arrives rather than
// stopping dead (see the seam note below) — and then resumes a slow linear
// creep to RANGE_ZOOM_END underneath the three acts that follow. Same total
// travel, but the half a visitor is
// looking at while they read the headline is now the half that reads.
const RANGE_ZOOM_ACT1 = 1.16
const RANGE_ZOOM_END = 1.30

// ── AND THE SEAM BETWEEN THEM ──────────────────────────────────────────────
//
// The same hitch TerrainScene's `pathLerp` was rewritten to remove, in the CSS
// layer this time. `power1.out` has a derivative of zero at its end, so the
// zoom decelerated to a dead stop exactly at act 1's handover — and the second
// half is linear, so it departed at a constant, non-zero rate from its very
// first frame. The range halted and then re-started, in one frame, at the seam,
// in both scroll directions.
//
// Fixed the way the camera was: a cubic Hermite that still leaves the summit
// from rest (act 1's push-off is the whole point of splitting the zoom) but
// ARRIVES travelling at exactly the speed the second half departs at.
//
// `rangeZoomEase` builds that curve from the constants rather than baking in a
// number, so moving an act boundary or a zoom target cannot silently reopen
// the seam. `m` is the arrival velocity in the eased 0..1 space; the h11 term
// of a Hermite carries it, and h10 is dropped because the departure tangent is
// zero. Clamped because a tangent above 3 would make the curve non-monotonic —
// the range would zoom backwards near the seam, which is worse than the hitch.
function rangeZoomEase(act1End: number, tailEnd: number) {
  const tailRate = (RANGE_ZOOM_END - RANGE_ZOOM_ACT1) / (tailEnd - act1End)
  const m = clampRange((tailRate * act1End) / (RANGE_ZOOM_ACT1 - 1), 0, 2)
  return (t: number) => (3 - m) * t * t - (2 - m) * t * t * t
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

const SEASONS = ['clear', 'fog', 'rain', 'snow'] as const

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
// set, with the live condition marked and named.
export default function SummitHero({
  products = [],
  collections = [],
}: {
  products?: Product[]
  /** The catalogue's top level, and act 2's entire content. Was declared here
   *  and never destructured — the homepage has always passed it and the hero
   *  has always thrown it away. */
  collections?: Collection[]
}) {
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
  const rangesRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  // Flipped twice in a whole scroll, not per frame: once the range has faded out
  // there is no reason to keep a WebGL loop running behind an opaque frame.
  const [rangeLive, setRangeLive] = useState(true)
  const [videoLive, setVideoLive] = useState(false)
  /** Which act holds the frame. Already published to document.body for the
   *  nav; mirrored into state because the three hidden acts need `inert`
   *  toggled in the render tree, and a body dataset attribute cannot do that. */
  const [heroAct, setHeroAct] = useState<HeroAct>('')
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

  // The blank on the bench in act 3 — the cheapest, because it is the one most
  // people will actually print on.
  //
  // This used to be `garments[garments.length - 1]`: the cheapest of the top
  // three by price. That was correct only while every product in the catalogue
  // was a blank. List one finished, already-printed garment and it does two
  // things at once — pushes the real blank out of the three-item slice, and
  // takes its place on the bench. The studio act then opens on a tee that has
  // already been printed, under a caption saying it is being designed.
  //
  // So: the cheapest product that can ACTUALLY be printed on. And prefer the
  // colourway's own mockup to images[0] — that is the bare-garment shot the
  // studio itself draws on, whereas images[0] is whatever photograph admin put
  // first, which for a finished product is the printed one.
  const studioBlank = useMemo(() => {
    const blank = [...products]
      .filter((p) => p.is_customizable && (p.customization_config?.colors?.length ?? 0) > 0)
      .sort((a, b) => a.price - b.price)[0]
    if (!blank) return null
    const colour = blank.customization_config?.colors?.find((c) => c.available && c.front)
    const image = colour?.front?.mockupImage ?? blank.images?.[0]
    return image ? { slug: blank.slug, name: blank.name, price: blank.price, image } : null
  }, [products])

  // ── ACT 2's content ────────────────────────────────────────────────────────
  //
  // Whatever collections actually exist, in their admin-set sort order, with
  // their real taglines. Nothing here is a hardcoded list of three: a renamed
  // or retired collection can never leave a ghost on the front door, and a
  // catalogue with none simply skips the act (see `hasRanges` below) rather
  // than holding a quarter of the hero open on an empty rack.
  //
  // Capped at MAX_RANGES because this is a film frame, not a grid — four plates
  // at this size stop being a rack and start being a page.
  const ranges = useMemo(
    () => collections.filter((c) => c.image_url).slice(0, MAX_RANGES),
    [collections]
  )
  const hasRanges = ranges.length > 0

  /** The chapter rail's labels, numbered to match what is actually on screen. */
  const chapterLabels = useMemo(
    () =>
      (hasRanges
        ? ['The range', 'The ranges', 'The studio', 'Trek Buddy']
        : ['The range', 'The studio', 'Trek Buddy']
      ).map((label, i) => `${String(i + 1).padStart(2, '0')} · ${label}`),
    [hasRanges]
  )


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
  //
  // BOUNDED, AND ONLY WHILE NOBODY IS SCROLLING. This nudge works by side
  // effect: a synthetic `resize` does not change any layout, so R3F's own
  // ResizeObserver ignores it — what actually re-measures the canvas is
  // ScrollTrigger reacting to the event and re-laying out the pin spacer. That
  // makes every tick of this interval a potential ScrollTrigger refresh, and it
  // used to fire up to twenty of them across the first 2.4 seconds. A refresh
  // that lands while somebody is already scrolling through the hero moves the
  // ground under them, which is exactly the unasked-for movement being removed.
  //
  // So: eight tries instead of twenty, and only while the visitor is still at
  // the top of the page. Once they have scrolled, the pin has engaged and the
  // canvas has been measured anyway — the nudge has nothing left to fix and
  // everything to disturb.
  useEffect(() => {
    if (!mounted || reduceMotion || ambientMobile) return
    let tries = 0
    const id = window.setInterval(() => {
      const canvas = sectionRef.current?.querySelector('canvas')
      if (canvas && canvas.clientWidth > 300) {
        window.clearInterval(id)
        return
      }
      if (window.scrollY > 4) {
        window.clearInterval(id)
        return
      }
      if (canvas) window.dispatchEvent(new Event('resize'))
      if (++tries > 8) window.clearInterval(id)
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

  // ── The headline entrance is no longer JavaScript's business ─────────────
  //
  // What stood here: a gsap.fromTo over `[data-summit-reveal]`, gated on
  // `introDone`, animating `autoAlpha` from 0 with a 0.26s stagger across five
  // elements at 1.2s each. Those five shipped `class="invisible"` in the
  // server HTML, so until this effect ran there were no words on the page at
  // all — 3.79s to the last call to action on mobile, with the <h1> ineligible
  // for Largest Contentful Paint the whole time, and a permanently blank hero
  // if the chunk holding GSAP never arrived.
  //
  // It is a CSS keyframe now (`hero-in` in globals.css, gated on
  // prefers-reduced-motion), which needs no class on <html>, no inline script,
  // no hydration suppression and no dead-man timer — all of which the first
  // attempt at this fix required, to protect a stagger.
  //
  // `data-summit-reveal` stays on the elements only as a marker; nothing reads
  // it any more. `data-hero-reveal` is what the stylesheet animates.

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
    // `weather` is re-sampled alongside the consumption mode, not only on mount.
    // Both describe the same thing — whether the scene this control drives is
    // actually running — and sampling one of them once meant the control could
    // outlive the scene: narrow a desktop window past the breakpoint and four
    // buttons stayed on screen wired to a WebGL canvas that had unmounted.
    const onChange = () => {
      const mobile = isTouchConsumption()
      setAmbientMobile(mobile)
      setWeather(!mobile)
    }
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
          // 4.4 viewport-heights of pinned scroll, cut to 1.8 on the council's
          // recommendation, then 2.5 for the fourth act, and now 3.0 to buy
          // act 1 the length it was asked for. Every act is at least as long
          // as it was at 2.5 and act 1 is nearly twice as long:
          //
          //   act 1  0.50 → 0.96 screens        act 3  1.00 → 1.05
          //   act 2  0.72 → 0.81               act 4  0.45 → 0.50
          //
          // The objection that retired 4.4 — a long pin with nothing clickable
          // inside it — no longer applies: three of the four acts now carry
          // real links, and act 2 alone carries four.
          // `+=300%` resolves against viewport height.
          end: '+=300%',
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
          // NO `invalidateOnRefresh`. It was here, and on a scrubbed timeline
          // it is a trap.
          //
          // `invalidate()` throws away every recorded start value so they get
          // re-read from the DOM. On a timeline that is scrubbed rather than
          // played, "the DOM" at refresh time is whatever the CURRENT scroll
          // position has already animated things to — so every tween that has
          // finished re-records its start as its own end value and becomes a
          // no-op, and every tween mid-flight re-records a start it never had.
          //
          // Two of those land squarely on the range:
          //
          //   .to(range, { opacity: RANGE_HELD }, …)   refresh at progress 0.5
          //     re-records start 0.26, so scrolling back to act 1 leaves the
          //     mountain dimmed instead of returning it to full.
          //   .to(range, { scale: RANGE_ZOOM_END }, …) re-records start 1.205,
          //     which then disagrees with the fromTo before it about where the
          //     scale is at the handover — and the range snaps across the gap.
          //
          // A refresh fires on every window resize AND on every route change
          // (LenisProvider does one so it can restore Back/Forward scroll), so
          // this went off precisely when somebody came back to the page and
          // scrolled up — the reported symptom.
          //
          // Nothing in this timeline needs it: every value here is an opacity,
          // a scale, a pixel offset or an SVG user-unit length, none of which
          // are derived from viewport size. ScrollTrigger recalculates its own
          // start/end on refresh regardless of this flag, so `+=300%` still
          // re-resolves against the new viewport height.
          onUpdate: (self) => {
            progressRef.current = self.progress
            const live = self.progress < RANGE_DARK
            setRangeLive((was) => (was === live ? was : live))
            const vid = self.progress > VIDEO_LIVE
            setVideoLive((was) => (was === vid ? was : vid))
            // Which act is holding the frame, published on <body> so the nav
            // can light the door that matches it — Collections, Customize and
            // Trek Buddy each own one, so the header answers the hero the whole
            // way through instead of sitting inert.
            //
            // Tested in reverse order (latest act first) because the windows
            // deliberately overlap at the cross-dissolves: during 0.45–0.49
            // both the collections and the studio are partly on screen, and the
            // act that is ARRIVING is the one the nav should be pointing at.
            const p = self.progress
            const flag: HeroAct =
              p >= ACT4_IN[0] ? 'trek'
              : p >= ACT3_IN[0] ? 'studio'
              : hasRanges && p >= ACT2_IN[0] && p < ACT3_IN[0] ? 'collections'
              : ''
            if (document.body.dataset.heroAct !== flag) document.body.dataset.heroAct = flag
            setHeroAct((was) => (was === flag ? was : flag))
          },
        },
      })

      // ── When act 2 is not there ─────────────────────────────────────────
      // A catalogue with no collections renders no act 2, and act 1 leaving on
      // schedule would then open a quarter of the hero onto nothing: the brand
      // gone at 0.20 and the workbench not arriving until 0.45. So act 1 holds
      // through the empty window instead and hands straight to the studio, and
      // the range holds its full brightness for exactly as long as act 1 does.
      // Nothing changes for a normal catalogue — both fall through to the
      // constants above.
      const a1Out = hasRanges ? ACT1_OUT : ([ACT3_IN[0] - 0.09, ACT3_IN[0]] as const)
      const dim = hasRanges ? RANGE_DIM : ([ACT3_IN[0] - 0.12, ACT3_IN[0] + 0.04] as const)

      // ACT 1 → out. A lift and a fade, with no scale: act 1 flying at the
      // camera while act 2 flew in from behind it was two zooms crossing, which
      // is what made the handover feel like a jump cut.
      tl.to(copyRef.current, { opacity: 0, y: -34, duration: a1Out[1] - a1Out[0], ease: 'power2.inOut' }, a1Out[0])
      // Once it is invisible it must also stop catching clicks. This layer is a
      // full-screen z-20 sheet, so at opacity 0 it still sat over the studio and
      // swallowed every press — which is exactly why "Open the studio" did
      // nothing. Scrubbing back up restores it.
      tl.set(copyRef.current, { pointerEvents: 'none' }, a1Out[1])

      // Hoisted above act 2, which needs `qa` for its plates. These were declared
      // in the middle of the studio's block back when the studio was the only
      // act that queried the DOM.
      const q = <T extends Element>(sel: string) => section.querySelector<T>(sel)
      const qa = (sel: string) => section.querySelectorAll<HTMLElement>(sel)

      // THE ZOOM. Act 1's half arrives and settles on act 1's own exit; the
      // rest creeps on underneath the acts that follow, so the whole hero is
      // still one continuous move rather than four slides.
      tl.fromTo(
        rangeRef.current,
        { scale: 1 },
        { scale: RANGE_ZOOM_ACT1, duration: a1Out[1], ease: rangeZoomEase(a1Out[1], RANGE_OUT[1]) },
        0
      )
        .to(
          rangeRef.current,
          { scale: RANGE_ZOOM_END, duration: RANGE_OUT[1] - a1Out[1] },
          a1Out[1]
        )
        .to(rangeRef.current, { opacity: RANGE_HELD, duration: dim[1] - dim[0] }, dim[0])
        .to(rangeRef.current, { opacity: 0, duration: RANGE_OUT[1] - RANGE_OUT[0] }, RANGE_OUT[0])

      // ── ACT 2 → in. The collections. ────────────────────────────────────
      // The masthead settles first and the plates come after it, because the
      // frame has to say what you are looking at before it hands you three
      // things to choose between.
      //
      // Guarded on `hasRanges`: with no collections in the catalogue this act
      // is not rendered at all, and building a timeline against nulls would
      // leave a quarter of the hero as an empty hold.
      if (hasRanges) {
        tl.fromTo(
          rangesRef.current,
          { opacity: 0, scale: 0.97, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: ACT2_IN[1] - ACT2_IN[0], ease: 'power2.out' },
          ACT2_IN[0]
        )

        // The plates arrive one at a time out of the same space — the hero's
        // founding rule is NOTHING ARRIVES from an edge, so they rise and
        // resolve where they already were rather than sliding in from the
        // right. The stagger is what makes three pictures read as a rack being
        // laid out rather than a row switching on.
        const plates = qa('[data-range-plate]')
        if (plates.length) {
          const span = RANGES_IN[1] - RANGES_IN[0]
          const per = span / (plates.length + 1)
          plates.forEach((el, i) => {
            tl.fromTo(
              el,
              { opacity: 0, y: 34, scale: 0.94 },
              { opacity: 1, y: 0, scale: 1, duration: per * 1.9, ease: 'power3.out' },
              RANGES_IN[0] + i * per
            )
          })
        }

        // ACT 2 → out, past the lens, the same exit the studio takes — so the
        // two middle acts leave the same way and the film keeps one grammar.
        //
        // The fade and the scale are two tweens on purpose, because they want
        // opposite curves. `power2.in` is right for the SCALE — it accelerates,
        // which is what "past the lens" means. It was badly wrong for the
        // OPACITY: an ease-in holds near 1 for most of its span, so act 2 was
        // still at ~85% when the studio began arriving on top of it, and the
        // two dense layouts crossed at ~0.53/0.57 — a double exposure of the
        // collections rack over the workbench, both illegible. Measured, not
        // guessed. The fade now uses `power2.out`: it clears fast and tails
        // off, so the frame belongs to one act at a time and the acts hand over
        // through the range holding behind them — which is what the range is
        // there for.
        tl.to(
          rangesRef.current,
          { opacity: 0, duration: ACT2_OUT[1] - ACT2_OUT[0], ease: 'power2.out' },
          ACT2_OUT[0]
        )
        tl.to(
          rangesRef.current,
          { scale: 1.14, duration: ACT2_OUT[1] - ACT2_OUT[0], ease: 'power2.in' },
          ACT2_OUT[0]
        )
      }

      // ACT 3 → in. The editor comes forward, then its parts settle in order:
      // board first, then the rails either side of it.
      // Barely any scale — it settles into place rather than rushing the lens.
      tl.fromTo(
        studioRef.current,
        { opacity: 0, scale: 0.965, y: 18 },
        { opacity: 1, scale: 1, y: 0, duration: ACT3_IN[1] - ACT3_IN[0], ease: 'power2.out' },
        ACT3_IN[0]
      )
      const panels = studioRef.current?.querySelectorAll('[data-studio-panel]')
      if (panels?.length) {
        tl.fromTo(
          panels,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 0.06, stagger: 0.035, ease: 'power2.out' },
          ACT3_IN[0] + 0.03
        )
      }
      // ── The edit session ───────────────────────────────────────────────
      // Everything below is the studio USED, scrubbed by scroll. Order matters:
      // guides first (the tool wakes up), then the mark draws, then the words
      // type, then the selection snaps on — because that is the order a person
      // works in, and the layer panel lights to confirm each step.

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

      // ACT 3 → out, past the lens like everything else — while night falls
      // behind it, so act 4 opens after dark.
      tl.to(
        studioRef.current,
        { opacity: 0, duration: ACT3_OUT[1] - ACT3_OUT[0], ease: 'power2.out' },
        ACT3_OUT[0]
      )
      tl.to(
        studioRef.current,
        { scale: 1.18, duration: ACT3_OUT[1] - ACT3_OUT[0], ease: 'power2.in' },
        ACT3_OUT[0]
      )

      // ACT 4 → in, dim — the day-arc lights it, not the entrance.
      tl.fromTo(
        mapRef.current,
        { opacity: 0, scale: 0.86 },
        { opacity: 1, scale: 1, duration: ACT4_IN[1] - ACT4_IN[0], ease: 'power2.out' },
        ACT4_IN[0]
      )
      // The invitation arrives in order — eyebrow, headline, line, door —
      // the same unhurried stagger act one opens with, so the hero closes the
      // way it began.
      const act4 = qa('[data-act4]')
      if (act4.length) {
        const span = ACT4_COPY[1] - ACT4_COPY[0]
        const per = span / (act4.length + 1)
        act4.forEach((el, i) => {
          tl.fromTo(el, { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: per * 1.8, ease: 'power3.out' },
            ACT4_COPY[0] + i * per)
        })
      }

      // ── The chapter rail ───────────────────────────────────────────────
      // The quiet cue that this hero is chaptered, and where you are in it.
      //
      // It used to hardcode `=== 3` and drive three labels by hand. With a
      // fourth chapter — and an act 2 that stands down when there are no
      // collections — that would have been two more hand-written crossfades
      // and a silent no-op the day the catalogue emptied. It is a loop now:
      // whatever labels the rail actually rendered are crossfaded at the
      // boundaries the rail itself published, so the two cannot disagree.
      const chapters = qa('[data-chapter]')
      const cuts = hasRanges
        ? [CHAPTER_1TO2, CHAPTER_2TO3, CHAPTER_3TO4]
        : [CHAPTER_2TO3, CHAPTER_3TO4]
      if (chapters.length === cuts.length + 1) {
        cuts.forEach((at, i) => {
          tl.to(chapters[i], { opacity: 0, duration: 0.04 }, at)
            .to(chapters[i + 1], { opacity: 1, duration: 0.04 }, at)
        })
      }

      return tl
    }

    const tl = build()

    return () => {
      document.body.dataset.heroAct = ''
      setHeroAct('')
      tl.scrollTrigger?.kill(true)
      tl.revert()
      tl.kill()
    }
    // `ranges` as well as `garments`: the timeline queries act 2's plates out
    // of the DOM and staggers them, so it has to be rebuilt when that list
    // changes — otherwise a collection arriving would render a plate the
    // timeline never learned about, which stays at opacity 0 forever.
    // `hasRanges` is derived from `ranges` and so can never be stale on its
    // own; it is listed because the effect reads it and a dependency array
    // that quietly omits what it reads is the one that goes wrong later.
  }, [reduceMotion, ambientMobile, garments, ranges, hasRanges])

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
      className="on-dark relative h-[100svh] overflow-hidden bg-[#101E17] select-none"
    >
      {/* Poster behind the canvas — first paint is instant regardless of GPU.
          On a phone and for every reduced-motion visitor it is not a poster at
          all: it is the whole background, because the WebGL scene never mounts.

          It contained no warm pixel. A brand whose hero is first light on a
          mountain rendered, for most of its visitors, as a cold blue wash on
          near-black — and on desktop the arrival of the scene was a cut from
          cold to warm rather than a resolve. The dawn ellipse below is
          rgba(227,155,63) = `--dawn` #E39B3F, written out because this is an
          inline style outside Tailwind's reach; globals.css is the source of
          truth for the value. Its position is taken from the render rather than
          invented — DawnGlow sits to the right of frame and the sky shader's
          horizon at first light is #D19A5C — and it is held at 0.20 alpha
          because above roughly 0.22 it stops reading as a horizon and starts
          reading as a lens flare. The peak sits at 74% x so it stays clear of
          the centred column. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 62% 34% at 74% 47%, rgba(227,155,63,0.20), rgba(227,155,63,0.05) 45%, transparent 72%), radial-gradient(ellipse 90% 60% at 72% 20%, rgba(185,211,240,0.10), transparent 60%), radial-gradient(ellipse 70% 45% at 26% 82%, rgba(123,164,111,0.09), transparent 65%), #101E17',
        }}
      />

      {/* ── The range ──────────────────────────────────────────────────────────
          Demoted, on purpose. It used to be the whole hero; it is now the room
          the product stands in. It holds the establishing frame, recedes while
          the rack comes past, and is gone by the time the door appears — and
          once it is gone we stop rendering it (`rangeLive`), so the back half of
          the hero costs no WebGL at all. */}
      <div ref={rangeRef} className="absolute inset-0">
        {/* ── Who actually gets the mountain ───────────────────────────────
            This condition was one word: `mounted`. No `!ambientMobile`, no
            `!reduceMotion`. So a phone downloaded the engine, mounted a WebGL
            renderer and rendered a full-screen backing store in order to drive
            a camera whose scroll progress never moves — the ScrollTrigger that
            drives it returns early on touch. The scene was built at full cost
            and then held on frame one, for the devices least able to afford it.
            The gradient poster above is what those visitors get instead, and
            it is what they were effectively looking at anyway. */}
        {mounted && !ambientMobile && !reduceMotion && (
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
              // The camp burns for the whole of act 1 and goes out as act 1
              // does — one window, declared once, rather than a 0.4 buried in
              // the scene that had to be remembered every time act 1 moved.
              dawnFrom={ACT1_OUT[0]}
              dawnTo={ACT1_OUT[1]}
              onReady={() => setSceneReady(true)}
            />
          </div>
        )}
      </div>

      {/* Two scrims doing two jobs: this one buys the copy a legible ground, the
          vertical one below seats the garments against the valley floor.

          This was a LEFT-TO-RIGHT gradient, and its own comment said it bought
          the copy column a legible ground "on the left" — which stopped being
          true when the column was centred. It has been flattening the left
          third of the mountain to protect an empty gutter, while the type it
          was meant to protect sits in the middle over the brightest part of the
          range: --sage-lit measured 2.18:1 there, under AA, on the largest word
          on the page.

          A centred clearing instead. Measured: 0.55-alpha #101E17 over the worst
          background the range produces (#918059) gives #45392C, where sage-lit
          reads 5.6:1. The ridgeline stays open on both sides. */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: 'radial-gradient(ellipse 72% 130% at 50% 44%, rgba(16,30,23,0.55), transparent 74%)',
        }}
      />

      {/* Bottom-up, so the valley floor seats into the frame edge and the
          ridgeline stays open. (A hand-cut multi-stop version of this was tried
          and reverted: measured against the render it moved the lower third's
          mean luminance by 0.0000 — the simple three-stop below was already
          placing its dark exactly where the elaborate one did.) */}
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
        {/* One centred column, and nothing beside it.
            What stood here was three: the copy in the middle, a 176px rail on
            the left, and a 176px `aria-hidden` spacer on the right whose only
            declared job was to cancel the left one. They switched on at exactly
            1024px, so the headline's measure COLLAPSED from 943px to 544px as
            the window got WIDER — which is why the line flipped between one and
            two across a single pixel of resize. 352px of the frame's widest
            dimension, spent at the width where the type is largest, to balance
            a control that has moved to a corner. */}
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center lg:-mt-2">
            <div className="flex flex-col items-center">
              {/* THE LINE, per the client mark-up of 23 August.
                  "GO WHERE" is gone and the coordinate eyebrow above it with
                  it — what is left is the two words on their own, which is
                  what the attached sample shows and is the reason it works:
                  a hero with one thing in it.

                  FEEL is roman in white, ALIVE. is italic in green, and both
                  are set in `font-display`. The green is `--sage-lit`, not
                  `--sage`: measured against the terrain actually rendered
                  behind it, --sage came out at 4.75:1 while the cream half of
                  the same headline sat at 12.8:1, so one word was carrying two
                  different weights and the coloured half sank into the
                  hillside. Same hue, luminance lifted to 7.6:1. The brief asks for Canela and, if
                  we do not have it, "the font you have used for DEWDROPZ at
                  the top left" — that wordmark is `font-display` (Fraunces),
                  so this is literally the requested fallback rather than a
                  new licence and a fourth webfont in the payload.

                  TWO LINES, ON PURPOSE, AT EVERY WIDTH. The comment that
                  stood here claimed one line, and the frame never delivered
                  one: two empty 176px side columns switch on at exactly
                  1024px, so the measure COLLAPSES from 943px to 544px as the
                  window gets wider and the line silently flipped between one
                  and two across a single pixel of resize. Rather than chase a
                  single line the column cannot hold, the break is now the
                  design — AliveHeadline emits one nowrap box per word, so the
                  line can break once, between the words, and never twice.

                  That frees the type to fill the frame: 52px on a 390px phone
                  was a subheading. The floor goes 52 → 76px and the ceiling
                  132 → 156px. `max-w-[5.6em]` is currently redundant against
                  the 768px column, and is kept as the guarantee if anyone ever
                  widens it. */}
              {/* Set one character at a time so the line can turn. It arrives
                  as one flat cream statement, and then the same wave comes back
                  through it: letter by letter ALIVE. leans out of roman,
                  catches first light, and settles into italic green.

                  It happens once and then this headline is still for the rest
                  of the session. All of it is CSS, so the words are in the
                  server HTML, no dropped chunk can leave the hero wordless, and
                  the lean composites without waking the main thread the pinned
                  timeline is already using. `data-hero-reveal` comes off these
                  two spans because the characters inside carry it now. The
                  mechanism — why one glyph can be roman and italic without a
                  second copy — is documented in globals.css under "The turn". */}
              <AliveHeadline
                label="Feel Alive."
                className="mx-auto max-w-[min(100%,5.6em)] font-display text-[clamp(76px,17vw,156px)] font-light uppercase leading-[0.9] tracking-[-0.03em] text-paper"
                segments={[
                  { text: 'Feel' },
                  // `turns`: this is the run that leans out of roman and washes
                  // through first light into green. FEEL does not turn — it is
                  // the fact, and it is already in its final state.
                  { text: 'Alive.', className: 'italic text-sage-lit', turns: true },
                ]}
              />

              {/* Repositioned per the client brief: the shop is not an expedition
                  outfitter. The line that stood here talked about heavyweight
                  blanks and printing, which reads as a supplier describing its
                  process; the brief asks for apparel and everyday essentials that
                  happen to be mountain-inspired. The second sentence — "Apparel
                  and drinkware, printed one at a time with your design on it" —
                  was struck out in the 23 August mark-up. */}
              {/* The client's line, kept. The hero council proposed replacing it
                  with "Apparel and drinkware, made in Dehradun." on the grounds
                  that no noun in this frame says what is sold — a fair finding,
                  and the client's answer was to keep the line as written. Do
                  not re-propose it; if the frame is to name the goods, it will
                  have to be somewhere other than this sentence.

                  `text-balance` stays: it evens the two lines and says nothing.

                  16px sitting under a 132px headline is an eight-to-one drop,
                  and it made the one line of copy in the frame read as a caption
                  on the type above it rather than as the second voice in a
                  two-voice frame. At 19px it holds its own; `max-w-xl` is wide
                  enough that it still sets on ONE line at that size, which
                  matters because the whole point of this act is that it holds
                  exactly one thought. */}
              <p data-hero-reveal data-summit-reveal className="mt-7 max-w-xl text-balance font-body text-[17px] leading-relaxed tracking-[0.01em] text-paper/75 md:text-[19px]">
                Inspired by mountains. Made for everyday journeys.
              </p>

              {/* ── The two doors, and which one is louder ──────────────────
                  These were the other way round. "Design yours" — go and do
                  some graphic design — was the filled pill, while "Shop the
                  drop — from ₹X" was a hairline underline at `text-paper/65`
                  on a 25%-opacity border. The loudest control on the front
                  page of a clothing shop asked a stranger who arrived from an
                  advertisement eleven seconds ago, and has not yet seen a
                  garment, to open a design tool.

                  Buying is the majority intent and takes the primary button;
                  customising is the differentiator and takes a real secondary
                  — bordered at /50 rather than /25, and at full `text-paper`
                  instead of /65, which was 4.6:1 on this ground. Both are now
                  44px tall; the underline was 21.5. */}
              <div data-hero-reveal data-summit-reveal className="mt-9 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/shop"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-paper px-8 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
                >
                  {/* The price is off the button per the 23 August mark-up:
                      "Remove only the amount i.e. From 899 and keep only SHOP
                      THE DROP". It was also the one number on the front page
                      that had to keep agreeing with the catalogue. */}
                  Shop the drop
                </Link>
                <Link
                  href="/customize"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-paper/50 px-7 font-body text-[11px] uppercase tracking-[0.14em] text-paper transition-colors duration-300 hover:border-paper hover:bg-paper/10"
                >
                  Design yours <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </div>

        {/* ── The weather, once ────────────────────────────────────────────
            There were TWO of these. A 15px Archivo rail in the left column
            above 1024px, and a 10px Space Mono row under the buttons below it
            — different type, different size, different case, different accent,
            different label colour. Not one instrument at two sizes: two
            designs of one instrument, and a visitor who resized past 1024px
            watched the brand's only control turn into a different object. The
            small one also sat BELOW the calls to action, which is the last
            place in the frame that should hold a scene toy.

            One control now, in the corner the scene is emptiest, at the size
            the frame's other instruments use.

            Inside `copyRef` deliberately: that element is `absolute inset-0`,
            so this inherits act 1's fade and the `pointerEvents: 'none'` set
            when the act leaves. On the <section> it would survive into acts
            2, 3 and 4.

            Gated on exactly what mounts the scene it drives. It used to render
            on `weather` alone, so every reduced-motion desktop visitor got four
            buttons wired to nothing, and the rail stayed on screen after a
            desktop window was narrowed past the scene's own breakpoint. */}
        {weather && mounted && !ambientMobile && !reduceMotion && (
          <div
            data-hero-reveal
            className="pointer-events-auto absolute bottom-8 right-6 z-20 flex items-center gap-4 md:right-10"
            role="group"
            aria-label="Weather on the range"
          >
            {/* One word, not three. "Change the weather" narrated a control
                whose four labels name themselves, next to a rendered mountain.
                The imperative was never the affordance. */}
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/60">
              Weather
            </span>
            {SEASONS.map((sn) => {
              const live = season === sn
              return (
                <button
                  key={sn}
                  type="button"
                  onClick={() => setSeason(sn)}
                  aria-pressed={live}
                  className={`inline-flex min-h-[44px] items-center border-b-2 px-1 pb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-300 ${
                    live
                      ? // --dawn, 7.40:1 on this ground, and the frame's one
                        // warm accent doing the job it is for: marking where
                        // the light is.
                        'border-dawn text-paper'
                      : // Was text-paper/45 — 4.11:1, under AA for a 10px
                        // label. This is 7.95:1.
                        'border-transparent text-paper/70 hover:text-paper'
                  }`}
                >
                  {sn}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ACT 2 — the collections ───────────────────────────────────────────
          The catalogue's top level, as a rack of three plates.

          WHY THIS ACT EXISTS AND WHY IT IS SECOND

          The film ran brand → design tool → invitation. That handed a stranger
          an editor eleven seconds after arriving, before showing them a single
          thing there was to put a design ON — the hero sold the mechanism
          before the merchandise. The ranges belong between the two: this is
          what we make, and the act right after it is what you can do to it.

          WHY IT LOOKS LIKE THIS AND NOT LIKE THE ROW FURTHER DOWN THE PAGE

          CollectionsRow, five hundred pixels below, is an index — a grid you
          scan. This is a frame in a film: three tall plates, the type small and
          out of the way, one door. If they looked alike the page would be
          telling you the same thing twice with different furniture. It is also
          the only act composed as a row, which is what keeps the four frames
          from repeating a composition:
            centred type → a rack → an offset workbench → centred type.

          Everything here is real catalogue data in the admin's sort order, so a
          renamed or retired collection can never leave a ghost on the front
          door — and with none at all the act is not rendered, the chapter rail
          drops its label, and the timeline hands act 1 straight to the studio. */}
      {!staticHero && hasRanges && (
        <div
          ref={rangesRef}
          /* Same contract as the two acts below: invisible is not enough, an
             act that is not holding the frame has to leave the tab order and
             stop catching clicks, or its three links sit over whatever is on
             screen swallowing presses. */
          inert={heroAct !== 'collections'}
          className="pointer-events-none absolute inset-0 z-[14] flex items-center justify-center px-6 opacity-0 md:px-10"
        >
          {/* A pool of light behind the rack, so the plates sit on something
              rather than hanging in the dark — the same device the workbench
              act uses, and translucent for the same reason: the ridge has to
              stay readable behind them or the two acts stop being one space. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 78% 60% at 50% 48%, rgba(233,238,228,0.09), transparent 70%), linear-gradient(180deg, rgba(10,17,13,0.82) 0%, rgba(7,12,9,0.90) 100%)',
            }}
          />

          {/* max-w-6xl, not 5xl — measured, not guessed: at 5xl the plates came
              out 328px wide and the rack sat 296px from the top of a 900px
              frame with 188px under it, three cards adrift in a film. At 6xl
              they are ~370 wide and ~493 tall and the frame is composed. */}
          <div className="relative w-full max-w-6xl">
            {/* The masthead. Small on purpose — the plates are the content and
                a hero act gets one loud thing, which act 1 already spent. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  <span className="font-mono text-[13px] uppercase tracking-[0.28em] text-sage">
                    The collections
                  </span>
                </div>
                {/* NOT "Three collections. One philosophy." — that is
                    CollectionsRow's headline, on this same page. A film that
                    lands the same line twice reads as a page that lost its
                    place, which is why the Trek Buddy band does not reuse
                    "Never go alone." either. */}
                <h2 className="mt-3.5 font-display text-[clamp(24px,2.9vw,42px)] font-light leading-[1.04] text-paper">
                  Every range, a different <span className="italic text-sage">reason to go.</span>
                </h2>
              </div>
              <Link
                href="/collections"
                className="pointer-events-auto inline-flex items-center gap-2 border-b border-paper/35 pb-1 font-body text-[11px] uppercase tracking-[0.14em] text-paper/80 transition-colors duration-300 hover:border-paper hover:text-paper"
              >
                See all collections <span aria-hidden="true">↗</span>
              </Link>
            </div>

            {/* The rack. Three across from `sm` — below that the frame is too
                narrow for three plates to be anything but three slivers, so
                they stack; the scrubbed hero is desktop-only anyway, and this
                is the layout that survives a narrow laptop window. */}
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
              {ranges.map((c) => (
                <li key={c.id} data-range-plate className="opacity-0">
                  <Link
                    href={`/collections/${c.slug}`}
                    className="group pointer-events-auto block overflow-hidden rounded-[var(--r-card)] border border-paper/15 bg-ink/45 backdrop-blur-sm transition-colors duration-300 hover:border-sage/60"
                  >
                    <div className="relative aspect-[3/4] max-h-[56vh] overflow-hidden bg-forest-deep">
                      {c.image_url && (
                        <Image
                          src={c.image_url}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 320px, 45vw"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          className="object-cover transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-105"
                        />
                      )}
                      {/* The plate carries its own ground for the type. The
                          act's backdrop is translucent, so without this the
                          name would be sitting on whatever the photograph
                          happens to be doing in that corner. */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-ink/92 via-ink/25 to-transparent"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                        <h3 className="font-display text-lg leading-tight text-paper md:text-xl">
                          {c.name}
                        </h3>
                        {c.tagline && (
                          <p className="mt-1 font-body text-[11.5px] italic leading-relaxed text-paper/60">
                            {c.tagline}
                          </p>
                        )}
                        <span className="mt-3 inline-block border-b border-sage/50 pb-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-paper/80 transition-colors duration-300 group-hover:border-sage group-hover:text-paper">
                          Look inside →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── ACT 3 — the studio ────────────────────────────────────────────────
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
          /* `inert` — the fix for two links you could tab to but never see.
             `opacity: 0` does not remove anything from the tab order, and
             neither act container carried aria-hidden, visibility:hidden or
             inert (the word appears three times in this file's comments and
             zero times as an attribute). Inside each sits a link that
             deliberately re-enables itself with pointer-events-auto, so a
             keyboard user tabbed into an invisible call to action inside a
             pinned section that does not scroll — and the page simply stopped
             responding. The scrub already publishes which act holds the frame;
             this reads the same value and takes the other two out of the
             document entirely. */
          inert={heroAct !== 'studio'}
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
                  {/* "Right now THE STUDIO feels a bit underpowered relative to
                      the headline. Please increase it by about 20–30%."
                      10px → 13px is +30%, and the marker grows with it so the
                      pair still reads as one unit rather than a dot with a
                      label that outgrew it. */}
                  <span className="font-mono text-[13px] uppercase tracking-[0.28em] text-sage">The studio</span>
                </div>
                <h2 className="mt-3.5 font-display text-[clamp(24px,2.7vw,40px)] font-light leading-[1.04] text-paper">
                  A studio, not an <span className="italic text-sage">upload box.</span>
                </h2>
              </div>
              <div className="flex max-w-[19rem] flex-col items-start gap-4">
                {/* Replaced per the mark-up. The old line described the tool's
                    features — type, artwork, layers, millimetres. The brief
                    asks for the two doors instead, because the thing a visitor
                    actually has to decide here is whether they are bringing
                    artwork or borrowing ours, and the old copy never said the
                    library existed at all. */}
                <div>
                  <p className="font-body text-[12.5px] leading-relaxed text-paper/65">
                    Build every detail before it goes to print.
                  </p>
                  <dl className="mt-4 space-y-3">
                    <div>
                      <dt className="font-body text-[10.5px] uppercase tracking-[0.14em] text-sage">
                        Browse the DEWDROPZ library
                      </dt>
                      <dd className="mt-1 font-body text-[12px] leading-relaxed text-paper/50">
                        Choose from our DEWDROPZ design collections.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-body text-[10.5px] uppercase tracking-[0.14em] text-sage">
                        Create your own
                      </dt>
                      <dd className="mt-1 font-body text-[12px] leading-relaxed text-paper/50">
                        Start with a blank canvas or upload your own artwork.
                      </dd>
                    </div>
                  </dl>
                </div>
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
              <div data-studio-panel className="hidden origin-right rounded-[var(--r-input)] border border-paper/12 bg-ink/55 p-3 backdrop-blur-sm lg:block">
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper/35">Type</div>
                <div className="mt-2 space-y-1">
                  {['Fraunces', 'Archivo', 'Space Mono'].map((f, i) => (
                    <div key={f} className={`rounded-[var(--r-input)] px-2 py-1.5 font-body text-[11px] ${i === 0 ? 'bg-paper/10 text-paper' : 'text-paper/45'}`}>
                      {f}
                    </div>
                  ))}
                </div>
                {/* "Colour", not "Ink" — CustomizerStudio's rail 01 is
                    labelled Colour and prints the selected colourway's name
                    beside it. These are garment colourways; nothing here is
                    ink. */}
                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper/35">
                    Colour
                  </span>
                  <span className="truncate font-body text-[9px] text-paper/55">
                    {STUDIO_COLOR_SELECTED.name}
                  </span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {STUDIO_COLORWAYS.map((c) => {
                    const selected = c.name === STUDIO_COLOR_SELECTED.name
                    return (
                      <span
                        key={c.name}
                        title={c.available ? c.name : `${c.name} — coming soon`}
                        className={`relative h-5 w-5 rounded-full border ${
                          selected
                            ? 'border-sage ring-1 ring-sage ring-offset-1 ring-offset-ink'
                            : 'border-paper/20'
                        }`}
                        style={{ background: c.hex }}
                      >
                        {/* Same device the real rail uses, so "not orderable
                            yet" does not rely on colour alone — on a colour
                            control. */}
                        {!c.available && (
                          <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                            <span className="block h-px w-full rotate-45 bg-ink/70 mix-blend-normal" />
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
                <div className="mt-4 border-t border-paper/10 pt-3 font-mono text-[8px] uppercase tracking-[0.16em] text-paper/30">
                  Print · DTG
                </div>
              </div>

              {/* The bench: the garment, being worked on. */}
              <div data-studio-panel className="relative origin-center overflow-hidden rounded-[var(--r-card)] border border-paper/12 bg-[#0B120E]">
                <div className="flex items-center justify-between border-b border-paper/10 px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="rounded-[var(--r-input)] bg-paper px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-ink">Front</span>
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
              <div data-studio-panel className="hidden origin-left rounded-[var(--r-input)] border border-paper/12 bg-ink/55 p-3 backdrop-blur-sm lg:block">
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper/35">Layers</div>
                <div className="mt-2 space-y-1">
                  {[
                    { n: 'Text — “FEEL ALIVE”', on: true, sel: true },
                    { n: 'Ridge mark', on: true, sel: false },
                    { n: 'Back print', on: false, sel: false },
                  ].map((l) => (
                    <div key={l.n} data-layer-row className={`flex items-center gap-2 rounded-[var(--r-input)] px-2 py-1.5 ${l.sel ? 'bg-sage/15' : ''}`}>
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

      {/* ── ACT 4 — Trek Buddy ────────────────────────────────────────────────
          One moment, centred, at the same scale act one opens on. The film
          therefore reads brand → ranges → tool → invitation: two centred type
          frames at either end, with the rack and the offset editor between
          them, rather than four variations of the same composition.

          Everything that explained the product has moved to TrekBuddyBand
          further down the page, which has the room for it. What is left here
          is the only thing a hero act can actually carry: the picture, the
          line, and the door. */}
      {!staticHero && (
        <div
          ref={mapRef}
          inert={heroAct !== 'trek'}
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0"
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
          {/* Two passes. The first grades the clip to dusk so it belongs to this
              palette rather than to a stock library. The second is a centred
              vignette — the copy is centred now, so a left-weighted scrim would
              be darkening the wrong half and leaving the type on open sky. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(8,13,24,0.72) 0%, rgba(9,16,28,0.46) 42%, rgba(6,10,18,0.88) 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 62% 58% at 50% 52%, rgba(6,10,18,0.80) 0%, rgba(6,10,18,0.42) 55%, rgba(6,10,18,0) 100%)',
            }}
          />

          <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 text-center md:px-10">
            {/* The name, at a size you actually read.
                It was a 10px eyebrow — the same weight as a caption — on the
                one frame of the film whose whole job is to introduce a product
                by name. If somebody scrolls the hero and cannot afterwards
                tell you what the thing is called, the act has failed however
                good the picture is. */}
            <div data-act4 className="opacity-0">
              <p className="font-mono text-[clamp(15px,2.1vw,26px)] uppercase leading-none tracking-[0.42em] text-sage">
                {/* The trailing letter-space is padding, not a gap: wide
                    tracking pushes the last glyph off-centre otherwise. */}
                <span className="-mr-[0.42em]">Trek&nbsp;Buddy</span>
              </p>
              <p className="mt-3.5 font-mono text-[10px] uppercase tracking-[0.24em] text-paper/50">
                Dehradun and around
              </p>
            </div>

            {/* Act one's scale, not a subheading's. The two centred frames of
                the film should carry the same typographic weight. */}
            <h2
              data-act4
              className="mt-6 font-display text-[clamp(38px,5.6vw,80px)] font-light uppercase leading-[0.88] tracking-[-0.035em] text-paper opacity-0"
            >
              Never go{' '}
              {/* "make `alone` about 10–15% smaller than it is now. Right now it
                  slightly overpowers NEVER GO." It is italic lowercase at the
                  same font-size as the caps beside it, and an italic lowercase
                  word with ascenders and descenders occupies more optical space
                  than caps do at the same size — which is exactly the effect
                  the client is describing. 0.87em is a 13% cut, mid-range, and
                  it scales with the clamp rather than fighting it. */}
              <span className="text-[0.87em] italic lowercase text-sage">alone.</span>
            </h2>

            <p
              data-act4
              className="mt-7 max-w-xl font-body text-sm leading-relaxed text-paper/75 opacity-0 md:text-base"
            >
              Planning a trek, camping trip, stargazing session, heritage walk, or outdoor
              adventure? Share your plan, discover others interested in joining, and choose
              who joins the journey.
            </p>

            <div data-act4 className="pointer-events-auto mt-9 opacity-0">
              <Link
                href="/trek-buddy"
                className="inline-flex items-center gap-2 rounded-full bg-paper px-7 py-3.5 font-body text-[11px] uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-sage"
              >
                Find trek buddies <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* The chapter rail — stacked labels crossfading at the act cuts. The
          quiet cue that this hero is chaptered, and where you are in it.

          Built from `chapterLabels`, which drops "The ranges" and renumbers
          when there are no collections to show. The timeline crossfades
          whatever this rendered rather than assuming three, so the rail and the
          acts cannot end up disagreeing about how many chapters there are. */}
      {!staticHero && (
        <div className="pointer-events-none absolute bottom-8 left-6 z-30 grid md:left-10">
          {chapterLabels.map((c, i) => (
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
          data-hero-reveal data-summit-reveal
          className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 font-body text-[9px] uppercase tracking-[0.2em] text-paper/40"
        >
          Scroll ↓
        </div>
      )}
    </section>
  )
}
