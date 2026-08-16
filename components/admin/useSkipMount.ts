'use client'

import { useCallback, useRef } from 'react'

/**
 * Skips the first run of an effect, once.
 *
 * These list pages now receive their first page from the server render, so the
 * fetch they used to do on mount would be a second request for data already on
 * screen — and from functions running in US East that is a whole extra
 * round-trip before the page is usable.
 *
 * They still fetch on their own for everything after that: a new search term, a
 * new page, a reload after an edit. So the effect stays exactly as it was and
 * only its first invocation is skipped.
 *
 *     const skipMount = useSkipMount()
 *     useEffect(() => { if (skipMount()) return; load() }, [search, page])
 *
 * A ref rather than state, deliberately — flipping state here would itself
 * re-render and re-run the effect, which is the loop this is meant to avoid.
 */
export function useSkipMount() {
  const first = useRef(true)
  return useCallback(() => {
    if (first.current) {
      first.current = false
      return true
    }
    return false
  }, [])
}
