'use client'

import { useState } from 'react'
import type { TrekMoment } from '@/actions/trekBuddy'
import { lightForTime, dotColor } from '@/lib/trek'

// How far, how much climbing, what it costs, what happens, what to carry.
//
// All optional, and the copy says so at every field. A host who does not know
// the elevation gain must not be nudged into inventing one — a stranger will
// plan their day around whatever number is here, and a confident wrong figure
// is worse than an honest blank.
//
// Money is entered in rupees and stored in paise, like everything else in this
// database. The label is "cost share" and never "price": the board takes no
// money and this is a split of fuel and permits. Calling it a price would make
// the walk a ticket and the host a tour operator.
//
// WHAT CHANGED. Three of these four were a column of identical bordered inputs
// with a grey sentence under each, which is how a form says "all of this is the
// same kind of decision" — and they are not. The cost share is a yes/no with a
// number hanging off it, so it is a switch. The bring list is a set of things
// almost everybody picks from the same eight, so those eight are chips and the
// free-text row is kept underneath for the ninth. The day is a sequence of
// moments, so each row now carries its hour in the hour's own colour, which is
// the same idea the departure field teaches one step earlier.
//
// AND WHAT CHANGED AGAIN, IN THE RESET. Distance and climb were the smallest
// thing on this component — two 12px grey words over two inputs, sitting below
// a cost switch that had been given a whole bordered panel. That is backwards.
// The cost share is a convenience; the distance and the climb are the two
// figures a cautious stranger uses to decide whether they can physically do
// the day, and on the card they sit beside the difficulty. So they are lifted
// into their own panel at the top with the keys set as keys, the units stated,
// and the reason for answering honestly said out loud.
//
// Every act in here — remove a row, add a moment, add something else — was a
// tracked-out uppercase mono micro-label, which is a caption pretending to be a
// button. They are sentence case now, and the one saturated colour left in the
// component is forest.

/**
 * The eight things that end up on nearly every bring list.
 *
 * Chips, not a dropdown, and not the only way in: the free-text rows below take
 * anything at all, because the ninth thing is the one that matters on a
 * particular hill and a fixed vocabulary would quietly forbid it.
 */
const COMMON_BRING = [
  '2L water', 'Head torch', 'Extra layer', 'Sun cream',
  'Snacks', 'First aid kit', 'Trekking poles', 'Power bank',
]

