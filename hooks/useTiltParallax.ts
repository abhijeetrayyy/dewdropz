import { useEffect, useRef } from 'react'
import { animate, useMotionValue, useSpring } from 'motion/react'

export function useTiltParallax(maxX = 6, maxY = 10) {
  const ref = useRef<HTMLDivElement>(null)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const rotateX = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 })
  const rotateY = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 })
  const drift = useMotionValue(0)

  useEffect(() => {
    const controls = animate(drift, [-1, 1], {
      duration: 7,
      repeat: Infinity,
      repeatType: 'mirror',
      ease: 'easeInOut',
    })
    return () => controls.stop()
  }, [drift])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      rawX.set(-py * maxX)
      rawY.set(px * maxY)
    }
    const handleLeave = () => {
      rawX.set(0)
      rawY.set(0)
    }

    el.addEventListener('pointermove', handleMove)
    el.addEventListener('pointerleave', handleLeave)
    return () => {
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerleave', handleLeave)
    }
  }, [maxX, maxY, rawX, rawY])

  return { ref, rotateX, rotateY, drift }
}
