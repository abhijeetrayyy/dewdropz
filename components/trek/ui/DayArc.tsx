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
  // The busiest hour sets the scale, so the bars compare hours to each other
  // rather than to a capacity the board does not have.
  const busiest = HOUR_BANDS.reduce((m, b) => Math.max(m, counts[b.key] ?? 0), 0)

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
              className={`group relative flex min-w-0 flex-1 flex-col gap-2 rounded-[var(--r-input)] px-1.5 py-2.5 transition-all duration-200 sm:px-2.5 ${
                dark ? 'hover:bg-paper/[0.06]' : 'hover:bg-paper-warm'
              } ${on ? (dark ? 'bg-paper/[0.09]' : 'bg-paper-warm') : ''} ${
                empty ? 'opacity-45' : ''
              }`}
            >
              {/* The band itself, and IT NOW MEASURES SOMETHING.
                  Every band drew a full-width bar, so a band holding six walks
                  and a band holding one were graphically identical and the only
                  thing carrying the magnitude was the figure underneath. That
                  is a chart with the chart removed. The slot stays a fixed
                  fifth — these are tap targets and a legend, and they should
                  not jump about as the board changes — and the FILL inside it
                  runs to the band's share of the busiest hour. A band with one
                  walk keeps a visible stub so it never reads as empty. */}
              <span
                aria-hidden="true"
                className={`block w-full overflow-hidden rounded-full transition-all duration-300 ${
                  dark ? 'bg-paper/[0.10]' : 'bg-rule'
                }`}
                style={{ height: empty ? 3 : 6 }}
              >
                <span
                  className="block h-full rounded-full transition-all duration-500"
                  style={{
                    width: busiest === 0 ? '100%' : `${Math.max(14, (n / busiest) * 100)}%`,
                    background: dotColor(b, dark ? 'dark' : 'light'),
                    opacity: empty ? 0 : 1,
                  }}
                />
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-mono text-[15px] leading-none tabular-nums ${
                    dark ? 'text-paper' : 'text-text'
                  }`}
                >
                  {n}
                </span>
                {/* WRAPS, does not truncate. At 375px a fifth of the row is
                    75px and every one of these labels is wider than that, so
                    the whole index read "BEFO… FIRS… FULL … LAST… AFTE…" — five
                    controls, none of them nameable, on the one element that
                    explains the board's colour system. The bands are flex items
                    in a stretch row, so a label taking two lines lifts all five
                    together and the row stays even. */}
                <span
                  className={`trek-label-xs mt-1.5 block ${
                    dark ? 'text-paper/60' : 'text-mid'
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
      {/* paper/40 measured 3.71:1 on ink and --light 4.4:1 on paper, both
          under AA for 11px. This line explains the whole colour system; it is
          the last caption that should be hard to read. */}
      <p className={`mt-2.5 font-body text-[11px] leading-relaxed ${dark ? 'text-paper/60' : 'text-mid'}`}>
        <span className="font-mono tabular-nums">{total}</span> on the board · every walk carries
        the colour of the hour it leaves
      </p>
    </div>
  )
}