export default function DepthFields({
  distanceKm, gainM, costRupees, bring, itinerary,
  set, label, field,
}: {
  distanceKm: string
  gainM: string
  costRupees: string
  bring: string[]
  itinerary: TrekMoment[]
  set: (p: Record<string, unknown>) => void
  /** The form's own label and input classes, so this matches its neighbours. */
  label: string
  field: string
}) {
  // "Is there a cost at all" is a different question from "how much", and the
  // parent's state only holds the second one. Kept local so the payload sent to
  // createTrekPlan is byte-identical to what it was: an empty string still
  // means "not stated", and turning the switch off clears the amount.
  const [costOn, setCostOn] = useState(costRupees.trim() !== '')

  const setMoment = (i: number, patch: Partial<TrekMoment>) =>
    set({ itinerary: itinerary.map((m, n) => (n === i ? { ...m, ...patch } : m)) })

  const toggleBring = (v: string) =>
    set({ bring: bring.includes(v) ? bring.filter((b) => b !== v) : [...bring, v] })

  const chip = (on: boolean) =>
    `rounded-full border px-4 py-2 font-body text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
      on ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text hover:text-text'
    }`

  /** A quiet act inside a list: remove a row, add a row. Never a micro-label. */
  const rowAct =
    'font-body text-[13px] font-medium text-mid transition-colors hover:text-clay-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage'

  return (
    <div className="space-y-7">
      {/* How far and how much climb, given the room they are worth.
          These two decide whether somebody can do the day at all, so they sit
          in a panel of their own above the cost switch rather than under it. */}
      <div className="rounded-[var(--r-card)] border border-rule bg-surface p-5">
        <h3 className="trek-h3 text-text">How far, and how much climb</h3>
        <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
          Both show on the card, next to the difficulty, and somebody who has never walked a hill
          will use them to work out whether they can keep up. Only fill them in if you know them —
          a blank says &ldquo;ask me&rdquo;, and a guess says something a stranger will pack for.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Distance (km)</span>
            <input
              type="number" inputMode="decimal" min="0" max="500" step="0.5"
              value={distanceKm}
              onChange={(e) => set({ distanceKm: e.target.value })}
              placeholder="21"
              className={`${field} font-mono tabular-nums`}
            />
            <span className="mt-1.5 block font-body text-xs leading-relaxed text-mid">
              Return, on the ground — not the drive up.
            </span>
          </label>
          <label className="block">
            <span className={label}>Total climb (m)</span>
            <input
              type="number" inputMode="numeric" min="0" max="9000" step="10"
              value={gainM}
              onChange={(e) => set({ gainM: e.target.value })}
              placeholder="1150"
              className={`${field} font-mono tabular-nums`}
            />
            <span className="mt-1.5 block font-body text-xs leading-relaxed text-mid">
              Everything you go up, added together.
            </span>
          </label>
        </div>
      </div>

      {/* The cost share, as the yes/no it actually is. The track takes forest
          when it is on: a switch someone has thrown is a settled state, and
          amber on this board is reserved for a clock running down. */}
      <div className="rounded-[var(--r-card)] border border-rule bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="font-body text-[15px] text-text">Split the costs</span>
            <p className="mt-1 font-body text-xs leading-relaxed text-mid">
              Cost share is fuel, permits, a shared cab — split at face value on the day. Nothing
              is paid through this site, and nobody pays you for a place.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={costOn}
            aria-label="Split the costs"
            onClick={() => {
              const next = !costOn
              setCostOn(next)
              // Off means "not stated", which has to travel to the column as an
              // empty string rather than as a zero — zero is a real answer and
              // means the walk costs nothing.
              if (!next) set({ costRupees: '' })
            }}
            className="relative h-7 w-[52px] shrink-0 rounded-full transition-colors duration-[250ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            style={{ background: costOn ? 'var(--forest)' : 'var(--rule)' }}
          >
            <span
              aria-hidden="true"
              className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-[left] duration-[250ms]"
              style={{ left: costOn ? 27 : 3 }}
            />
          </button>
        </div>

        {costOn && (
          <label className="mt-4 block border-t border-rule-soft pt-4">
            <span className={label}>Per person, roughly (₹)</span>
            <input
              type="number" inputMode="numeric" min="0" max="100000" step="10"
              value={costRupees}
              onChange={(e) => set({ costRupees: e.target.value })}
              placeholder="350"
              className={`${field} w-52 font-mono tabular-nums`}
            />
          </label>
        )}
      </div>

      <div>
        <h3 className="trek-h3 text-text">The day, hour by hour</h3>
        <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
          Optional, and the single thing that most helps somebody picture themselves on it.
        </p>

        <div className="mt-3 space-y-2">
          {itinerary.map((m, i) => {
            const l = lightForTime(m.at)
            return (
              <div key={i} className="flex flex-wrap items-start gap-2">
                {/* The moment's own hour, so a day laid out here reads as the
                    same passage of light the board sorts walks by. */}
                <span
                  aria-hidden="true"
                  className="mt-2 h-[46px] w-1 shrink-0 rounded-[var(--r-bar)]"
                  style={{ background: dotColor(l, 'light') }}
                />
                <input
                  type="time"
                  value={m.at}
                  onChange={(e) => setMoment(i, { at: e.target.value })}
                  className={`${field} w-28 shrink-0 font-mono tabular-nums`}
                  aria-label={`Time for moment ${i + 1}`}
                />
                <input
                  value={m.label}
                  maxLength={60}
                  onChange={(e) => setMoment(i, { label: e.target.value })}
                  placeholder="Meet & headcount"
                  className={`${field} min-w-0 flex-1`}
                  aria-label={`What happens at moment ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => set({ itinerary: itinerary.filter((_, n) => n !== i) })}
                  className={`mt-4 ${rowAct}`}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>

        {itinerary.length < 12 && (
          <button
            type="button"
            onClick={() =>
              set({ itinerary: [...itinerary, { at: '06:00', label: '' }] })
            }
            className="mt-2.5 font-body text-[13px] font-medium text-forest underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Add a moment
          </button>
        )}
      </div>

      {/* What to carry. Read the night before, over an open rucksack, by
          somebody who may never have packed for a hill — so it is a heading and
          a sentence rather than a 10px key, and the eight chips are the ones
          that actually keep a person warm, lit and watered. */}
      <div>
        <h3 className="trek-h3 text-text">What to bring</h3>
        <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
          This gets read the night before, over a rucksack. Somebody on their first walk owns none
          of it yet, so say the whole list even when it feels obvious.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {COMMON_BRING.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => toggleBring(v)}
              aria-pressed={bring.includes(v)}
              className={chip(bring.includes(v))}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Anything the eight do not cover. One per row, as before — a host who
            needs "crampons" or "a passport photo for the permit" must not be
            forced to choose the nearest chip instead. */}
        <div className="mt-3 space-y-2">
          {bring
            .map((b, i) => [b, i] as const)
            .filter(([b]) => !COMMON_BRING.includes(b))
            .map(([b, i]) => (
              <div key={i} className="flex items-start gap-2">
                <input
                  value={b}
                  maxLength={40}
                  onChange={(e) => set({ bring: bring.map((v, n) => (n === i ? e.target.value : v)) })}
                  placeholder="Crampons"
                  className={`${field} min-w-0 flex-1`}
                  aria-label={`Thing to bring ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => set({ bring: bring.filter((_, n) => n !== i) })}
                  className={`mt-4 ${rowAct}`}
                >
                  Remove
                </button>
              </div>
            ))}
        </div>

        {bring.length < 12 && (
          <button
            type="button"
            onClick={() => set({ bring: [...bring, ''] })}
            className="mt-2.5 font-body text-[13px] font-medium text-forest underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            Add something else
          </button>
        )}
      </div>
    </div>
  )
}
