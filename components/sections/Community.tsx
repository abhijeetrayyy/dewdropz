'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { BLUR_DATA_URL, COMMUNITY_PHOTOS, SITE, TESTIMONIALS } from '@/lib/constants'

const ROTATE_INTERVAL = 7000

// One field report at a time, told properly: the photo, the altitude, the gear
// that was carried, and the person's own words form a single artifact. Replaces
// the old bordered quote-card grid + separate static photo wall — the photos and
// the voices were always the same stories, so now they're shown that way.
export default function Community() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setActive((a) => (a + 1) % TESTIMONIALS.length)
    }, ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [paused])

  const report = TESTIMONIALS[active]

  return (
    <section className="bg-paper px-6 md:px-10 py-24 md:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 md:mb-16 flex items-end justify-between">
          <div>
            <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">Field Reports</div>
            <h2 className="mt-3 font-display font-light text-[clamp(30px,4.5vw,48px)] text-text leading-[1.1]">
              Worn. Tested. Reported back.
            </h2>
          </div>
          <p className="hidden md:block font-body text-sm text-mid max-w-[240px] text-right leading-relaxed">
            No stock reviews — every report is from a real trek above 3,000 metres.
          </p>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-10 lg:gap-16 items-center"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* The report */}
          <div className="order-2 lg:order-1 flex flex-col min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={report.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1"
              >
                <p className="font-display font-light italic text-[clamp(20px,2.6vw,30px)] text-text leading-[1.45]">
                  &ldquo;{report.quote}&rdquo;
                </p>

                <div className="mt-8 flex items-center gap-4">
                  <div
                    className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: report.gradient }}
                  >
                    <span className="font-body text-[11px] font-medium text-paper">{report.initials}</span>
                  </div>
                  <div>
                    <div className="font-body text-sm text-text font-medium">
                      {report.name}
                      <span className="ml-2 font-body text-[9px] tracking-[0.1em] text-sage uppercase">✓ Verified buyer</span>
                    </div>
                    <div className="font-mono text-[11px] text-mid mt-0.5">
                      {report.trek} · {report.location} · carried the {report.gear}
                    </div>
                  </div>
                </div>
              </motion.blockquote>
            </AnimatePresence>

            {/* Pagination — report index, not dots */}
            <div className="mt-10 flex items-center gap-5">
              {TESTIMONIALS.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Read ${t.name}'s report`}
                  className={`font-mono text-[11px] tracking-[0.1em] pb-1 border-b transition-colors duration-300 ${
                    i === active
                      ? 'text-forest border-forest'
                      : 'text-light border-transparent hover:text-mid'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </button>
              ))}
              <div className="flex-1 h-px bg-rule" />
              <span className="font-mono text-[11px] text-light">{String(TESTIMONIALS.length).padStart(2, '0')} reports</span>
            </div>
          </div>

          {/* The evidence — photo stamped like a field slide */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative aspect-[4/5] max-h-[520px] w-full rounded-sm overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={report.image}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={report.image}
                    alt={report.trek}
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent pointer-events-none" />

              {/* Altitude stamp */}
              <div className="absolute top-4 left-4 bg-ink/70 backdrop-blur-sm rounded-sm px-3 py-2">
                <div className="font-mono text-[13px] text-paper tabular-nums">{report.altitude}</div>
                <div className="font-body text-[8px] tracking-[0.18em] text-paper/60 uppercase mt-0.5">
                  Reported altitude
                </div>
              </div>

              <div className="absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.08em] text-paper/80 uppercase">
                {report.trek}
              </div>
            </div>
          </div>
        </div>

        {/* Contact sheet — community photos drift past like slide film */}
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div className="font-body text-[10px] tracking-[0.2em] text-forest uppercase">Spotted on the Trail</div>
            <a
              href={SITE.instagram}
              data-cursor="magnetic"
              className="font-body text-xs text-mid hover:text-forest transition-colors"
            >
              Tag <span className="text-forest">@dewdropz.shop</span> to be featured →
            </a>
          </div>
        </div>
      </div>

      {/* Full-bleed strip, breaks out of the container on purpose */}
      <div className="mt-2 -mx-6 md:-mx-10">
        <div className="trail-marquee flex w-max gap-4 pl-6 md:pl-10">
          {[...COMMUNITY_PHOTOS, ...COMMUNITY_PHOTOS].map((photo, i) => (
            <figure key={`${photo.image}-${i}`} className="w-52 md:w-64 flex-shrink-0">
              <div className="relative aspect-[4/3] rounded-sm overflow-hidden">
                <Image
                  src={photo.image}
                  alt={photo.caption}
                  fill
                  sizes="256px"
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-2 font-mono text-[10px] text-mid truncate">
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
