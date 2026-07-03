import { useRef } from 'react'
import { useMotionValue, useSpring } from 'motion/react'

export function useMagneticHover(strength = 0.35, max = 16) {
  const ref = useRef<HTMLElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 })

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - (rect.left + rect.width / 2)
    const relY = e.clientY - (rect.top + rect.height / 2)
    x.set(Math.max(-max, Math.min(max, relX * strength)))
    y.set(Math.max(-max, Math.min(max, relY * strength)))
  }

  const onMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return { ref, x: springX, y: springY, onMouseMove, onMouseLeave }
}
