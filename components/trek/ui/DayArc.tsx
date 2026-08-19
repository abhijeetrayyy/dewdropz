import Link from 'next/link'
import { HOUR_BANDS, dotColor, type HourLight } from '@/lib/trek'

// The board's temporal index: a day, painted, with the walks sitting in it.
//
// The single question people actually arrive with is "is there anything early
// this week?" — and the old board answered it by making you read every card's
// hour one at a time. Five bands with counts in them answers it in one look,
// and each band is a filter, so the answer is also the control.
//
// This is the clearest statement of the product's thesis anywhere on it: the
// board is a day, and you are choosing a part of the day to be out in.

export default function DayArc({
  counts,
  active,
  hrefFor,
  ground = 'dark',
  className = '',
}: {
  /** Walks per band, keyed by HourLight['key']. */
  counts: Record<string, number>
  active?: HourLight['key'] | null
  /** Where clicking a band goes. Given the band, returns a URL. */
  hrefFor: (key: HourLight['key'] | null) => string
  ground?: 'light' | 'dark'
  className?: string
}) {
  const total = HOUR_BANDS.reduce((n, b) => n + (counts[b.key] ?? 0), 0)
  const dark = ground === 'dark'

  return (
    <div className={className}>
      <div className="flex gap-1.5">
        {HOUR_BANDS.map((b) => {
          const n = counts[b.key] ?? 0
          const on = active === b.key
          // A band with nothing in it is dimmed so the full ones stand out —
          // but when the WHOLE board is empty, dimming everything turns the
          // arc into a disabled control instead of what it is on that day: a
          // legend for a colour system that still applies.
          const empty = n === 0 && total > 0
          return (
            <Link
              key={b.key}
              href={hrefFor(on ? null : b.key)}
              aria-pressed={on}
              title={`${b.label} — ${n} walk${n === 1 ? '' : 's'}`}
              className={`group relative flex min-w-0 flex-1 flex-col gap-2 rounded-[var(--r-input)] px-2.5 py-2.5 transition-all duration-200 ${
                dark ? 'hover:bg-paper/[0.06]' : 'hover:bg-paper-warm'
              } ${on ? (dark ? 'bg-paper/[0.09]' : 'bg-paper-warm') : ''} ${
                empty ? 'opacity-45' : ''
              }`}
            >
              {/* The band itself. Full weight when it has walks in it, a
                  hairline when it does not — so an empty hour reads as a time
                  of day with nothing on, rather than as a missing control. */}
              <span
                aria-hidden="true"
                className="block w-full rounded-full transition-all duration-300"
                style={{
                  height: empty ? 3 : 6,
                  background: dotColor(b, dark ? 'dark' : 'light'),
                  boxShadow: on
                    ? `0 0 0 2px ${dark ? 'var(--ink)' : 'var(--paper)'}, 0 0 0 3px ${dotColor(b, dark ? 'dark' : 'light')}`
                    : undefined,
                }}
              />
              <span className="min-w-0">
                <span
                  className={`block font-mono text-[15px] leading-none tabular-nums ${
                    dark ? 'text-paper' : 'text-text'
                  }`}
                >
                  {n}
                </span>
                <span
                  className={`trek-label-xs mt-1.5 block truncate ${
                    dark ? 'text-paper/55' : 'text-mid'
                  }`}
                >
                  {b.label}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
      {/* This is a sentence, and it was set as though it were an instrument
          reading: 9px mono, uppercased, tracked to 0.16em. Mono is rationed to
          figures now, so the count keeps it and the prose beside it does not. */}
      <p className={`mt-2.5 font-body text-[11px] leading-relaxed ${dark ? 'text-paper/40' : 'text-light'}`}>
        <span className="font-mono tabular-nums">{total}</span> on the board · every walk carries
        the colour of the hour it leaves
      </p>
    </div>
  )
}
