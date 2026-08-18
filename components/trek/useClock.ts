'use client'

import { useSyncExternalStore } from 'react'

// One clock for everything on the page that shows a relative time.
//
// Extracted from Countdown when the chat needed the same thing. Two components
// each owning a setInterval is two timers and two sets of times that drift
// apart by however long each took to mount; this way every "4h ago" and every
// "in 2d 3h" on a page changes in the same frame.
//
// The reason it is useSyncExternalStore rather than useState-in-an-effect: React
// uses `getServerSnapshot` for the server render AND for the first client
// render, then re-renders from the live value. That gives an absolute time
// first and a relative one after mount — no hydration mismatch, and none of the
// cascading render that setting state synchronously inside an effect causes.

let current = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(notify: () => void) {
  listeners.add(notify)
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now()
      listeners.forEach((l) => l())
    }, 10_000)
  }
  return () => {
    listeners.delete(notify)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Milliseconds since the epoch on the client, or null during SSR and hydration. */
export function useClock(): number | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}
