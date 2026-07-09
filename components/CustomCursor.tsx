'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useMotionValue, useSpring } from 'motion/react'

type CursorType = 'default' | 'text' | 'image' | 'magnetic'

export default function CustomCursor() {
  const pathname = usePathname()
  // Admin is a working tool, not part of the brand site — a hidden native cursor
  // there is a usability regression, not a stylistic choice.
  const isAdminRoute = pathname?.startsWith('/admin') ?? false
  const [pointerFine, setPointerFine] = useState(false)
  const enabled = pointerFine && !isAdminRoute
  const [active, setActive] = useState(false)
  const [label, setLabel] = useState('')
  const [cursorType, setCursorType] = useState<CursorType>('default')
  const [magneticRect, setMagneticRect] = useState<DOMRect | null>(null)
  const [magneticRadius, setMagneticRadius] = useState('9999px')

  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  
  // High responsive springs for the core dot, slightly slower springs for the outer ring for fluid offset
  const dotX = useSpring(x, { stiffness: 1000, damping: 40 })
  const dotY = useSpring(y, { stiffness: 1000, damping: 40 })
  const ringX = useSpring(x, { stiffness: 220, damping: 24, mass: 0.6 })
  const ringY = useSpring(y, { stiffness: 220, damping: 24, mass: 0.6 })

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    setPointerFine(mq.matches)
    const listener = (e: MediaQueryListEvent) => setPointerFine(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (!enabled) {
      // Covers the SPA-navigation case: pointerFine stays true when a client-side
      // route change lands on /admin, so the class has to be dropped explicitly here
      // rather than relying on this effect simply not running.
      document.documentElement.classList.remove('has-custom-cursor')
      return
    }
    document.documentElement.classList.add('has-custom-cursor')

    const move = (e: PointerEvent) => {
      if (magneticRect) {
        const centerX = magneticRect.left + magneticRect.width / 2
        const centerY = magneticRect.top + magneticRect.height / 2
        // Give 15% cursor pull offset to create a high-fidelity "elastic" stick feeling
        const pullX = (e.clientX - centerX) * 0.15
        const pullY = (e.clientY - centerY) * 0.15
        x.set(centerX + pullX)
        y.set(centerY + pullY)
      } else {
        x.set(e.clientX)
        y.set(e.clientY)
      }
    }

    const over = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-cursor]') as HTMLElement | null
      if (target) {
        const type = (target.dataset.cursor || 'default') as CursorType
        setCursorType(type)
        setActive(true)
        setLabel(target.dataset.cursorText || '')

        if (type === 'magnetic') {
          const rect = target.getBoundingClientRect()
          setMagneticRect(rect)
          const style = window.getComputedStyle(target)
          setMagneticRadius(style.borderRadius || '8px')
        }
      } else {
        const isText = (e.target as HTMLElement)?.closest?.('p, h1, h2, h3, h4, h5, h6, blockquote, li')
        const isInteractive = (e.target as HTMLElement)?.closest?.('a, button, input, textarea, select')
        if (isInteractive) {
          setCursorType('default')
          setActive(true)
        } else if (isText) {
          setCursorType('text')
        } else {
          setCursorType('default')
          setActive(false)
        }
      }
    }

    const out = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-cursor]')
      const isInteractive = (e.target as HTMLElement)?.closest?.('a, button, input, textarea')
      if (target || isInteractive) {
        setActive(false)
        setLabel('')
        setMagneticRect(null)
        setCursorType('default')
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerover', over)
    window.addEventListener('pointerout', out)
    return () => {
      document.documentElement.classList.remove('has-custom-cursor')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      window.removeEventListener('pointerout', out)
    }
  }, [enabled, x, y, magneticRect])

  if (!enabled) return null

  // Determine styles dynamically based on cursor state
  let ringWidth = 32
  let ringHeight = 32
  let ringRadius = '50%'
  let ringBg = 'rgba(123, 164, 111, 0)'
  let ringBorderColor = 'rgba(123, 164, 111, 0.6)'
  let ringBackdropFilter = 'blur(0px)'

  if (cursorType === 'text') {
    ringWidth = 2
    ringHeight = 24
    ringRadius = '1px'
    ringBg = 'var(--sage)'
    ringBorderColor = 'rgba(123, 164, 111, 0)'
  } else if (cursorType === 'image') {
    ringWidth = 84
    ringHeight = 84
    ringRadius = '50%'
    ringBg = 'rgba(246, 243, 230, 0.15)'
    ringBorderColor = 'rgba(246, 243, 230, 0.35)'
    ringBackdropFilter = 'blur(4px)'
  } else if (cursorType === 'magnetic' && magneticRect) {
    ringWidth = magneticRect.width + 12
    ringHeight = magneticRect.height + 12
    ringRadius = magneticRadius
    ringBg = 'rgba(123, 164, 111, 0.05)'
    ringBorderColor = 'var(--sage)'
  } else if (active) {
    // Hovering normal interactive links
    ringWidth = 48
    ringHeight = 48
    ringRadius = '50%'
    ringBg = 'rgba(123, 164, 111, 0.1)'
    ringBorderColor = 'var(--sage)'
  }

  return (
    <>
      {/* Tiny focal point dot (hidden in text selection mode for readability) */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[200] h-1.5 w-1.5 rounded-full bg-sage"
        style={{ x: dotX, y: dotY, translateX: '-50%', translateY: '-50%' }}
        animate={{
          scale: cursorType === 'text' ? 0 : 1,
          opacity: cursorType === 'magnetic' ? 0.3 : 1,
        }}
        transition={{ duration: 0.15 }}
      />
      {/* Outer morphing ring */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[200] flex items-center justify-center border text-center overflow-hidden"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          width: ringWidth,
          height: ringHeight,
          borderRadius: ringRadius,
          backgroundColor: ringBg,
          borderColor: ringBorderColor,
          backdropFilter: ringBackdropFilter,
        }}
        transition={{
          type: 'spring',
          stiffness: cursorType === 'magnetic' ? 350 : 250,
          damping: cursorType === 'magnetic' ? 25 : 22,
          mass: 0.5,
        }}
      >
        {label && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-body text-[10px] font-semibold tracking-[0.12em] uppercase text-paper drop-shadow"
          >
            {label}
          </motion.span>
        )}
      </motion.div>
    </>
  )
}
