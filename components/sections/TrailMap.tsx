'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL, TRAIL_MAP_AERIAL_IMAGE, TRAIL_MAP_POINTS } from '@/lib/constants'

// Ties the interactive map to actual merchandising: above 4,000m the exposure calls
// for the alpine collection, everything below it sits comfortably in forest/mist range.
function collectionForAltitude(altitude: string) {
  const meters = parseInt(altitude.replace(/[^0-9]/g, ''), 10)
  return meters > 4000 ? 'silent-altitude' : 'mist-and-morning'
}

// Route line coordinates mirror TRAIL_MAP_POINTS order so the dashed path
// threads through each pin in sequence, west to east across the range.
// Shares the same 0-100 coordinate space as the pins' CSS percentage positions.
const ROUTE_PATH = TRAIL_MAP_POINTS.map((p) => `${p.x} ${p.y}`).join(' L ')
const CARD_ANCHOR = { x: 11, y: 88 }

export default function TrailMap() {
  const sectionRef = useRef<HTMLElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const connectorRef = useRef<SVGLineElement>(null)
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [interacted, setInteracted] = useState(false)

  useEffect(() => {
    const path = pathRef.current
    if (!path) return
    const length = path.getTotalLength()
    gsap.set(path, { strokeDasharray: `${length}`, strokeDashoffset: length })
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration: 2.2,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  useEffect(() => {
    const line = connectorRef.current
    if (!line) return
    const length = line.getTotalLength()
    gsap.fromTo(
      line,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }
    )
  }, [active])

  const point = TRAIL_MAP_POINTS[active]

  const selectPoint = (i: number) => {
    setActive(i)
    setInteracted(true)
  }

  return (
    <section ref={sectionRef} className="bg-ink px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-lg mx-auto mb-16">
          <div className="font-body text-xs tracking-[0.18em] text-sage uppercase">The Ground We Know</div>
          <h2 className="mt-4 font-display font-light text-[clamp(30px,4.5vw,48px)] text-paper leading-[1.1]">
            40+ trails mapped. These are 8 of them.
          </h2>
        </div>

        <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/8] rounded-lg overflow-hidden border border-white/10">
          <Image
            src={TRAIL_MAP_AERIAL_IMAGE}
            alt="Aerial view of the Himalaya near Ama Dablam, en route to Everest Base Camp"
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(12,16,13,0.55) 0%, rgba(12,16,13,0.15) 30%, rgba(12,16,13,0.25) 70%, rgba(12,16,13,0.65) 100%)' }}
          />
          {/* Faint scan-line texture ties the real photo to the site's telemetry/instrument motif */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--paper)_1px,_transparent_1px)] bg-[size:14px_14px]" />

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
            <path
              ref={pathRef}
              d={`M ${ROUTE_PATH}`}
              fill="none"
              stroke="#F6F3EA"
              strokeWidth="0.2"
              strokeDasharray="1 1.4"
              strokeLinecap="round"
              opacity="0.45"
              vectorEffect="non-scaling-stroke"
            />
            <line
              ref={connectorRef}
              x1={point.x}
              y1={point.y}
              x2={CARD_ANCHOR.x}
              y2={CARD_ANCHOR.y}
              stroke="#7BA46F"
              strokeWidth="0.18"
              strokeDasharray="0.6 0.9"
              strokeLinecap="round"
              opacity="0.65"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {TRAIL_MAP_POINTS.map((p, i) => {
            const isActive = active === i
            const isHovered = hovered === i
            return (
              <div
                key={p.name}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <AnimatePresence>
                  {isHovered && !isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.9 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-paper text-ink font-body text-[10px] tracking-[0.05em] uppercase px-2.5 py-1 rounded-sm shadow-lg pointer-events-none"
                    >
                      {p.name}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-paper" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Radar pulse rings — only the active point transmits */}
                {isActive && (
                  <>
                    <motion.span
                      className="absolute left-1/2 top-1/2 rounded-full border border-sage"
                      style={{ x: '-50%', y: '-50%' }}
                      initial={{ width: 12, height: 12, opacity: 0.6 }}
                      animate={{ width: 44, height: 44, opacity: 0 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <motion.span
                      className="absolute left-1/2 top-1/2 rounded-full border border-sage"
                      style={{ x: '-50%', y: '-50%' }}
                      initial={{ width: 12, height: 12, opacity: 0.6 }}
                      animate={{ width: 44, height: 44, opacity: 0 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.9 }}
                    />
                  </>
                )}

                <motion.button
                  type="button"
                  onClick={() => selectPoint(i)}
                  onHoverStart={() => setHovered(i)}
                  onHoverEnd={() => setHovered((v) => (v === i ? null : v))}
                  aria-label={p.name}
                  data-cursor="view"
                  data-cursor-text="Explore"
                  className="relative flex items-center justify-center p-3 -m-3"
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <span
                    className={`block rounded-full ring-2 transition-colors duration-300 ${
                      isActive ? 'h-3 w-3 bg-sage ring-sage/50' : 'h-2.5 w-2.5 bg-paper ring-ink/40'
                    }`}
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}
                  />
                </motion.button>

                <span
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 font-mono text-[8px] tracking-[0.1em] text-paper/70 transition-opacity duration-300 ${
                    isHovered || isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            )
          })}

          <AnimatePresence mode="wait">
            <motion.div
              key={point.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-4 left-4 md:bottom-6 md:left-6 bg-ink/60 backdrop-blur-sm rounded-md px-4 py-3 max-w-[240px] border border-white/10"
            >
              <h3 className="font-display text-lg text-paper leading-tight">{point.name}</h3>
              <p className="mt-1.5 font-display italic text-sage/80 text-[13px] leading-snug">
                {point.story}
              </p>
              <div className="mt-3 flex gap-6">
                <div>
                  <div className="font-body text-[9px] tracking-[0.12em] text-sage uppercase">Altitude</div>
                  <div className="font-body text-sm text-paper tabular-nums">{point.altitude}</div>
                </div>
                <div>
                  <div className="font-body text-[9px] tracking-[0.12em] text-sage uppercase">Difficulty</div>
                  <div className="font-body text-sm text-paper">{point.difficulty}</div>
                </div>
              </div>
              <Link
                href={`/collections/${collectionForAltitude(point.altitude)}`}
                data-cursor="view"
                data-cursor-text="Shop"
                className="mt-3 inline-flex items-center gap-1.5 font-body text-[10px] tracking-[0.1em] text-sage uppercase hover:text-paper transition-colors duration-300"
              >
                Gear up for this trail →
              </Link>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {!interacted && (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute top-4 right-4 md:top-6 md:right-6 font-body text-[9px] tracking-[0.15em] text-paper/60 uppercase flex items-center gap-2"
              >
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-sage"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                Tap a point
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
