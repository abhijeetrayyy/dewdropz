'use client'

import { motion } from 'motion/react'
import ScrollReveal from '@/components/ScrollReveal'

export default function BrandStory() {
  return (
    <section className="bg-altitude px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <div className="font-body text-xs tracking-[0.18em] text-sage uppercase">Who We Are</div>

          <ScrollReveal
            containerClassName="mt-4"
            textClassName="!font-display !font-light !text-[clamp(36px,5.5vw,64px)] !text-white !leading-[1.05]"
          >
            Built for the people who go.
          </ScrollReveal>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-body text-sm text-white/65 leading-relaxed max-w-sm mt-6"
          >
            DEWDROPZ was born on a foggy ridgeline, where the air is thin and the noise of the world
            disappears. We build gear for the people who chase that quiet.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-body text-sm text-white/65 leading-relaxed max-w-sm mt-4"
          >
            Every stitch, strap, and seam is tested against altitude, mist, and mud — so you can go
            further without thinking twice.
          </motion.p>

          <a
            href="#"
            className="font-body text-xs text-sage tracking-[0.1em] uppercase mt-8 inline-block hover:text-white transition-colors duration-300"
          >
            Read our story →
          </a>
        </div>

        <div
          className="relative h-full min-h-[400px] rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1C3018 0%, #27481F 60%, #7BA46F 100%)' }}
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            className="opacity-40"
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
