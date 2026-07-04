'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { BLUR_DATA_URL, BRAND_STORY_IMAGE } from '@/lib/constants'
import ScrollReveal from '@/components/ScrollReveal'
import LiquidDewdrop3D from './LiquidDewdrop3D'

export default function BrandStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const markRef = useRef<SVGSVGElement>(null)
  const storyLink = useMagneticHover(0.4, 10)

  useEffect(() => {
    if (!sectionRef.current || !markRef.current) return
    const tween = gsap.to(markRef.current, {
      y: -30,
      scale: 1.08,
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
    <section ref={sectionRef} className="bg-altitude px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="font-body text-xs tracking-[0.18em] text-sage uppercase">Who We Are</div>

          <ScrollReveal
            containerClassName="mt-4"
            textClassName="!font-display !font-light !text-[clamp(28px,4vw,44px)] !text-white !leading-[1.15]"
          >
            Born on a foggy ridgeline. Tested on every one since.
          </ScrollReveal>

          <motion.div
            ref={storyLink.ref as React.RefObject<HTMLDivElement>}
            onMouseMove={storyLink.onMouseMove}
            onMouseLeave={storyLink.onMouseLeave}
            style={{ x: storyLink.x, y: storyLink.y }}
            className="mt-8 inline-block"
          >
            <Link
              href="/about"
              data-cursor="magnetic"
              data-cursor-text="Read"
              className="font-body text-xs text-sage tracking-[0.1em] uppercase hover:text-white transition-colors duration-300"
            >
              Read our story →
            </Link>
          </motion.div>
        </div>

        <div
          className="relative h-full min-h-[400px] rounded-lg flex items-center justify-center overflow-hidden select-none"
          style={{ background: 'linear-gradient(135deg, #1C3018 0%, #27481F 60%, #7BA46F 100%)' }}
        >
          <Image
            src={BRAND_STORY_IMAGE}
            alt="Foggy mountain summit"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover pointer-events-none"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(28,48,24,0.55) 0%, rgba(39,72,31,0.35) 60%, rgba(123,164,111,0.25) 100%)' }}
          />

          {/* WebGL 3D organic deforming liquid dewdrop */}
          <LiquidDewdrop3D />

          <svg
            ref={markRef}
            width="120"
            height="120"
            viewBox="0 0 100 100"
            className="relative z-10 opacity-75 pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
            fill="none"
            stroke="#F6F3EA"
            strokeWidth="2"
          >
            <path d="M50 15C35 35 25 50 25 65a25 25 0 0 0 50 0c0-15-10-30-25-50z" />
            <path d="M35 65l10-12 8 8 12-15" />
          </svg>
        </div>
      </div>
    </section>
  )
}
