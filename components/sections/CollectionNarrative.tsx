'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { COLLECTIONS } from '@/lib/constants'

export default function CollectionNarrative({ collection }: { collection: (typeof COLLECTIONS)[number] }) {
  const sectionRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tween = gsap.to(imageRef.current, {
      yPercent: -14,
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
        <div>
          <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">Why This Collection</div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="mt-5 font-display font-light text-[clamp(24px,3vw,32px)] text-text leading-[1.35]"
          >
            {collection.narrative}
          </motion.p>
        </div>

        <div className="relative h-[45vh] md:h-[55vh] min-h-[340px] rounded-lg overflow-hidden">
          <div ref={imageRef} className="absolute inset-0 scale-110">
            <Image
              src={collection.secondaryImage}
              alt={`${collection.name} in the field`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover"
            />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(12,16,13,0.35), transparent 50%)' }}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-20 md:mt-28 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 border-t border-rule pt-12">
        {collection.conditions.map((c) => (
          <div key={c.label}>
            <div className="font-body text-[10px] tracking-[0.12em] text-forest uppercase">{c.label}</div>
            <div className="mt-2 font-display text-lg md:text-xl text-text">{c.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
