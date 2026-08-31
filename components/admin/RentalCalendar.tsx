'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { getRentalCalendar, type CalendarUnit } from '@/actions/rentalReports'
import { cn } from '@/lib/utils'

/**
 * A month of the gear locker, one row per physical unit.
 *
 * WHY A ROW PER UNIT AND NOT PER ITEM. Availability is decided per unit — the
 * exclusion constraint is on `unit_id` — so an item-level calendar would have
 * to invent a summary ("2 of 4 free") that nobody can act on. The question an
 * operator actually asks is "can I extend tent 3", and that question has a row.
 *
 * WHY THE CLEANING BUFFER IS DRAWN DIFFERENTLY. Both the rented days and the
 * drying days make a unit unavailable, and only one of them is something
 * somebody paid for. Drawing them the same way would make a two-day buffer look
 * like a booking that does not exist, and an operator would go looking for the
 * customer.
 *
 * The bars come from `rental_calendar`, which reads the same `period` column
 * the exclusion constraint tests. This screen therefore cannot disagree with
 * what the shelf will actually allow — which is the whole reason it is not
 * computed in the browser from a list of reservations.
 */

type Props = {
  initial: { from: string; to: string; units: CalendarUnit[] }
  items: { id: string; name: string }[]
}

const DAY_MS = 86_400_000

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monthBounds(anchor: Date) {
  const from = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
  const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))
  return { from: iso(from), to: iso(to) }
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

const STATUS_TONE: Record<string, string> = {
  reserved: 'bg-dawn/70 border-dawn text-ink',
  out: 'bg-forest text-paper border-forest-deep',
  returned: 'bg-sage/50 border-sage text-ink',
}

export default function RentalCalendar({ initial, items }: Props) {
  const [anchor, setAnchor] = useState(() => new Date(`${initial.from}T00:00:00Z`))
  const [itemId, setItemId] = useState<string | null>(null)
  const [data, setData] = useState(initial)
  const [pending, start] = useTransition()

  const { from, to } = useMemo(() => monthBounds(anchor), [anchor])
  const span = daysBetween(from, to)
  const today = iso(new Date())

  function load(nextAnchor: Date, nextItem: string | null) {
    const b = monthBounds(nextAnchor)
    start(async () => {
      const next = await getRentalCalendar({ from: b.from, to: b.to, itemId: nextItem })
      setData(next)
    })
  }

  function step(months: number) {
    const next = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1))
    setAnchor(next)
    load(next, itemId)
  }

  const monthLabel = new Date(`${from}T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })

  return (
    <div className="flex flex-col gap-4">
      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-[var(--r-input)] border border-rule bg-surface p-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="grid h-8 w-8 place-items-center rounded-[var(--r-tag)] text-mid hover:bg-paper-warm hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[9rem] text-center font-body text-sm text-ink">{monthLabel}</span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next month"
            className="grid h-8 w-8 place-items-center rounded-[var(--r-tag)] text-mid hover:bg-paper-warm hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <select
          value={itemId ?? ''}
          onChange={(e) => {
            const next = e.target.value || null
            setItemId(next)
            load(anchor, next)
          }}
          className="h-10 rounded-[var(--r-input)] border border-rule bg-surface px-3 font-body text-sm text-ink"
          aria-label="Filter by item"
        >
          <option value="">All gear</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>

        {pending && <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-mid">Loading…</span>}

        <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-mid">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] bg-dawn/70" aria-hidden="true" />Reserved</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] bg-forest" aria-hidden="true" />Out</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] bg-rule-warm" aria-hidden="true" />Cleaning</span>
        </div>
      </div>

      {/* ── The grid ──────────────────────────────────────────────────────── */}
      {data.units.length === 0 ? (
        <div className="rounded-[var(--r-panel)] border border-rule bg-surface p-10 text-center shadow-[var(--shadow-card)]">
          <CalendarDays className="mx-auto h-6 w-6 text-light" aria-hidden="true" />
          <p className="mt-3 font-body text-sm text-mid">
            No units registered yet. Add physical copies to an item and they will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-panel)] border border-rule bg-surface shadow-[var(--shadow-card)]">
          <div className="min-w-[52rem]">
            {/* Day ruler */}
            <div className="flex border-b border-rule bg-paper-warm">
              <div className="w-44 shrink-0 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-mid">
                Unit
              </div>
              <div className="flex flex-1">
                {Array.from({ length: span }, (_, i) => {
                  const d = iso(new Date(Date.parse(`${from}T00:00:00Z`) + i * DAY_MS))
                  const weekend = [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())
                  return (
                    <div
                      key={d}
                      className={cn(
                        'flex-1 border-l border-rule/60 py-2 text-center font-mono text-[9px] tabular-nums',
                        weekend ? 'text-ink' : 'text-light',
                        d === today && 'bg-dawn-soft font-semibold text-ember',
                      )}
                    >
                      {d.slice(8)}
                    </div>
                  )
                })}
              </div>
            </div>

            {data.units.map((u) => (
              <div key={u.unitId} className="flex border-b border-rule-warm last:border-b-0">
                <div className="w-44 shrink-0 px-4 py-3">
                  <p className="font-body text-sm text-ink">{u.itemName}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-mid">
                    {u.unitCode}
                    {u.condition !== 'good' && (
                      <span className="ml-1.5 text-clay-deep">· {u.condition}</span>
                    )}
                  </p>
                </div>

                <div className="relative flex flex-1">
                  {/* Day cells, so the row has a grid even when nothing is booked. */}
                  {Array.from({ length: span }, (_, i) => (
                    <div key={i} className="flex-1 border-l border-rule/40" />
                  ))}

                  {u.bars.map((bar) => {
                    // Clipped to the month, so a rental that starts in the
                    // previous one still draws its tail here rather than
                    // vanishing or overflowing the row.
                    const startIdx = Math.max(0, daysBetween(from, bar.startsOn) - 1)
                    const endIdx = Math.min(span - 1, daysBetween(from, bar.endsOn) - 1)
                    const bufferIdx = Math.min(span - 1, daysBetween(from, bar.bufferUntil) - 1)
                    if (endIdx < 0 || startIdx > span - 1) return null

                    const pct = (n: number) => `${(n / span) * 100}%`

                    return (
                      <div key={bar.reservationId} className="pointer-events-none absolute inset-y-0 left-0 w-full">
                        {/* Cleaning tail first, so the booking bar sits over it. */}
                        {bufferIdx > endIdx && (
                          <div
                            className="absolute top-1/2 h-4 -translate-y-1/2 rounded-r-[3px] border border-rule-warm bg-rule-warm/70"
                            style={{ left: pct(endIdx + 1), width: pct(bufferIdx - endIdx) }}
                            title={`Cleaning until ${bar.bufferUntil}`}
                          />
                        )}
                        <div
                          className={cn(
                            'pointer-events-auto absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-[var(--r-tag)] border px-2',
                            STATUS_TONE[bar.status] ?? 'bg-paper-deep border-rule text-ink',
                          )}
                          style={{ left: pct(startIdx), width: pct(endIdx - startIdx + 1) }}
                          title={`${bar.bookingNumber} · ${bar.email} · ${bar.startsOn} to ${bar.endsOn}`}
                        >
                          <span className="truncate font-mono text-[9px] uppercase tracking-[0.08em]">
                            {bar.bookingNumber.replace('DDZ-R-', '')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
