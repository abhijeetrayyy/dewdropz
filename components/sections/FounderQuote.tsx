'use client'

import { motion } from 'motion/react'
import { FOUNDER_QUOTE } from '@/lib/constants'

export default function FounderQuote() {
  return (
    <section className="bg-ink px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-3xl mx-auto text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto text-sage/50 mb-8">
          <path
            d="M7 11c0-3 2-5 5-5v2c-2 0-3 1-3 3h3v6H6v-6zm9 0c0-3 2-5 5-5v2c-2 0-3 1-3 3h3v6h-6v-6z"
            fill="currentColor"
          />
        </svg>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="font-display font-light italic text-[clamp(22px,3.2vw,34px)] text-paper leading-[1.4]"
        >
          &ldquo;{FOUNDER_QUOTE.quote}&rdquo;
        </motion.p>
        <div className="mt-8 font-body text-xs tracking-[0.1em] text-sage uppercase">{FOUNDER_QUOTE.name}</div>
        <div className="mt-1 font-body text-xs text-paper/40">{FOUNDER_QUOTE.role}</div>
      </div>
    </section>
  )
}
