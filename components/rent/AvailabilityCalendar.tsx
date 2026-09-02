'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getRentalItemDays } from '@/actions/rentals'
import {
  MONTHS, monthCells, monthOf, stepMonth, firstDayOf, lastDayOf, daysBetween,
} from '@/lib/calendarGrid'
import { shopToday } from '@/lib/shopTime'

/**
 * The month, with the shelf on it.
 *
 * WHAT THIS REPLACES. Two bare `<input type="date">` fields. A person filled
 * both in, waited, and was told "None free for those dates" — with no way to
 * find out which dates WOULD work except by guessing again. `/rent/terms` used
 * to promise a calendar that accounted for the cleaning buffer. There was none.
 *
 * WHAT THE NUMBERS MEAN, EXACTLY — AND WHAT THEY DO NOT
 *
 * Each day shows how many units are on the shelf THAT DAY, from
 * `rental_item_day_availability` (migration 110). The cleaning buffer is
 * already inside it: a tent due back on the 10th with a day's drying shows held
 * through the 11th and free on the 12th.
 *
 * It is a guide to picking, NOT the authority on booking, and the difference is
 * real rather than pedantic. Two units can make a range look free day by day
 * without any ONE unit being free across the whole of it — unit A free Monday,
 * unit B free Tuesday, and a two-day hire needs one unit for both. So the
 * sentence a person acts on still comes from `rental_available_units` over the
 * whole range, in `RentBooking`, which is the same function the booking write
 * uses. This grid narrows the guessing from a month to a day; it does not
 * replace the check.
 *
 * That is why an unavailable day is disabled and a *range* is not: refusing a
 * selection this component cannot be certain about would block bookings that
 * are genuinely possible.
 */
