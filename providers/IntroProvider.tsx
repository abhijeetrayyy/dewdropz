'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface IntroContextValue {
  introDone: boolean
  finishIntro: () => void
}

const IntroContext = createContext<IntroContextValue | null>(null)

/**
 * When the page is allowed to begin.
 *
 * WHY THIS IS A GUARANTEE AND NOT A FAVOUR
 *
 * `introDone` used to become true for exactly one reason: <Preloader/> called
 * `finishIntro()`. Anything that waited on it was therefore not waiting on a
 * condition, it was depending on a component continuing to exist — so deleting
 * the preloader would have silently switched those things off forever, with no
 * error and nothing to grep for.
 *
 * The fallback below closes that. If nothing announces the end of the intro
 * within `INTRO_FALLBACK`, this provider announces it. Whoever waits on the
 * signal now waits on the provider's promise, and the preloader can be
 * shortened, changed or deleted without stranding the page.
 *
 * WHAT WAITS ON IT
 *
 * The hero headline's choreography (`globals.css`, "the turn"), via the
 * `data-intro-done` attribute this sets on <html>. The headline's animations
 * are CSS and would otherwise begin at first paint — underneath a curtain that
 * does not lift until about a second later, so the whole cream-roman opening
 * of the line played to nobody on a first visit. It now begins when the page
 * is actually on screen.
 *
 * The attribute, not React state, because the thing waiting is a stylesheet.
 * If it never arrives — no JavaScript, a dropped chunk — no animation binds,
 * and the line simply is its finished self. That is the same failure mode the
 * rest of this hero is built around: never let a missing signal take the words
 * away, only the motion.
 */
const INTRO_FALLBACK = 1400

export function IntroProvider({ children }: { children: React.ReactNode }) {
  const [introDone, setIntroDone] = useState(false)
  const finishIntro = useCallback(() => setIntroDone(true), [])
  const value = useMemo(() => ({ introDone, finishIntro }), [introDone, finishIntro])

  useEffect(() => {
    if (introDone) return
    const id = setTimeout(finishIntro, INTRO_FALLBACK)
    return () => clearTimeout(id)
  }, [introDone, finishIntro])

  useEffect(() => {
    if (!introDone) return
    const root = document.documentElement
    root.dataset.introDone = ''
    return () => {
      delete root.dataset.introDone
    }
  }, [introDone])

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>
}

export function useIntro() {
  const ctx = useContext(IntroContext)
  if (!ctx) throw new Error('useIntro must be used within IntroProvider')
  return ctx
}
