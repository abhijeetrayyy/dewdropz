'use client'

import { motion } from 'motion/react'
import { FOUNDER_QUOTE } from '@/lib/constants'

// A founder's-letter treatment rather than a stock "team photo" — there's no
// real photograph of the founder to use here, and presenting a stock or
// generated face as if it were one would misrepresent a real named person.
// The topographic watermark + signature-style name is the honest version of
// a premium founder spotlight: real words, real name, no fabricated image.
export default function FounderNote() {
  return (
    <section className="relative bg-paper px-6 md:px-10 py-24 md:py-32 overflow-hidden">
      <div
        className="absolute top-1/2 left-[-140px] -translate-y-1/2 w-[480px] h-[480px] opacity-[0.05] pointer-events-none select-none"
        aria-hidden
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-none" strokeWidth="0.4">
          <path d="M50 10 C70 12, 85 25, 90 50 C95 75, 75 90, 50 90 C25 90, 5 70, 10 50 C15 30, 30 8, 50 10 Z" className="stroke-forest" />
          <path d="M50 25 C62 27, 72 35, 75 50 C78 65, 68 75, 50 75 C32 75, 20 62, 25 50 C30 38, 38 23, 50 25 Z" className="stroke-forest" />
          <path d="M50 40 C55 41, 60 45, 62 50 C64 55, 58 60, 50 60 C42 60, 36 54, 38 50 C40 46, 45 39, 50 40 Z" className="stroke-forest" />
        </svg>
      </div>

      <div className="relative max-w-2xl mx-auto">
        <div className="font-body text-[10px] tracking-[0.3em] text-forest uppercase">A Note From The Founder</div>

        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-forest/40 mt-8 mb-6">
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
          className="font-display font-light italic text-[clamp(24px,3.6vw,38px)] text-text leading-[1.4]"
        >
          &ldquo;{FOUNDER_QUOTE.quote}&rdquo;
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-12 pt-8 border-t border-rule"
        >
          <div className="font-display italic text-[clamp(28px,3.2vw,36px)] text-forest leading-none">
            {FOUNDER_QUOTE.name}
          </div>
          <div className="mt-3 font-body text-xs tracking-[0.15em] text-mid uppercase">{FOUNDER_QUOTE.role}, DEWDROPZ</div>
        </motion.div>
      </div>
    </section>
  )
}
