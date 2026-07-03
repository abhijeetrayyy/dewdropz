'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { BLUR_DATA_URL, SITE, TREKS } from '@/lib/constants'
import Accordion from '@/components/Accordion'
import { useMagneticHover } from '@/hooks/useMagneticHover'

const FITNESS_NOTE: Record<string, string> = {
  Easy: 'Suited to first-time trekkers with regular walking fitness. No prior high-altitude experience needed.',
  Moderate: '6–8 hours of daily walking on uneven terrain. Some cardio prep recommended in the month before.',
  Hard: 'Multi-day exposure above 4,500m. Prior trekking experience and a recent fitness assessment required.',
}

function TrekCard({ trek }: { trek: (typeof TREKS)[number] }) {
  const reserveBtn = useMagneticHover(0.25, 8)
  const mailtoHref = `mailto:${SITE.email}?subject=${encodeURIComponent(
    `Reserve a spot — ${trek.name} (${trek.date})`
  )}`

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 border-b border-rule py-14 first:pt-0 last:border-b-0">
      <div className="relative h-[50vw] max-h-[360px] md:h-[42vh] rounded-lg overflow-hidden order-1 md:order-none">
        <Image
          src={trek.image}
          alt={trek.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
        <div className="absolute top-4 left-4 bg-ink/60 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="font-body text-[10px] tracking-[0.1em] text-white uppercase">
            {trek.spotsLeft <= 3 ? `Only ${trek.spotsLeft} spots left` : `${trek.spotsLeft} spots left`}
          </span>
        </div>
      </div>

      <div>
        <span className="font-body text-xs tracking-[0.15em] text-forest uppercase">{trek.region}</span>
        <h3 className="mt-2 font-display font-light text-[clamp(26px,3.5vw,36px)] text-text leading-[1.1]">
          {trek.name}
        </h3>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="font-body text-[10px] tracking-[0.1em] text-mid uppercase">Dates</div>
            <div className="mt-1 font-body text-sm text-text">{trek.date}</div>
          </div>
          <div>
            <div className="font-body text-[10px] tracking-[0.1em] text-mid uppercase">Duration</div>
            <div className="mt-1 font-body text-sm text-text">{trek.duration}</div>
          </div>
          <div>
            <div className="font-body text-[10px] tracking-[0.1em] text-mid uppercase">Altitude</div>
            <div className="mt-1 font-body text-sm text-text">{trek.altitude}</div>
          </div>
          <div>
            <div className="font-body text-[10px] tracking-[0.1em] text-mid uppercase">Difficulty</div>
            <div className="mt-1 font-body text-sm text-text">{trek.difficulty}</div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6">
          <span className="font-body text-xl text-forest font-medium">Rs. {trek.price.toLocaleString('en-IN')}</span>
          <motion.a
            ref={reserveBtn.ref as React.RefObject<HTMLAnchorElement>}
            onMouseMove={reserveBtn.onMouseMove}
            onMouseLeave={reserveBtn.onMouseLeave}
            style={{ x: reserveBtn.x, y: reserveBtn.y }}
            href={mailtoHref}
            data-cursor="magnetic"
            data-cursor-text="Reserve"
            className="bg-forest text-paper px-7 py-3 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300"
          >
            Reserve Your Spot
          </motion.a>
        </div>

        <div className="mt-8">
          <Accordion
            title="What's Included"
            content="Guide fees, permits, camping equipment, and all meals on trail. Transport to/from the base town and personal gear not included."
          />
          <Accordion title="Fitness & Experience Required" content={FITNESS_NOTE[trek.difficulty] ?? FITNESS_NOTE.Moderate} />
        </div>
      </div>
    </div>
  )
}

export default function TreksList() {
  return (
    <section className="bg-paper px-6 md:px-10 py-20">
      <div className="max-w-5xl mx-auto">
        {TREKS.map((trek) => (
          <TrekCard key={trek.slug} trek={trek} />
        ))}
      </div>
    </section>
  )
}
