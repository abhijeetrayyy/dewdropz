import { useEffect, useState } from 'react'

// True only once the client has taken over from SSR — the documented pattern
// in node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
// for client-only persisted state (localStorage, etc). useSyncExternalStore's
// usual dual-snapshot hydration guarantee doesn't hold in this fork, so this
// effect-based gate (which the same doc confirms avoids the hydration error,
// at the cost of a one-frame flash) is the correct fix here.
export function useHasMounted() {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
  useEffect(() => setMounted(true), [])
  return mounted
}
