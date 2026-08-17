'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTrekPlan, type TrekEffort } from '@/actions/trekBuddy'
import { ACTIVITIES, ACTIVITY_BY_KEY, type TrekActivity } from '@/lib/trek'
import SafetyNotes from '@/components/trek/SafetyNotes'

const field =
  'mt-2 w-full rounded-sm border border-rule bg-white px-3 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none'
const label = 'font-body text-xs uppercase tracking-[0.12em] text-mid'
const hint = 'mt-1.5 block font-body text-xs text-mid'

/**
 * yyyy-mm-dd from a Date's LOCAL parts.
 *
 * Not toISOString().slice(0,10), which converts to UTC first and therefore
 * returns yesterday for anyone east of Greenwich — in IST, midnight on the 20th
 * is 18:30 on the 19th in UTC. That turned "the day after" into "the same day",
 * and camping was rejected by trek_plans_hours because ends_on was not
 * starts_on + 1. A date the user typed is a wall-clock date and must never go
 * through a timezone conversion.
 */
function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Tomorrow, in IST — the earliest a walk can sensibly be posted for. */
function tomorrowIst() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  now.setDate(now.getDate() + 1)
  return ymd(now)
}

/** starts_on + 1, as a yyyy-mm-dd string. */
function nextDay(d: string) {
  const t = new Date(d + 'T00:00:00')
  t.setDate(t.getDate() + 1)
  return ymd(t)
}

