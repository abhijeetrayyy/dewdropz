'use client'

import { useSyncExternalStore } from 'react'

// "in 19h 48m".
//
// A departure time is a fact; a countdown is a nudge. The design leads every
// card with one because what makes somebody ask to come is noticing it is soon.
//
// ONE CLOCK FOR THE WHOLE BOARD. Every card subscribes to the same module-level
// ticker rather than owning a setInterval, so a board of thirty walks runs one
// timer and not thirty, and they all change in the same frame instead of
// drifting apart by however long each card took to mount. The timer only exists
// while something is watching it.
//
// useSyncExternalStore rather than useState in an effect: it is the sanctioned
// way to read a client-only value without a hydration mismatch. React uses
// `getServerSnapshot` for the server render AND for the first client render,
// then re-renders from the live snapshot — which is precisely the "absolute
// time first, counter after mount" behaviour, minus the cascading render that
// setting state synchronously in an effect would cause.

let current = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(notify: () => void) {
  listeners.add(notify)
  if (!timer) {
    // Ten seconds: a minute is too coarse for the final hour, where the count
    // is the whole point of looking, and one second is a re-render a second for
    // information nobody reads that fast.
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

const getSnapshot = () => current
const getServerSnapshot = () => null

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

export default function Countdown({
  iso,
  className = '',
  prefix = 'in',
}: {
  iso: string
  className?: string
  /** `in 4h 12m`, or pass '' for a bare `4h 12m`. */
  prefix?: string
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (now === null) {
    // Deterministic on both sides: an explicit timezone, never the server's.
    return (
      <span className={className}>
        {new Date(iso).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </span>
    )
  }

  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return <span className={className}>under way</span>

  const { d, h, m, s } = split(diff)
  const text =
    d > 0 ? `${d}d ${h}h`
    : h > 0 ? `${h}h ${m}m`
    : m > 0 ? `${m}m`
    : `${s}s`

  return (
    <span className={className}>
      {prefix ? `${prefix} ` : ''}
      {text}
    </span>
  )
}
