'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import BlurText from '@/components/BlurText'
import SplitText from '@/components/SplitText'
import Particles from '@/components/Particles'

const MOUNTAIN_PATH =
  'M0,260 L120,140 L220,220 L340,80 L460,200 L600,60 L740,180 L860,40 L1000,190 L1140,100 L1260,210 L1440,150'

export default function HeroSection() {
  const mountainPathRef = useRef<SVGPathElement>(null)
  const [isClient, setIsClient] = useState(false)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const path = mountainPathRef.current
    if (!path) return
    const length = path.getTotalLength()
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
    gsap.to(path, {
      strokeDashoffset: 0,
      duration: 2.4,
      ease: 'power3.out',
      delay: 0.4,
    })
  }, [])

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 0),
      setTimeout(() => setStage(2), 600),
      setTimeout(() => setStage(3), 1200),
      setTimeout(() => setStage(4), 1600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <section className="relative min-h-screen bg-ink overflow-hidden flex items-center justify-center">
      {isClient && (
        <div className="absolute inset-0">
          <Particles
            particleCount={60}
            particleColors={['#7BA46F']}
            particleBaseSize={40}
            speed={0.1}
            sizeRandomness={1}
            alphaParticles
            disableRotation={false}
          />
        </div>
      )}

      <svg
        className="absolute bottom-0 left-0 w-full h-[40vh] opacity-20"
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        fill="none"
      >
        <path ref={mountainPathRef} d={MOUNTAIN_PATH} stroke="#27481F" strokeWidth="2" fill="none" />
      </svg>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
        {stage >= 1 && (
          <BlurText
            text="BRAND IDENTITY"
            animateBy="words"
            direction="top"
            delay={200}
            className="justify-center font-body text-xs tracking-[0.3em] text-sage uppercase"
          />
        )}

        <div className="mt-6 font-display font-light text-[clamp(64px,13vw,160px)] leading-[0.88] tracking-[-0.025em]">
          {stage >= 2 && (
            <SplitText
              text="DEW"
              tag="span"
              splitType="chars"
              delay={40}
              duration={1}
              ease="power4.out"
              from={{ opacity: 0, y: 120 }}
              to={{ opacity: 1, y: 0 }}
              className="!block text-paper"
            />
          )}
          {stage >= 2 && (
            <SplitText
              text="DROPZ"
              tag="span"
              splitType="chars"
              delay={40}
              duration={1}
              ease="power4.out"
              from={{ opacity: 0, y: 120 }}
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
            delay={200}
            className="justify-center mt-6 font-display italic text-sage text-[clamp(18px,2.5vw,30px)]"
          />
        )}

        {stage >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 flex items-center gap-4"
          >
            <button className="bg-forest text-paper px-8 py-3 text-xs tracking-[0.1em] uppercase font-body font-medium hover:scale-[1.03] transition-transform duration-300">
              Explore Collections
            </button>
            <button className="border border-paper/30 text-paper/70 px-8 py-3 text-xs tracking-[0.1em] uppercase font-body hover:scale-[1.03] transition-transform duration-300">
              Our Story
            </button>
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-40 animate-bounce">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F6F3EA" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  )
}
