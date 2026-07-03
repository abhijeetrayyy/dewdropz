'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'
import { useMagneticHover } from '@/hooks/useMagneticHover'
import { useTiltParallax } from '@/hooks/useTiltParallax'
import BlurText from '@/components/BlurText'
import SplitText from '@/components/SplitText'

export default function HeroSection() {
  const { introDone } = useIntro()
  const sectionRef = useRef<HTMLElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const textContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState(0)

  const primaryCta = useMagneticHover(0.3, 14)
  const secondaryCta = useMagneticHover(0.3, 14)
  const tilt = useTiltParallax(5, 8)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause()
    }
  }, [])

  useEffect(() => {
    if (!introDone) return
    const timers = [
      setTimeout(() => setStage(1), 0),
      setTimeout(() => setStage(2), 600),
      setTimeout(() => setStage(3), 1200),
      setTimeout(() => setStage(4), 1600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [introDone])

  // Parallax scroll effect for background peaks vs foreground text
  useEffect(() => {
    if (!parallaxRef.current || !sectionRef.current || !textContainerRef.current) return
    
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    })

    // Background moves down and scales slightly
    tl.to(parallaxRef.current, {
      yPercent: 20,
      scale: 1.05,
      ease: 'none',
    }, 0)

    // Foreground text moves up and fades out, creating immense depth
    tl.to(textContainerRef.current, {
      yPercent: -40,
      scale: 0.9,
      opacity: 0,
      ease: 'none',
    }, 0)

    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="relative min-h-screen bg-ink overflow-hidden flex items-center justify-center select-none">
      {/* Layer 1: Cinematic trekking footage background */}
      <div ref={parallaxRef} className="absolute inset-0 z-0 origin-bottom overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 46, repeat: Infinity, ease: 'easeInOut' }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            poster="/videos/hero-trek-poster.jpg"
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          >
            <source src="/videos/hero-trek.mp4" type="video/mp4" />
          </video>
        </motion.div>
        {/* Gentle ambient overlays for text legibility */}
        <div className="absolute inset-0 bg-ink/45 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-transparent to-ink/70 pointer-events-none" />
        {/* Soft cinematic vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(12,16,13,0.55) 100%)' }}
        />

        {/* Expedition telemetry detail */}
        {stage >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute bottom-8 right-6 md:right-10 flex flex-col items-end gap-0.5 select-none"
          >
            <span className="font-mono text-[9px] tracking-[0.2em] text-paper/60 uppercase">
              Dehradun, India
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] text-sage/70 uppercase">
              Alt. 3,800m — Trail Active
            </span>
          </motion.div>
        )}
      </div>

      {/* Layer 3: Interactive 3D Depth Content Card */}
      <div
        ref={tilt.ref}
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{ perspective: 1200 }}
      >
        <motion.div
          className="relative w-full h-full flex flex-col items-center justify-center"
          style={{ transformStyle: 'preserve-3d', rotateX: tilt.rotateX, rotateY: tilt.rotateY, y: tilt.drift }}
        >
          {/* Plain (non-Framer) node: GSAP owns this element's transform/opacity exclusively
              for the scroll-linked depth fade, so it never fights with the tilt motion values above. */}
          <div
            ref={textContainerRef}
            className="relative w-full h-full flex flex-col items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
          <motion.div
            style={{ translateZ: 80 }}
            className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center justify-center pt-12"
          >
            {stage >= 1 && (
              <BlurText
                text="BRAND IDENTITY"
                animateBy="words"
                direction="top"
                delay={200}
                className="justify-center font-body text-[10px] tracking-[0.35em] text-sage font-medium uppercase"
              />
            )}

            <div className="mt-5 font-display font-light text-[clamp(64px,13vw,150px)] leading-[0.88] tracking-[-0.03em] select-none flex flex-col md:flex-row items-center justify-center gap-4">
              {stage >= 2 && (
                <SplitText
                  text="DEW"
                  tag="span"
                  splitType="chars"
                  delay={50}
                  duration={1.2}
                  ease="power4.out"
                  from={{ opacity: 0, y: 100 }}
                  to={{ opacity: 1, y: 0 }}
                  className="!block text-paper"
                />
              )}
              {stage >= 2 && (
                <SplitText
                  text="DROPZ"
                  tag="span"
                  splitType="chars"
                  delay={50}
                  duration={1.2}
                  ease="power4.out"
                  from={{ opacity: 0, y: 100 }}
                  to={{ opacity: 1, y: 0 }}
                  className="!block text-sage font-semibold"
                />
              )}
            </div>

            {stage >= 3 && (
              <BlurText
                text="— Feel Alive"
                animateBy="words"
                direction="top"
                delay={250}
                className="justify-center mt-5 font-display italic text-sage/90 text-[clamp(18px,2.2vw,28px)]"
              />
            )}

            {stage >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="mt-10 flex items-center gap-4 z-20"
              >
                <motion.div
                  ref={primaryCta.ref as React.RefObject<HTMLDivElement>}
                  onMouseMove={primaryCta.onMouseMove}
                  onMouseLeave={primaryCta.onMouseLeave}
                  style={{ x: primaryCta.x, y: primaryCta.y }}
                >
                  <Link
                    href="/collections"
                    data-cursor="magnetic"
                    data-cursor-text="Explore"
                    className="block bg-forest text-paper px-8 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body font-medium rounded-sm hover:bg-forest-mid transition-colors duration-300"
                  >
                    Explore Collections
                  </Link>
                </motion.div>
                <motion.div
                  ref={secondaryCta.ref as React.RefObject<HTMLDivElement>}
                  onMouseMove={secondaryCta.onMouseMove}
                  onMouseLeave={secondaryCta.onMouseLeave}
                  style={{ x: secondaryCta.x, y: secondaryCta.y }}
                >
                  <Link
                    href="/about"
                    data-cursor="magnetic"
                    data-cursor-text="Read"
                    className="block border border-paper/20 text-paper/70 px-8 py-3.5 text-[10px] tracking-[0.12em] uppercase font-body rounded-sm hover:text-paper hover:border-paper/40 transition-colors duration-300"
                  >
                    Our Story
                  </Link>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Bounce indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-40 animate-bounce z-30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F6F3EA" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  )
}
