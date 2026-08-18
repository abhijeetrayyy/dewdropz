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
  className = '',
  prefix = 'in',
}: {
  iso: string
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
