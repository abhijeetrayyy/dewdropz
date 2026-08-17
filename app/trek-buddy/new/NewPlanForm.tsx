'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTrekPlan, type TrekActivity, type TrekEffort } from '@/actions/trekBuddy'

const field =
  'mt-2 w-full rounded-sm border border-rule bg-white px-3 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none'
const label = 'font-body text-xs uppercase tracking-[0.12em] text-mid'
const hint = 'mt-1.5 block font-body text-xs text-mid'

/** Tomorrow, in IST — the earliest a walk can sensibly be posted for. */
function tomorrowIst() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  now.setDate(now.getDate() + 1)
  return now.toISOString().slice(0, 10)
}

export default function NewPlanForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [f, setF] = useState({
    activity: 'trekking' as TrekActivity,
    place: '',
    meetArea: '',
    startsOn: tomorrowIst(),
    startTime: '07:00',
    backBy: '16:00',
    capacity: 4,
    effort: 'moderate' as TrekEffort,
    meetingPoint: '',
    note: '',
    logistics: '',
  })
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await createTrekPlan(f)
      if ('error' in r) { setError(r.error); return }
      router.push('/trek-buddy')
    })
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={label}>What</span>
          <select value={f.activity} onChange={(e) => set({ activity: e.target.value as TrekActivity })} className={field}>
            <option value="trekking">Trekking</option>
            <option value="bird_watching">Bird watching</option>
          </select>
          {/* Camping and stargazing are on the homepage but not here: both are
              after dark, and the database will not store a walk that starts
              outside daylight. */}
          <span className={hint}>Daylight walks only for now.</span>
        </label>

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
          <input type="number" min={3} max={8} value={f.capacity}
            onChange={(e) => set({ capacity: Number(e.target.value) })} required className={field} />
          <span className={hint}>Including you. Between 3 and 8.</span>
        </label>

        <label className="block">
          <span className={label}>Start</span>
          <input type="time" value={f.startTime} min="06:00" max="16:00"
            onChange={(e) => set({ startTime: e.target.value })} required className={field} />
          <span className={hint}>Between 06:00 and 16:00.</span>
        </label>

        <label className="block">
          <span className={label}>Back by</span>
          <input type="time" value={f.backBy} max="19:00"
            onChange={(e) => set({ backBy: e.target.value })} required className={field} />
          <span className={hint}>19:00 at the latest.</span>
        </label>
      </div>

      <div className="mt-8 rounded-sm border border-forest/30 bg-forest/[0.04] p-5">
        <label className="block">
          <span className={label}>Exact meeting point</span>
          <input value={f.meetingPoint} onChange={(e) => set({ meetingPoint: e.target.value })}
            required minLength={2} maxLength={200}
            placeholder="Gate 2, behind the tea stall" className={field} />
          <span className={hint}>
            Only shown to walkers you confirm, and only once three people are going. Do not put
            anything here you would not want a stranger to have.
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
