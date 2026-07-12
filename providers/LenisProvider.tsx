'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const { introDone } = useIntro()
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  // Per-session memory of how far down each route was scrolled, so browser
  // Back/Forward can restore position like a normal multi-page site while a
  // fresh Link click always lands at the top. Lives in a ref on this provider
  // (mounted once for the whole app) rather than sessionStorage — nothing here
  // needs to survive a hard reload, and a plain Map avoids parsing/serializing.
  const scrollMemory = useRef(new Map<string, number>())
  // next/link pushes history silently; only real Back/Forward fires popstate —
  // that's the one reliable signal to tell "new page" from "returning to one."
  const isPopNavigation = useRef(false)

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

  useEffect(() => {
    const onPopState = () => {
      isPopNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // The actual fix for "sometimes lands mid-page instead of at the top": Lenis
  // owns scroll rendering, so it has its own idea of the current scroll offset
  // independent of the DOM. Next.js's App Router does try to scroll to top on
  // navigation, but Lenis's rAF loop keeps re-asserting whatever position it
  // held on the *previous* page for another frame or two afterward — a race,
  // not a guarantee, which is exactly why this only showed up "sometimes."
  // Explicitly resetting Lenis's own position on every route change closes
  // that gap; on the way, this also restores Back/Forward to the scroll
  // position the page was at before you left it, matching normal browser
  // navigation instead of the flat "always top" a plain reset would give.
  //
  // Also subsumes the original "re-measure ScrollTrigger once the intro
  // finishes" fix — the same refresh-and-resize is needed on every route
  // change, not just the first one, so it's one effect instead of two.
  useEffect(() => {
    const lenis = lenisRef.current
    if (!lenis || !introDone) return

    const from = prevPathname.current
    if (from !== pathname) {
      scrollMemory.current.set(from, lenis.scroll)
    }

    const remembered = isPopNavigation.current ? scrollMemory.current.get(pathname) : undefined

    // Let the new route's DOM finish painting before measuring it — pinned
    // sections and page height differ per route, and jumping first would let
    // Lenis clamp against the outgoing page's (wrong) content height.
    requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      lenis.scrollTo(remembered ?? 0, { immediate: true })
    })

    isPopNavigation.current = false
    prevPathname.current = pathname
  }, [pathname, introDone])

  return <div>{children}</div>
}
