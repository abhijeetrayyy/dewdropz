'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useMotionValue, useSpring, animate } from 'motion/react'

type CursorType = 'default' | 'image' | 'magnetic'

// Only elements explicitly opted in via data-cursor ever get the custom
// bubble — everywhere else (idle, plain links, body text) keeps the native
// system pointer. An earlier version replaced the cursor globally and had a
// dot+ring roam the whole page at all times; that read as an ambient
// gimmick rather than the "made for this card" feeling the hover bubble is
// meant to give, so it's now purely a hover-triggered effect.
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
  const ringX = useSpring(x, { stiffness: 220, damping: 24, mass: 0.6 })
  const ringY = useSpring(y, { stiffness: 220, damping: 24, mass: 0.6 })
  // Driven imperatively rather than via the declarative `animate` prop —
  // combining `animate` with external x/y motion values on the same element
  // left opacity/scale never actually applying (Framer never wrote them to
  // the DOM). Plain motion values updated with animate() sidestep that.
  const opacity = useMotionValue(0)
  const scale = useMotionValue(0.7)

  useEffect(() => {
    const oc = animate(opacity, active ? 1 : 0, { duration: 0.18 })
    const sc = animate(scale, active ? 1 : 0.7, { duration: 0.18 })
    return () => {
      oc.stop()
      sc.stop()
    }
  }, [active, opacity, scale])

  // matchMedia is browser-only. Rendering the custom cursor before knowing the
  // pointer type would put it on touch devices for a frame.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setPointerFine(mq.matches)
    const listener = (e: MediaQueryListEvent) => setPointerFine(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove('has-custom-cursor')
      return
    }

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
      if (!target) return
      const type = (target.dataset.cursor || 'default') as CursorType
      setCursorType(type)
      setActive(true)
      setLabel(target.dataset.cursorText || '')
      document.documentElement.classList.add('has-custom-cursor')

      if (type === 'magnetic') {
        const rect = target.getBoundingClientRect()
        setMagneticRect(rect)
        const style = window.getComputedStyle(target)
        setMagneticRadius(style.borderRadius || '8px')
      }
    }

    const out = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-cursor]')
      if (!target) return
      setActive(false)
      setLabel('')
      setMagneticRect(null)
      setCursorType('default')
      document.documentElement.classList.remove('has-custom-cursor')
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

  let ringWidth = 48
  let ringHeight = 48
  let ringRadius = '50%'
  let ringBg = 'rgba(123, 164, 111, 0.1)'
  let ringBorderColor = 'var(--sage)'
  let ringBackdropFilter = 'blur(0px)'

  if (cursorType === 'image') {
    ringWidth = 84
    ringHeight = 84
    ringBg = 'rgba(246, 243, 230, 0.15)'
    ringBorderColor = 'rgba(246, 243, 230, 0.35)'
    ringBackdropFilter = 'blur(4px)'
  } else if (cursorType === 'magnetic' && magneticRect) {
    ringWidth = magneticRect.width + 12
    ringHeight = magneticRect.height + 12
    ringRadius = magneticRadius
    ringBg = 'rgba(123, 164, 111, 0.05)'
    ringBorderColor = 'var(--sage)'
  }

  return (
    // Always mounted (while enabled) and driven purely by active-dependent
    // opacity/scale — no mount/unmount, no AnimatePresence exit-completion to
    // wait on. The inner element owns the spring-based size/shape/color morph
    // between hover targets independent of the outer show/hide animation.
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-[200]"
      style={{ x: ringX, y: ringY, translateX: '-50%', translateY: '-50%', opacity, scale }}
    >
      <motion.div
        className="flex items-center justify-center border text-center overflow-hidden"
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
    </motion.div>
  )
}
