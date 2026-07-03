'use client'

import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const { introDone } = useIntro()

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.07,
      duration: 1.4,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)
    const update = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    const resizeLenis = () => lenis.resize()
    ScrollTrigger.addEventListener('refresh', resizeLenis)
    ScrollTrigger.refresh()

    return () => {
      ScrollTrigger.removeEventListener('refresh', resizeLenis)
      gsap.ticker.remove(update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // The Preloader locks body scroll and covers the page for ~2-3s while fonts/layout
  // settle. Any ScrollTrigger created during that window (e.g. FeaturedGear's reveal)
  // measures against a not-yet-final layout, so its start position can end up stale —
  // the trigger then never fires and the section stays stuck at its "from" (invisible)
  // state. Re-measuring once the intro finishes and scroll unlocks fixes that for every
  // ScrollTrigger on the page, not just one section.
  useEffect(() => {
    if (!introDone) return
    lenisRef.current?.resize()
    ScrollTrigger.refresh()
  }, [introDone])

  return <div>{children}</div>
}
