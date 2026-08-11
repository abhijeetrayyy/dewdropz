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
  const magnetic = useMagneticHover(0.45, 10)
  return (
    <motion.a
      ref={magnetic.ref as React.RefObject<HTMLAnchorElement>}
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      style={{ x: magnetic.x, y: magnetic.y }}
      href={href}
      aria-label={label}
      className="hover:text-white transition-colors"
    >
      {children}
    </motion.a>
  )
}
