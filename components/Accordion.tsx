'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface AccordionProps {
  title: string
  content: string
  defaultOpen?: boolean
  variant?: 'paper' | 'altitude'
  titleSize?: 'label' | 'question'
}

const VARIANT_STYLES = {
  paper: { border: 'border-rule', title: 'text-text', body: 'text-mid' },
  altitude: { border: 'border-white/10', title: 'text-white', body: 'text-white/60' },
} as const

export default function Accordion({
  title,
  content,
  defaultOpen = false,
  variant = 'paper',
  titleSize = 'label',
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const styles = VARIANT_STYLES[variant]
  const titleClass =
    titleSize === 'label'
      ? 'font-body text-[10px] tracking-[0.15em] uppercase'
      : 'font-display text-base md:text-lg'

  return (
    <div className={`border-t ${styles.border} py-4`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left gap-4"
      >
        <span className={`${titleClass} ${styles.title}`}>{title}</span>
        <span className={`font-body text-lg leading-none flex-shrink-0 ${styles.body}`}>{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className={`font-body text-sm mt-3 leading-relaxed ${styles.body}`}>{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
