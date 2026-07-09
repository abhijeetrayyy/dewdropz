'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ScrollTrigger } from '@/lib/gsap'
import { BLUR_DATA_URL, COLLECTIONS } from '@/lib/constants'
import type { DragState, WaypointScreenState } from './TerrainScene'
import { WAYPOINTS } from './TerrainScene'

const TerrainScene = dynamic(() => import('./TerrainScene'), { ssr: false })

// The flythrough itself descends from a high, distant survey of the peaks down into
// the misty treeline — these are the two collections that actually live at those two
// elevations, so the section can teach "what to wear at this altitude" instead of
// just being scenery. o-collection (desert ridges) doesn't belong on this range at all.
const SILENT_ALTITUDE = COLLECTIONS.find((c) => c.id === 'silent-altitude')!
const MIST_AND_MORNING = COLLECTIONS.find((c) => c.id === 'mist-and-morning')!

const ZONES = [
  {
    collection: SILENT_ALTITUDE,
    altitudeLabel: '4,500m+',
    blurb: 'Above the treeline, wind never stops asking questions. Wind-sealed shells, real insulation.',
  },
  {
    collection: MIST_AND_MORNING,
    altitudeLabel: '3,200–3,800m',
    blurb: 'Lower down, the fog sits in the pines until mid-morning. Lightweight layers that dry fast.',
  },
]

const PEAK_ALTITUDE = 5200
const VALLEY_ALTITUDE = 3200

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function TerrainFlythrough() {
  const sectionRef = useRef<HTMLElement>(null)
  const progressRef = useRef(0)
  const dragRef = useRef<DragState>({ yaw: 0, pitch: 0, active: false })
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const waypointLabelRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [mounted, setMounted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [segments, setSegments] = useState(90)
  const [treeCount, setTreeCount] = useState(90)
  const [showDragHint, setShowDragHint] = useState(true)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const mobile = window.innerWidth < 768
    setSegments(mobile ? 48 : 90)
    setTreeCount(mobile ? 40 : 90)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setShowDragHint(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  // Only pay for the WebGL context once the section is close to view — this is
  // the heaviest thing on the page, no reason to build it before anyone scrolls near it.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px 0px' }
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=180%',
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
  }, [])

  // Click-and-drag free look, mouse/trackpad only — touch input is left alone so a
  // drag gesture here never fights a finger trying to scroll the page on a phone.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    dragRef.current.active = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    setShowDragHint(false)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    dragRef.current.yaw = clamp(dragRef.current.yaw - dx * 0.0022, -0.6, 0.6)
    dragRef.current.pitch = clamp(dragRef.current.pitch - dy * 0.0016, -0.32, 0.32)
  }

  const handlePointerUp = () => {
    dragRef.current.active = false
  }

  const handleWaypointProject = useCallback((states: Record<string, WaypointScreenState>) => {
    for (const id in states) {
      const el = waypointLabelRefs.current[id]
      if (!el) continue
      const s = states[id]
      el.style.left = `${s.x}%`
      el.style.top = `${s.y}%`
      el.style.opacity = s.visible ? '1' : '0'
      el.style.pointerEvents = s.visible ? 'auto' : 'none'
    }
  }, [])

  const zoneIndex = progress < 0.5 ? 0 : 1
  const zone = ZONES[zoneIndex]
  const altitude = Math.round(PEAK_ALTITUDE - progress * (PEAK_ALTITUDE - VALLEY_ALTITUDE))

  return (
    <section
      ref={sectionRef}
      data-cursor="drag"
      data-cursor-text="Scroll"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative h-screen bg-[#182b22] overflow-hidden select-none"
    >
      {mounted && (
        <TerrainScene
          progressRef={progressRef}
          reduceMotion={reduceMotion}
          segments={segments}
          treeCount={treeCount}
          dragRef={dragRef}
          onWaypointProject={handleWaypointProject}
        />
      )}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#182b22] via-transparent to-[#182b22]/40 z-[1]" />

      {/* Real hotspots anchored to the terrain itself, not the UI chrome around it —
          each is a working link, projected to screen space every frame in TerrainScene.
          Collection pins pulse sage and sell gear; trek pins glow clay and link to the
          bookable trails themselves — the old TrailMap section's content, in-world. */}
      {WAYPOINTS.map((w) => (
        <Link
          key={w.id}
          ref={(el) => {
            waypointLabelRefs.current[w.id] = el
          }}
          href={w.href}
          data-cursor="view"
          data-cursor-text={w.kind === 'trek' ? 'Trek' : 'Explore'}
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

      <AnimatePresence>
        {showDragHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="pointer-events-none absolute top-1/2 left-1/2 z-[2] hidden -translate-x-1/2 -translate-y-1/2 sm:block"
          >
            <div className="flex items-center gap-2 font-body text-[9px] tracking-[0.2em] text-paper/45 uppercase">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 9l-4 3 4 3M16 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Click and drag to look around
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-8 left-6 md:top-10 md:left-10 z-10">
        <div className="font-body text-[10px] tracking-[0.3em] text-sage/80 uppercase">The Range</div>
        <div className="mt-1 font-mono text-[9px] tracking-[0.15em] text-paper/50 uppercase tabular-nums">
          {altitude.toLocaleString('en-IN')}m — descending
        </div>
      </div>

      {/* Elevation scale — ties the readout above to an actual position on the range,
          and to the same 5,200m figure quoted as a real stat earlier on the page. */}
      <div className="hidden md:flex absolute top-24 bottom-24 left-10 z-10 flex-col items-center">
        <span className="font-mono text-[8px] tracking-[0.1em] text-paper/40">5,200M</span>
        <div className="relative flex-1 w-px bg-paper/20 mt-2 mb-2">
          <motion.div
            className="absolute left-1/2 h-1.5 w-1.5 rounded-full bg-sage"
            style={{ top: `${progress * 100}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>
        <span className="font-mono text-[8px] tracking-[0.1em] text-paper/40">3,200M</span>
      </div>

      <div className="absolute bottom-8 left-6 right-6 md:bottom-10 md:left-10 md:right-10 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={zone.collection.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6"
          >
            <div className="flex items-center gap-4 max-w-lg">
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-sm overflow-hidden flex-shrink-0 border border-paper/15">
                <Image
                  src={zone.collection.image}
                  alt={zone.collection.name}
                  fill
                  sizes="80px"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
              </div>
              <div>
                <div className="font-body text-[9px] tracking-[0.15em] text-sage uppercase">
                  {zone.altitudeLabel}
                </div>
                <div className="font-display text-lg md:text-xl text-paper leading-tight mt-0.5">
                  {zone.collection.name}
                </div>
                <p className="font-body text-xs text-paper/60 leading-relaxed mt-1 max-w-xs sm:max-w-sm">
                  {zone.blurb}
                </p>
              </div>
            </div>

            <Link
              href={`/collections/${zone.collection.id}`}
              data-cursor="magnetic"
              data-cursor-text="Explore"
              className="inline-flex items-center gap-2 font-body text-[10px] tracking-[0.12em] uppercase text-paper border border-paper/25 rounded-sm px-5 py-3 whitespace-nowrap hover:bg-paper/10 transition-colors duration-300 flex-shrink-0 w-fit"
            >
              Shop {zone.collection.name} →
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
