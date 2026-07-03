'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface IntroContextValue {
  introDone: boolean
  finishIntro: () => void
}

const IntroContext = createContext<IntroContextValue | null>(null)

export function IntroProvider({ children }: { children: React.ReactNode }) {
  const [introDone, setIntroDone] = useState(false)
  const finishIntro = useCallback(() => setIntroDone(true), [])
  const value = useMemo(() => ({ introDone, finishIntro }), [introDone, finishIntro])

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>
}

export function useIntro() {
  const ctx = useContext(IntroContext)
  if (!ctx) throw new Error('useIntro must be used within IntroProvider')
  return ctx
}
