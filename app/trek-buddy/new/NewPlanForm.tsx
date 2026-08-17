'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTrekPlan, type TrekEffort } from '@/actions/trekBuddy'
import { ACTIVITIES, ACTIVITY_BY_KEY, lightForTime, type TrekActivity } from '@/lib/trek'
import SafetyNotes from '@/components/trek/SafetyNotes'

/**
 * yyyy-mm-dd from a Date's LOCAL parts.
 *
 * Not toISOString().slice(0,10), which converts to UTC first and returns
 * yesterday anywhere east of Greenwich — in IST, midnight on the 20th is 18:30
 * on the 19th. That turned "the day after" into "the same day" and every
 * camping plan was refused by the hours constraint.
 */
function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function tomorrowIst() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  now.setDate(now.getDate() + 1)
  return ymd(now)
}

function nextDay(d: string) {
  const t = new Date(d + 'T00:00:00')
  t.setDate(t.getDate() + 1)
  return ymd(t)
}

const label = 'font-mono text-[10px] uppercase tracking-[0.2em] text-mid'
const field =
  'mt-2 w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-base text-text placeholder:text-mid/60 focus:border-forest focus:outline-none'
const hint = 'mt-1.5 block font-body text-xs leading-relaxed text-mid'

/** The four steps, named. Posting a walk is a sequence, so it is numbered. */
const STEPS = ['What', 'Where', 'When', 'The details'] as const

