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
  altitude: { bg: 'bg-altitude', title: 'text-white', subtitle: 'text-white/65', eyebrow: 'text-sage' },
  ink: { bg: 'bg-ink', title: 'text-paper', subtitle: 'text-paper/60', eyebrow: 'text-sage' },
} as const

export default function PageHeader({ eyebrow, title, subtitle, variant = 'paper' }: PageHeaderProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <section className={`relative overflow-hidden px-6 md:px-10 pt-36 pb-20 md:pt-44 md:pb-28 ${styles.bg}`}>
      <div
        className="absolute top-1/2 right-[-120px] -translate-y-1/2 w-[420px] h-[420px] opacity-[0.06] pointer-events-none select-none"
        aria-hidden
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-none" strokeWidth="0.4">
          <path d="M50 10 C70 12, 85 25, 90 50 C95 75, 75 90, 50 90 C25 90, 5 70, 10 50 C15 30, 30 8, 50 10 Z" className={variant === 'paper' ? 'stroke-forest' : 'stroke-sage'} />
          <path d="M50 25 C62 27, 72 35, 75 50 C78 65, 68 75, 50 75 C32 75, 20 62, 25 50 C30 38, 38 23, 50 25 Z" className={variant === 'paper' ? 'stroke-forest' : 'stroke-sage'} />
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
