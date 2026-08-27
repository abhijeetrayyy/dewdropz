'use client'

import { motion } from 'motion/react'
import SplitText from '@/components/SplitText'

interface PageHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
  variant?: 'paper' | 'altitude' | 'ink'
}

const VARIANT_STYLES = {
  paper: { bg: 'bg-paper', title: 'text-text', subtitle: 'text-mid', eyebrow: 'text-forest' },
  altitude: { bg: 'bg-altitude', title: 'text-paper', subtitle: 'text-paper/65', eyebrow: 'text-sage' },
  ink: { bg: 'bg-ink', title: 'text-paper', subtitle: 'text-paper/60', eyebrow: 'text-sage' },
} as const

export default function PageHeader({ eyebrow, title, subtitle, variant = 'paper' }: PageHeaderProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <section className={`relative overflow-hidden px-6 md:px-10 pt-32 pb-16 md:pt-40 md:pb-20 ${styles.bg}`}>
      {/* ── The ground behind the title ──────────────────────────────────────
          Was two rounded blobs, 420px, anchored at right:-120px so a third of
          the shape hung off the viewport, at 6% opacity. What actually landed
          on screen was a faint partial arc in the top-right corner that read as
          a stray circle — decoration that decorated nothing, on seven pages.

          They were clearly *meant* to be contour lines, so this draws contour
          lines properly: six nested rings closing on an off-centre high point,
          each one irregular and none concentric with the next, which is how a
          summit actually prints on a survey map. That ties the page furniture
          to the same altitude language the trail HUD, the product coordinates
          and the footer readout already speak, instead of being a shape.

          Centred behind the title rather than pushed off the edge, so the type
          sits INSIDE the contours — the title is the summit. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.07] md:h-[680px] md:w-[680px]"
        aria-hidden
      >
        <svg viewBox="0 0 200 200" className="h-full w-full fill-none" strokeWidth="0.5">
          <g className={variant === 'paper' ? 'stroke-forest' : 'stroke-sage'}>
            <path d="M100 12 C140 16 176 44 184 84 C192 128 160 176 108 184 C58 192 18 160 12 116 C6 70 44 16 100 12 Z" />
            <path d="M101 34 C133 38 161 60 168 92 C175 126 149 164 107 170 C67 176 35 150 30 114 C25 76 56 30 101 34 Z" />
            <path d="M103 56 C127 60 147 76 152 100 C158 126 138 152 106 156 C76 160 52 140 48 112 C44 82 69 53 103 56 Z" />
            <path d="M104 78 C121 81 134 92 137 108 C141 126 127 142 105 144 C84 146 68 132 65 112 C62 90 81 76 104 78 Z" />
            <path d="M105 98 C115 100 123 107 125 116 C127 126 118 134 105 135 C93 136 84 128 82 117 C80 105 92 97 105 98 Z" />
            <path d="M106 114 C111 115 115 119 115 123 C115 128 110 131 105 131 C99 131 95 127 95 122 C95 117 100 113 106 114 Z" />
          </g>
        </svg>
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`font-body text-[10px] tracking-[0.3em] uppercase ${styles.eyebrow}`}
        >
          {eyebrow}
        </motion.div>

        <div className={`mt-5 font-display font-light text-[clamp(38px,7vw,80px)] leading-[1.05] ${styles.title}`}>
          <SplitText
            text={title}
            tag="h1"
            splitType="words"
            delay={35}
            duration={1.1}
            ease="power4.out"
            from={{ opacity: 0, y: '70%' }}
            to={{ opacity: 1, y: '0%' }}
            className="!inline"
          />
        </div>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`mt-6 font-body text-sm md:text-base leading-relaxed max-w-xl mx-auto ${styles.subtitle}`}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  )
}
