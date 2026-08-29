'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Whether this visitor has agreed to being measured.
 *
 * India's DPDP Act and the GDPR both want the same thing here: analytics and
 * advertising cookies are set only after a free, informed, revocable yes — and
 * refusing has to be exactly as easy as agreeing. Before this, Google Analytics
 * and the Meta Pixel loaded on first paint for everybody, with no basis at all.
 *
 * Three states, and the difference matters:
 *
 *   'unknown'  — not asked yet. Nothing loads, and the banner shows.
 *   'granted'  — asked and agreed. Trackers may load.
 *   'denied'   — asked and refused. Nothing loads, and we do not ask again.
 *
 * Deliberately NOT a "necessary cookies" toggle with everything pre-ticked.
 * The only cookies this site sets without asking are the ones that keep you
 * signed in and your cart intact, which are not a choice and are not tracking.
 */

export type ConsentState = 'unknown' | 'granted' | 'denied'

const STORAGE_KEY = 'dewdropz_consent'

type ConsentValue = {
  consent: ConsentState
  /** False until localStorage has been read — the banner must not flash. */
  hydrated: boolean
  grant: () => void
  deny: () => void
  /** Re-opens the choice, for the footer link. */
  reset: () => void
}

const ConsentContext = createContext<ConsentValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>('unknown')
  const [hydrated, setHydrated] = useState(false)

  // Reading the stored answer is a one-way sync from an external system
  // (localStorage) that cannot be read on the server — the same shape as
  // CartProvider's hydration, and the rule's documented exception. `hydrated`
  // is what stops the banner flashing for a visitor who already answered.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === 'granted' || raw === 'denied') setConsent(raw)
    } catch {
      // A browser with storage blocked simply gets asked again. That is the
      // safe direction: it never assumes a yes.
    }
    setHydrated(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const write = useCallback((next: ConsentState) => {
    setConsent(next)
    try {
      if (next === 'unknown') window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Choice still applies for this page view.
    }
  }, [])

  const grant = useCallback(() => write('granted'), [write])

  const deny = useCallback(() => {
    write('denied')
    // A script already injected cannot be un-injected, and gtag/fbq keep their
    // globals. If somebody withdraws consent in a session where they had given
    // it, a reload is the only honest way to stop the measuring.
    if (typeof window !== 'undefined' && 'gtag' in window) window.location.reload()
  }, [write])

  const reset = useCallback(() => write('unknown'), [write])

  return (
    <ConsentContext.Provider value={{ consent, hydrated, grant, deny, reset }}>
      {children}
    </ConsentContext.Provider>
  )
}

export function useConsent() {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider')
  return ctx
}
