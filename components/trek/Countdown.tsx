'use client'

import { useClock } from './useClock'

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
  endsIso,
  className = '',
  prefix = 'in',
}: {
  iso: string
  /** When the trip ends. Without it this cannot distinguish "out on the hill"
   *  from "over", which is why every past trek used to read "under way". */
  endsIso?: string | null
  className?: string
  /** `in 4h 12m`, or pass '' for a bare `4h 12m`. */
  prefix?: string
}) {
  const now = useClock()

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
  if (diff <= 0) {
    // Two states, where there needed to be three. Any past instant rendered
    // "under way" and stayed that way forever, so a walk from March still read
    // as in progress months later. With an `endsIso` in hand this can tell the
    // difference between a trip that is out on the hill and one that is over.
    if (endsIso) {
      const endDiff = new Date(endsIso).getTime() - now
      if (endDiff > 0) return <span className={className}>under way</span>
      return <span className={className}>finished</span>
    }
    // No end instant supplied: a single-instant countdown can only say that the
    // moment has passed, and "under way" is a claim it cannot support.
    return <span className={className}>started</span>
  }

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