export default function NewPlanForm({ initialActivity }: { initialActivity?: TrekActivity }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  // Prefilled from the quick-start button, so "I fancy stargazing" arrives here
  // already knowing it starts at 21:40 and ends after midnight.
  const initial = ACTIVITY_BY_KEY[initialActivity ?? 'trekking']
  const [f, setF] = useState({
    activity: initial.key,
    place: '',
    meetArea: '',
    startsOn: tomorrowIst(),
    startTime: initial.defaultStart,
    backBy: initial.defaultBackBy,
    capacity: Math.max(4, initial.minParty),
    effort: 'moderate' as TrekEffort,
    meetingPoint: '',
    note: '',
    logistics: '',
    nightNote: '',
  })
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const spec = ACTIVITY_BY_KEY[f.activity]

  // Changing the kind of outing re-seeds its hours. Someone who switches from
  // trekking to camping should not have to work out that 07:00 is no longer a
  // legal start — the database would refuse it and they would have to guess why.
  function pickActivity(key: TrekActivity) {
    const a = ACTIVITY_BY_KEY[key]
    setF({
      ...f,
      activity: key,
      startTime: a.defaultStart,
      backBy: a.defaultBackBy,
      capacity: Math.max(f.capacity, a.minParty),
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await createTrekPlan({
        ...f,
        endsOn: spec.endsNextDay ? nextDay(f.startsOn) : f.startsOn,
        nightNote: spec.needsNightNote ? f.nightNote : undefined,
      })
      if ('error' in r) { setError(r.error); return }
      router.push('/trek-buddy')
    })
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={label}>What</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => (
              <button
                key={a.key} type="button" onClick={() => pickActivity(a.key)}
                aria-pressed={f.activity === a.key}
                className={`rounded-full border px-3.5 py-1.5 font-body text-xs transition-colors ${
                  f.activity === a.key
                    ? 'border-forest bg-forest text-paper'
                    : 'border-rule text-mid hover:border-text hover:text-text'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <span className={hint}>
            {spec.dayPart === 'day'
              ? `Daylight outing — start between ${spec.startMin} and ${spec.startMax}, back the same day.`
              : spec.dayPart === 'evening'
                ? `After dark — start between ${spec.startMin} and ${spec.startMax}, back by 02:00. Needs ${spec.minParty} people before the meeting point is shared.`
                : `One night out — start between ${spec.startMin} and ${spec.startMax}, back by 14:00 tomorrow. Needs ${spec.minParty} people before the meeting point is shared.`}
          </span>
        </div>

        <label className="block">
          <span className={label}>How hard</span>
          <select value={f.effort} onChange={(e) => set({ effort: e.target.value as TrekEffort })} className={field}>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="hard">Hard</option>
          </select>
          <span className={hint}>Be honest — someone will believe you.</span>
        </label>

        <label className="block sm:col-span-2">
          <span className={label}>Where</span>
          <input value={f.place} onChange={(e) => set({ place: e.target.value })}
            required minLength={2} maxLength={80} placeholder="Nag Tibba" className={field} />
        </label>

        <label className="block sm:col-span-2">
          <span className={label}>Meet around</span>
          <input value={f.meetArea} onChange={(e) => set({ meetArea: e.target.value })}
            required minLength={2} maxLength={120} placeholder="Dehradun ISBT" className={field} />
          <span className={hint}>
            A town or landmark, shown to everyone. The exact spot goes below.
          </span>
        </label>

        <label className="block">
          <span className={label}>Date</span>
          <input type="date" value={f.startsOn} min={tomorrowIst()}
            onChange={(e) => set({ startsOn: e.target.value })} required className={field} />
        </label>

        <label className="block">
          <span className={label}>How many people</span>
          <input type="number" min={spec.minParty} max={8} value={f.capacity}
            onChange={(e) => set({ capacity: Number(e.target.value) })} required className={field} />
          <span className={hint}>
            Including you. Between {spec.minParty} and 8.
          </span>
        </label>

        <label className="block">
          <span className={label}>Start</span>
          <input type="time" value={f.startTime} min={spec.startMin} max={spec.startMax}
            onChange={(e) => set({ startTime: e.target.value })} required className={field} />
          <span className={hint}>Between {spec.startMin} and {spec.startMax}.</span>
        </label>

        <label className="block">
          <span className={label}>Back by</span>
          <input type="time" value={f.backBy}
            onChange={(e) => set({ backBy: e.target.value })} required className={field} />
          <span className={hint}>
            {spec.endsNextDay ? 'The next morning.' : '19:00 at the latest.'}
          </span>
        </label>
      </div>

      <div className="mt-8 rounded-sm border border-forest/30 bg-forest/[0.04] p-5">
        <label className="block">
          <span className={label}>Exact meeting point</span>
          <input value={f.meetingPoint} onChange={(e) => set({ meetingPoint: e.target.value })}
            required minLength={2} maxLength={200}
            placeholder="Gate 2, behind the tea stall" className={field} />
          <span className={hint}>
            Only shown to walkers you confirm, and only once {spec.minParty} people are going. Do
            not put anything here you would not want a stranger to have.
          </span>
        </label>

        <label className="mt-5 block">
          <span className={label}>Getting there (optional)</span>
          <input value={f.logistics} onChange={(e) => set({ logistics: e.target.value })}
            maxLength={300} placeholder="Shared cab from ISBT, roughly ₹300 each" className={field} />
        </label>
      </div>

      <label className="mt-6 block">
        <span className={label}>Anything else (optional)</span>
        <textarea value={f.note} onChange={(e) => set({ note: e.target.value })}
          rows={3} maxLength={400}
          placeholder="Bring 2L water and something warm. We'll stop for chai on the way back."
          className={field} />
      </label>

      {spec.needsNightNote && (
        <label className="mt-6 block rounded-sm border border-clay/40 bg-clay/[0.04] p-5">
          <span className={label}>How does everyone get back in the dark?</span>
          <textarea
            value={f.nightNote} onChange={(e) => set({ nightNote: e.target.value })}
            rows={2} minLength={10} maxLength={400} required
            placeholder="Two cars, headlamps required, we drive back together at 00:30."
            className={field}
          />
          <span className={hint}>
            Required for anything after dark, and it is not a checkbox on purpose — writing the
            sentence is what makes you check the descent actually works.
          </span>
        </label>
      )}

      <SafetyNotes variant="compact" className="mt-6" />

      {error && <p className="mt-5 font-body text-xs text-clay">{error}</p>}

      <button type="submit" disabled={pending}
        className="mt-8 w-full rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-50">
        {pending ? 'Posting…' : 'Post this walk'}
      </button>
      <p className="mt-3 text-center font-body text-xs text-mid">
        You are the host. You decide who comes.
      </p>
    </form>
  )
}