export default function AvailabilityCalendar({
  itemId,
  from,
  to,
  onChange,
  maxDays,
  minDays,
}: {
  itemId: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
  maxDays: number
  minDays: number
}) {
  const today = shopToday()
  const [cursor, setCursor] = useState(() => monthOf(from || today))
  const [days, setDays] = useState<Record<string, { free: number; total: number }>>({})
  const [loading, setLoading] = useState(true)

  // TWO MONTHS, NOT ONE. A hire that starts on the 31st and ends on the 4th is
  // the most ordinary thing this shop sells, and on a single-month grid it
  // showed one highlighted cell under a line reading "5 days selected" — the
  // range was real and invisible. The second month is hidden below `sm`, where
  // there is no room for it, and both are fetched either way: it is one call
  // for the pair, so the phone pays nothing for a grid it does not draw and
  // stepping forward is instant when it does.
  const next = useMemo(() => stepMonth(cursor, 1), [cursor])
  const grids = useMemo(
    () => [cursor, next].map((c) => ({ ...c, cells: monthCells(c.year, c.month) })),
    [cursor, next],
  )

  useEffect(() => {
    let cancelled = false
    // Syncing with an external system — the server's view of the shelf — when
    // the month changes. That is what an effect is for, and the count may not
    // be computed here; see this component's header.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    ;(async () => {
      const rows = await getRentalItemDays(
        itemId, firstDayOf(cursor.year, cursor.month), lastDayOf(next.year, next.month),
      )
      if (cancelled) return
      const map: Record<string, { free: number; total: number }> = {}
      for (const r of rows) map[r.day] = { free: r.free, total: r.total }
      setDays(map)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [itemId, cursor, next])

  // Going back past the month containing today is pointless — every day in it
  // is already dead.
  const atFloor = cursor.year === Number(today.slice(0, 4)) && cursor.month === Number(today.slice(5, 7)) - 1

  function pick(iso: string) {
    // First tap sets the start. Second tap closes the range — unless it lands
    // before the start, or would exceed the item's longest hire, in which case
    // it becomes a new start rather than an error nobody asked for.
    if (!from || (from && to)) { onChange(iso, ''); return }
    if (iso < from) { onChange(iso, ''); return }
    if (daysBetween(from, iso) > maxDays) { onChange(iso, ''); return }
    onChange(from, iso)
  }

  const chosen = (iso: string) => Boolean(from && to && iso >= from && iso <= to)
  const selectedDays = from && to ? daysBetween(from, to) : 0

  return (
    <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button" onClick={() => setCursor((c) => stepMonth(c, -1))} disabled={atFloor}
          aria-label="The month before"
          className="rounded-full p-1.5 text-mid transition-colors hover:bg-paper-deep hover:text-forest disabled:cursor-not-allowed disabled:text-light"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-base text-ink" aria-live="polite">
          {MONTHS[cursor.month]} {cursor.year}
          <span className="hidden sm:inline"> – {MONTHS[next.month]} {next.year}</span>
          {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-mid" aria-label="Checking the locker" />}
        </p>
        <button
          type="button" onClick={() => setCursor((c) => stepMonth(c, 1))}
          aria-label="The month after"
          className="rounded-full p-1.5 text-mid transition-colors hover:bg-paper-deep hover:text-forest"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-5 sm:grid-cols-2">
      {grids.map((g, gi) => (
      <div key={`${g.year}-${g.month}`} className={gi === 1 ? 'hidden sm:block' : undefined}>
        <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-mid sm:mb-2">
          {MONTHS[g.month]} {g.year}
        </p>
        {/* Monday-first, matching the phone app's picker — the same customer may
            well use both. `aria-hidden` because the letters repeat (T, T and
            S, S) and read as noise; each day button carries its own full
            label. */}
        <div className="grid grid-cols-7 gap-1" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="py-1 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-mid">{d}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
        {g.cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} />
          const past = iso < today
          const info = days[iso]
          // An unknown day — the month is still loading — is offered rather
          // than disabled. Greying the whole grid on every month step makes the
          // control feel broken; a day that turns out to be full is caught by
          // the availability check before anything is booked.
          const full = info !== undefined && info.free === 0
          const disabled = past || full
          const on = chosen(iso)
          const isEdge = iso === from || iso === to

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => pick(iso)}
              aria-pressed={on}
              aria-label={`${Number(iso.slice(8, 10))} ${MONTHS[g.month]}${
                past ? ', in the past' : full ? ', none free' : info ? `, ${info.free} free` : ''
              }`}
              className={[
                'relative flex aspect-square flex-col items-center justify-center rounded-[var(--r-input)] font-body text-[13px] transition-colors',
                disabled
                  // Not `opacity-40`: the label has to stay readable, because
                  // "the 14th is full" is information a person is using to pick
                  // a different weekend. The meaning lives in the strike and
                  // the flat ground instead.
                  ? 'cursor-not-allowed bg-paper-deep/60 text-light line-through'
                  : isEdge
                    ? 'bg-forest font-medium text-paper'
                    : on
                      ? 'bg-forest/15 text-forest'
                      : 'text-ink hover:bg-paper-deep',
              ].join(' ')}
            >
              {Number(iso.slice(8, 10))}
              {/* The count, small, under the number — only where it is scarce.
                  Printing "6" under every day of an empty month is noise that
                  hides the one day that says "1". */}
              {!disabled && info && info.free <= 2 && (
                <span className={`font-mono text-[9px] leading-none ${isEdge ? 'text-paper/80' : 'text-clay-deep'}`}>
                  {info.free}
                </span>
              )}
            </button>
          )
        })}
        </div>
      </div>
      ))}
      </div>

      <p className="mt-3 border-t border-rule pt-3 font-body text-[12px] leading-relaxed text-mid" aria-live="polite">
        {!from
          ? `Tap a day to start. Minimum ${minDays} day${minDays === 1 ? '' : 's'}, maximum ${maxDays}.`
          : !to
            ? 'Now tap the day you bring it back. Both days count.'
            : `${selectedDays} day${selectedDays === 1 ? '' : 's'} selected.${
                selectedDays < minDays ? ` This item is a minimum of ${minDays}.` : ''
              }`}
      </p>
      <p className="mt-1 font-body text-[12px] text-mid">
        Struck-through days are already out. A day is free again once it has been checked and dried.
      </p>
    </div>
  )
}
