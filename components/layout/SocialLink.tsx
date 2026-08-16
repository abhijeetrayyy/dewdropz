'use client'

import { motion } from 'motion/react'
import { useMagneticHover } from '@/hooks/useMagneticHover'

export function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  const { ref, x, y, onMouseMove, onMouseLeave } = useMagneticHover(0.45, 10)
  return (
    <motion.a
      ref={ref as React.RefObject<HTMLAnchorElement>}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ x, y }}
      href={href}
      aria-label={label}
      className="hover:text-white transition-colors"
    >
      {children}
    </motion.a>
  )
}
