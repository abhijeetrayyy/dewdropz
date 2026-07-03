'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL } from '@/lib/constants'
import SplitText from '@/components/SplitText'

const ADVENTURE_IMAGE_1 = 'https://images.unsplash.com/photo-1501555088652-021faa106b9b' // hiker on peak
const ADVENTURE_IMAGE_2 = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b' // snowy mountain peak

export default function TrekManifesto() {
  const sectionRef = useRef<HTMLElement>(null)
  const image1Ref = useRef<HTMLDivElement>(null)
  const image2Ref = useRef<HTMLDivElement>(null)
  const statsBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    // Floating parallax speed offsets
    const anim1 = gsap.to(image1Ref.current, {
      yPercent: -18,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })

    const anim2 = gsap.to(image2Ref.current, {
      yPercent: 10,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })

    const statsAnim = gsap.to(statsBoxRef.current, {
      yPercent: -28,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })

    return () => {
      anim1.scrollTrigger?.kill()
      anim1.kill()
      anim2.scrollTrigger?.kill()
      anim2.kill()
      statsAnim.scrollTrigger?.kill()
      statsAnim.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Text & Editorial Content (spanning 5 columns) */}
        <div className="lg:col-span-5 flex flex-col justify-center z-10">
          <span className="font-body text-[10px] tracking-[0.25em] text-forest uppercase font-semibold">
            Trek Manifesto
          </span>

          <div className="mt-4 font-display font-light text-[clamp(34px,5.5vw,56px)] leading-[1.06] text-text">
            <SplitText
              text="The silence is where the trail begins."
              tag="h2"
              splitType="words"
              delay={30}
              duration={1.1}
              ease="power4.out"
              from={{ opacity: 0, y: '80%' }}
              to={{ opacity: 1, y: '0%' }}
              textAlign="left"
              className="!block"
            />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            className="font-body text-sm text-mid leading-relaxed mt-6 max-w-md"
          >
            We don&apos;t go to escape the world. We go to return to it. High altitude is a filter
            that strips away the noise, leaving only what is true — the cold air in your lungs, the
            contour lines on the map, and the slow, rhythmic cadence of step after step.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.45 }}
            className="font-body text-sm text-mid leading-relaxed mt-4 max-w-md"
          >
            Our trekking gear is refined on Dehradun ridges and tested above five thousand meters
            so you can forget your pack and look up at the ridge.
          </motion.p>

          <div className="mt-8">
            <Link
              href="/about"
              data-cursor="magnetic"
              className="inline-flex items-center gap-2 font-body text-[10px] tracking-[0.15em] text-forest uppercase font-semibold border-b border-forest/20 pb-1 hover:border-forest transition-colors duration-300"
            >
              Explore our Philosophy →
            </Link>
          </div>
        </div>

        {/* Right Column: Overlapping Parallax Image Collage (spanning 7 columns) */}
        <div className="lg:col-span-7 relative h-[60vh] min-h-[480px] lg:h-[70vh] flex items-center justify-center">
          {/* Main Background Image Card (Slides down on scroll) */}
          <div
            ref={image1Ref}
            className="absolute right-0 w-[68%] h-[78%] rounded-sm overflow-hidden shadow-2xl bg-zinc-200"
          >
            <Image
              src={ADVENTURE_IMAGE_1}
              alt="Hiker overlooking Himalayan range"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Overlapping Foreground Image Card (Slides up on scroll) */}
          <div
            ref={image2Ref}
            className="absolute left-6 bottom-[10%] w-[45%] h-[50%] rounded-sm overflow-hidden shadow-2xl border-[6px] border-paper z-10 bg-zinc-200"
          >
            <Image
              src={ADVENTURE_IMAGE_2}
              alt="Snowy Himalayan peak summit"
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Floating Telemetry Stats Badge (Slides up faster on scroll) */}
          <div
            ref={statsBoxRef}
            className="absolute right-[45%] top-[12%] bg-ink text-paper px-5 py-4 rounded-sm shadow-xl z-20 hidden md:block max-w-[150px]"
          >
            <span className="font-mono text-xl text-sage font-bold tracking-tight block">
              3,810m
            </span>
            <span className="font-body text-[8px] text-paper/60 tracking-[0.1em] uppercase block mt-1 leading-normal">
              Kedarkantha summit telemetry validation
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
