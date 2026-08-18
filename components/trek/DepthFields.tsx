'use client'

import type { TrekMoment } from '@/actions/trekBuddy'

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
  const setMoment = (i: number, patch: Partial<TrekMoment>) =>
    set({ itinerary: itinerary.map((m, n) => (n === i ? { ...m, ...patch } : m)) })

  return (
    <div className="space-y-6">
      <div>
        <span className={label}>The numbers</span>
        <p className="mt-1 font-body text-xs leading-relaxed text-mid">
          Only if you know them. A blank says &ldquo;ask me&rdquo;; a guess says something
          somebody will pack for.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="font-body text-xs text-mid">Distance (km)</span>
            <input
              type="number" inputMode="decimal" min="0" max="500" step="0.5"
              value={distanceKm}
              onChange={(e) => set({ distanceKm: e.target.value })}
              placeholder="21"
              className={field}
            />
          </label>
          <label className="block">
            <span className="font-body text-xs text-mid">Climb (m)</span>
            <input
              type="number" inputMode="numeric" min="0" max="9000" step="10"
              value={gainM}
              onChange={(e) => set({ gainM: e.target.value })}
              placeholder="1150"
              className={field}
            />
          </label>
          <label className="block">
            <span className="font-body text-xs text-mid">Cost share (₹ each)</span>
            <input
              type="number" inputMode="numeric" min="0" max="100000" step="10"
              value={costRupees}
              onChange={(e) => set({ costRupees: e.target.value })}
              placeholder="350"
              className={field}
            />
          </label>
        </div>
        <p className="mt-2 font-body text-xs leading-relaxed text-mid">
          Cost share is fuel, permits, a shared cab — split at face value on the day. Nothing is
          paid through this site, and nobody pays you for a place.
        </p>
      </div>

      <div>
        <span className={label}>The day, hour by hour</span>
        <p className="mt-1 font-body text-xs leading-relaxed text-mid">
          Optional, and the single thing that most helps somebody picture themselves on it.
        </p>

        <div className="mt-3 space-y-2">
          {itinerary.map((m, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2">
              <input
                type="time"
                value={m.at}
                onChange={(e) => setMoment(i, { at: e.target.value })}
                className={`${field} w-28 shrink-0`}
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
                className="mt-2 trek-label font-mono text-mid hover:text-clay"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {itinerary.length < 12 && (
          <button
            type="button"
            onClick={() =>
              set({ itinerary: [...itinerary, { at: '06:00', label: '' }] })
            }
            className="mt-2 trek-label font-mono text-forest underline-offset-4 hover:underline"
          >
            + Add a moment
          </button>
        )}
      </div>

      <div>
        <span className={label}>Bring</span>
        <p className="mt-1 font-body text-xs leading-relaxed text-mid">
          One thing per line. This gets read the night before, over a rucksack.
        </p>
        <div className="mt-3 space-y-2">
          {bring.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={b}
                maxLength={40}
                onChange={(e) => set({ bring: bring.map((v, n) => (n === i ? e.target.value : v)) })}
                placeholder="2L water"
                className={`${field} min-w-0 flex-1`}
                aria-label={`Thing to bring ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => set({ bring: bring.filter((_, n) => n !== i) })}
                className="trek-label font-mono text-mid hover:text-clay"
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
            className="mt-2 trek-label font-mono text-forest underline-offset-4 hover:underline"
          >
            + Add something
          </button>
        )}
      </div>
    </div>
  )
}
