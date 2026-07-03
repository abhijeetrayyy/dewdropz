'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { BLUR_DATA_URL, BRAND_STORY_IMAGE } from '@/lib/constants'

export default function AboutStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const collectionsLink = useMagneticHover(0.4, 10)

  useEffect(() => {
    const tween = gsap.to(imageRef.current, {
      yPercent: -12,
      ease: 'none',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div
          className="relative h-[45vh] md:h-[65vh] min-h-[360px] rounded-lg overflow-hidden order-1 md:order-none"
          style={{ background: 'linear-gradient(135deg, #1C3018 0%, #27481F 60%, #7BA46F 100%)' }}
        >
          <div ref={imageRef} className="absolute inset-0">
            <Image
              src={BRAND_STORY_IMAGE}
              alt="Founders on a foggy Himalayan ridge"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover pointer-events-none"
            />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(28,48,24,0.5) 0%, rgba(39,72,31,0.3) 60%, rgba(123,164,111,0.2) 100%)' }}
          />
        </div>

        <div>
          <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">2019, Dehradun</div>
          <h2 className="mt-4 font-display font-light text-[clamp(32px,4.5vw,48px)] text-text leading-[1.1]">
            Three trekking guides, one bad monsoon, and a decision to build it ourselves.
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="font-body text-sm text-mid leading-relaxed mt-6 max-w-md"
          >
            DEWDROPZ started as a complaint, not a business plan. Three of us were guiding treks across
            Uttarakhand, watching client after client show up in gear that fell apart the moment the
            weather turned. Waterproof jackets that weren&apos;t. Packs that soaked through by lunch.
            We got tired of apologizing for equipment we didn&apos;t make.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-body text-sm text-mid leading-relaxed mt-4 max-w-md"
          >
            So we built our own. Small batches, tested on the same ridgelines we guide on, priced for
            what good materials actually cost. Seven years later, that hasn&apos;t changed — we still test
            every prototype above 4,000 metres before it goes anywhere near a cart.
          </motion.p>

          <motion.a
            ref={collectionsLink.ref as React.RefObject<HTMLAnchorElement>}
            onMouseMove={collectionsLink.onMouseMove}
            onMouseLeave={collectionsLink.onMouseLeave}
            style={{ x: collectionsLink.x, y: collectionsLink.y }}
            data-cursor="magnetic"
            data-cursor-text="View"
            href="/collections"
            className="font-body text-xs text-forest tracking-[0.1em] uppercase mt-8 inline-block hover:text-forest-mid transition-colors duration-300"
          >
            See what we&apos;ve built →
          </motion.a>
        </div>
      </div>
    </section>
  )
}