// Posting a walk, as a composer rather than a form.
//
// The old version was fourteen labelled inputs in a column — every field the
// database wanted, in schema order, all at the same visual weight. That is a
// data-entry screen, and it asks somebody who had a nice idea about Sunday to
// fill in a record.
//
// This asks four questions in the order a person actually thinks about them —
// what, where, when, and the rest — and shows the card they are building, live,
// beside it. The preview is the point: you are not filling in a form, you are
// writing the thing other people will read, and you can see it the whole time.
export default function NewPlanForm({ initialActivity }: { initialActivity?: TrekActivity }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  // Arriving from a quick-start button means question one is already answered.
  const [step, setStep] = useState(initialActivity ? 1 : 0)

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
  // Functional, so two changes in one tick cannot clobber each other.
  const set = (p: Partial<typeof f>) => setF((prev) => ({ ...prev, ...p }))
  const spec = ACTIVITY_BY_KEY[f.activity]
  const light = useMemo(() => lightForTime(f.startTime), [f.startTime])

  // Changing the kind of outing re-seeds its hours. Somebody switching from
  // trekking to camping should not have to work out that 07:00 is no longer a
  // legal start — the database would refuse it and they would have to guess why.
  function pickActivity(key: TrekActivity) {
    const a = ACTIVITY_BY_KEY[key]
    setF((prev) => ({ ...prev, activity: key, startTime: a.defaultStart, backBy: a.defaultBackBy, capacity: Math.max(prev.capacity, a.minParty) }))
    setStep(1)
  }

  const canPost = Boolean(
    f.place.trim() && f.meetArea.trim() && f.meetingPoint.trim() &&
    (!spec.needsNightNote || f.nightNote.trim().length >= 10)
  )

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

  const dayLabel = new Date(f.startsOn + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        {/* Where you are in the sequence. Numbered because posting a walk IS an
            order — you cannot say where you are meeting before you know what
            you are doing. */}
        <ol className="flex flex-wrap gap-x-6 gap-y-2 border-b border-rule pb-4">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setStep(i)}
                className={`font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  i === step ? 'text-forest' : i < step ? 'text-text' : 'text-mid/50'
                }`}>
                <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span> {s}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-8 space-y-8">
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl text-text">What are you doing?</h2>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {ACTIVITIES.map((a) => (
                  <button key={a.key} type="button" onClick={() => pickActivity(a.key)}
                    className="flex items-baseline justify-between gap-3 rounded-sm border border-rule px-4 py-3.5 text-left transition-colors hover:border-forest">
                    <span>
                      <span className="block font-body text-sm text-text">{a.label}</span>
                      <span className="block font-body text-xs text-mid">{a.blurb}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-mid tabular-nums">{a.defaultStart}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text">Where?</h2>
              <label className="block">
                <span className={label}>The place</span>
                <input value={f.place} onChange={(e) => set({ place: e.target.value })}
                  required minLength={2} maxLength={80} placeholder="Nag Tibba" className={field} />
                <span className={hint}>Where you are actually going. Everyone sees this.</span>
              </label>
              <label className="block">
                <span className={label}>Meet around</span>
                <input value={f.meetArea} onChange={(e) => set({ meetArea: e.target.value })}
                  required minLength={2} maxLength={120} placeholder="Dehradun ISBT" className={field} />
                <span className={hint}>
                  A town or landmark. Somewhere public with people around — a bus stand, a car
                  park, a chai stall. The exact spot comes later and goes to fewer people.
                </span>
              </label>
              <button type="button" onClick={() => setStep(2)}
                className="rounded-sm bg-forest px-5 py-2.5 font-body text-[10px] uppercase tracking-[0.12em] text-paper">
                Next — when
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text">When?</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={label}>Date</span>
                  <input type="date" value={f.startsOn} min={tomorrowIst()}
                    onChange={(e) => set({ startsOn: e.target.value })} required className={field} />
                </label>
                <label className="block">
                  <span className={label}>How many people</span>
                  <input type="number" min={spec.minParty} max={8} value={f.capacity}
                    onChange={(e) => set({ capacity: Number(e.target.value) })} required className={field} />
                  <span className={hint}>Including you. Between {spec.minParty} and 8.</span>
                </label>
                <label className="block">
                  <span className={label}>Leaving at</span>
                  <input type="time" value={f.startTime} min={spec.startMin} max={spec.startMax}
                    onChange={(e) => set({ startTime: e.target.value })} required className={field} />
                  <span className={hint}>Between {spec.startMin} and {spec.startMax} for {spec.label.toLowerCase()}.</span>
                </label>
                <label className="block">
                  <span className={label}>Back by</span>
                  <input type="time" value={f.backBy}
                    onChange={(e) => set({ backBy: e.target.value })} required className={field} />
                  <span className={hint}>{spec.endsNextDay ? 'The next morning.' : '19:00 at the latest.'}</span>
                </label>
              </div>
              <div>
                <span className={label}>How hard</span>
                <div className="mt-2 flex gap-2">
                  {(['easy', 'moderate', 'hard'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => set({ effort: k })}
                      aria-pressed={f.effort === k}
                      className={`rounded-full border px-4 py-1.5 font-body text-xs capitalize transition-colors ${
                        f.effort === k ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text'
                      }`}>{k}</button>
                  ))}
                </div>
                <span className={hint}>Be honest — somebody will plan their day around this.</span>
              </div>
              <button type="button" onClick={() => setStep(3)}
                className="rounded-sm bg-forest px-5 py-2.5 font-body text-[10px] uppercase tracking-[0.12em] text-paper">
                Next — the details
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text">The details</h2>

              <div className="rounded-sm border border-forest/30 bg-forest/[0.04] p-5">
                <label className="block">
                  <span className={label}>Exact meeting point</span>
                  <input value={f.meetingPoint} onChange={(e) => set({ meetingPoint: e.target.value })}
                    required minLength={2} maxLength={200}
                    placeholder="Gate 2, behind the tea stall" className={field} />
                  <span className={hint}>
                    Held back until {spec.minParty} people are going, and shown only to the ones
                    you confirm. Do not put anything here you would not want a stranger to have.
                  </span>
                </label>
                <label className="mt-5 block">
                  <span className={label}>Getting there</span>
                  <input value={f.logistics} onChange={(e) => set({ logistics: e.target.value })}
                    maxLength={300} placeholder="Shared cab from ISBT, roughly ₹300 each" className={field} />
                </label>
              </div>

              {spec.needsNightNote && (
                <label className="block rounded-sm border border-clay/40 bg-clay/[0.04] p-5">
                  <span className={label}>How does everyone get back in the dark?</span>
                  <textarea value={f.nightNote} onChange={(e) => set({ nightNote: e.target.value })}
                    rows={2} minLength={10} maxLength={400} required
                    placeholder="Two cars, headlamps required, we drive back together at 00:30."
                    className={field} />
                  <span className={hint}>
                    Required for anything after dark, and not a checkbox on purpose — writing the
                    sentence is what makes you check the descent actually works.
                  </span>
                </label>
              )}

              <label className="block">
                <span className={label}>Anything else</span>
                <textarea value={f.note} onChange={(e) => set({ note: e.target.value })}
                  rows={3} maxLength={400}
                  placeholder="Bring 2L water and something warm. We'll stop for chai on the way back."
                  className={field} />
              </label>

              <SafetyNotes variant="compact" />

              {error && <p className="font-body text-sm text-clay">{error}</p>}

              <button type="submit" disabled={pending || !canPost}
                className="w-full rounded-sm bg-forest px-6 py-3.5 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-40">
                {pending ? 'Posting…' : 'Post this walk'}
              </button>
              {!canPost && (
                <p className="text-center font-body text-xs text-mid">
                  Still needs a place, a meeting area and the exact spot
                  {spec.needsNightNote ? ', plus how everyone gets back' : ''}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The card they are building, live. Same visual language as the board, so
          what you write is literally what other people will read. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className={label}>How it will look</p>
        <div style={{ background: light.wash }}
          className="mt-3 flex overflow-hidden rounded-sm border border-rule">
          <span aria-hidden="true" style={{ background: light.bar }} className="w-1 shrink-0" />
          <div className="min-w-0 flex-1 p-4">
            <div className="flex items-baseline gap-2">
              <span style={{ color: light.ink }} className="font-mono text-sm tabular-nums">{f.startTime}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mid">{light.label}</span>
            </div>
            <h3 className="mt-1 font-display text-xl leading-tight text-text">
              {f.place || <span className="text-mid/50">Where are you going?</span>}
            </h3>
            <p className="mt-1 font-body text-xs text-mid">
              {spec.label} · from {f.meetArea || '…'} · back {f.backBy}
              {spec.endsNextDay ? ' next day' : ''}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-mid tabular-nums">
              {dayLabel} · 1/{f.capacity} · {f.effort}
            </p>
          </div>
        </div>
        <p className="mt-3 font-body text-xs leading-relaxed text-mid">
          The exact meeting point is never on this card. It reaches people only once{' '}
          {spec.minParty} are going and you have confirmed them.
        </p>
      </aside>
    </form>
  )
}
