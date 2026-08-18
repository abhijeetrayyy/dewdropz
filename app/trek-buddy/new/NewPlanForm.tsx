'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TrekMoment, TrekPlanRow } from '@/actions/trekBuddy'
import { createTrekPlan, type TrekKind } from '@/actions/trekBuddy'
import { DIFFICULTY_LABEL, lightForTime } from '@/lib/trek'
import SafetyNotes from '@/components/trek/SafetyNotes'
import CoverPicker from '@/components/trek/CoverPicker'
import DepthFields from '@/components/trek/DepthFields'
import TrekPlanCard from '@/components/trek/TrekPlanCard'

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

function addDays(d: string, n: number) {
  const t = new Date(d + 'T00:00:00')
  t.setDate(t.getDate() + n)
  return ymd(t)
}
const nextDay = (d: string) => addDays(d, 1)

/** Whole days between two yyyy-mm-dd, inclusive of both ends. */
function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000
  ) + 1
}

const shortDay = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

const LANGUAGES = ['Hindi', 'English', 'Garhwali', 'Punjabi', 'Bengali']

const label = 'font-mono text-[10px] uppercase tracking-[0.2em] text-mid'
const field =
  'mt-2 w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-base text-text placeholder:text-mid/60 focus:border-forest focus:outline-none'
const hint = 'mt-1.5 block font-body text-xs leading-relaxed text-mid'

/** The four steps, named. Posting a walk is a sequence, so it is numbered. */
const STEPS = ['The idea', 'Where', 'How long', 'The company', 'Publish'] as const

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
export default function NewPlanForm({
  kinds,
  initialActivity,
  trekGender,
  userId,
  hostName,
}: {
  /** What the board is taking today, straight from the database (057). */
  kinds: TrekKind[]
  initialActivity?: string
  trekGender: string | null
  /** Storage writes are namespaced by it, and the bucket policy checks it. */
  userId: string
  /** Shown on the preview card, because the board shows whose walk it is. */
  hostName: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  // Arriving from a quick-start button means question one is already answered.
  const [step, setStep] = useState(initialActivity ? 1 : 0)

  const byKey = useMemo(() => Object.fromEntries(kinds.map((k) => [k.key, k])), [kinds])
  const initial = byKey[initialActivity ?? ''] ?? kinds[0]
  const [f, setF] = useState({
    activity: initial.key,
    activityOther: '',
    place: '',
    meetArea: '',
    startsOn: tomorrowIst(),
    endsOn: initial.endsNextDay ? nextDay(tomorrowIst()) : tomorrowIst(),
    // Multi-day trips carry no hour by default. On a six-day walk "leaves at
    // 06:00" is a detail of day one, and asking a host to invent a return time
    // for day six is asking for a fiction.
    timed: true,
    startTime: initial.defaultStart,
    backBy: initial.defaultBackBy,
    womenOnly: false,
    seniorFriendly: false,
    minTrust: 0 as 0 | 1 | 2,
    coverUrl: null as string | null,
    distanceKm: '',
    gainM: '',
    costRupees: '',
    bring: [] as string[],
    itinerary: [] as TrekMoment[],
    languages: [] as string[],
    capacity: Math.max(4, initial.minParty),
    difficulty: 'moderate' as 'easy' | 'moderate' | 'difficult',
    meetingPoint: '',
    note: '',
    logistics: '',
    nightNote: '',
  })
  // Functional, so two changes in one tick cannot clobber each other.
  const set = (p: Partial<typeof f>) => setF((prev) => ({ ...prev, ...p }))
  const spec = byKey[f.activity] ?? initial
  const light = useMemo(() => lightForTime(f.timed ? f.startTime : '06:00'), [f.timed, f.startTime])
  const days = daysBetween(f.startsOn, f.endsOn)
  const canBeWomenOnly = trekGender === 'woman'
  // For anything that runs into the dark the departure hour is the whole point,
  // so it stays required however many days the trip lasts.
  const hoursMatter = spec.needsNightNote || spec.dayPart !== 'day'

  /** Set the length in days, keeping the start where it is. */
  const setDays = (n: number) =>
    setF((prev) => ({
      ...prev,
      endsOn: addDays(prev.startsOn, Math.max(0, Math.min(31, n - 1))),
      // Past a single day the hour stops being the defining fact, so the form
      // stops insisting on one. The host can still add it back.
      timed: hoursMatter || n <= 1,
    }))

  /** Moving the start date drags the end with it, so a trip keeps its length. */
  const setStart = (d: string) =>
    setF((prev) => ({ ...prev, startsOn: d, endsOn: addDays(d, daysBetween(prev.startsOn, prev.endsOn) - 1) }))

  const toggleLanguage = (l: string) =>
    setF((prev) => ({
      ...prev,
      languages: prev.languages.includes(l)
        ? prev.languages.filter((x) => x !== l)
        : [...prev.languages, l],
    }))

  // Changing the kind of outing re-seeds its hours. Somebody switching from
  // trekking to camping should not have to work out that 07:00 is no longer a
  // legal start — the database would refuse it and they would have to guess why.
  function pickActivity(key: string) {
    const a = byKey[key]
    if (!a) return
    setF((prev) => ({
      ...prev,
      activity: key,
      startTime: a.defaultStart,
      backBy: a.defaultBackBy,
      capacity: Math.max(prev.capacity, a.minParty),
      endsOn: a.endsNextDay ? nextDay(prev.startsOn) : prev.startsOn,
      // Camping is an overnight by definition and still wants its hours; a
      // multi-day trek does not.
      timed: true,
    }))
    setStep(1)
  }

  const canPost = Boolean(
    f.place.trim() && f.meetArea.trim() && f.meetingPoint.trim() &&
    (!spec.needsNightNote || f.nightNote.trim().length >= 10) &&
    // A host-named outing has to actually be named.
    (!spec.isOpenEnded || f.activityOther.trim().length >= 3)
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await createTrekPlan({
        ...f,
        endsOn: spec.endsNextDay && f.endsOn === f.startsOn ? nextDay(f.startsOn) : f.endsOn,
        startTime: f.timed ? f.startTime : undefined,
        backBy: f.timed ? f.backBy : undefined,
        languages: f.languages.length ? f.languages : undefined,
        activityOther: spec.isOpenEnded ? f.activityOther.trim() : undefined,
        nightNote: spec.needsNightNote ? f.nightNote : undefined,
        coverUrls: f.coverUrl ? [f.coverUrl] : undefined,
        // '' means "not stated", which is a different thing from zero and has
        // to stay different all the way to the column.
        distanceKm: f.distanceKm.trim() === '' ? null : Number(f.distanceKm),
        gainM: f.gainM.trim() === '' ? null : Number(f.gainM),
        costPaise: f.costRupees.trim() === '' ? null : Math.round(Number(f.costRupees) * 100),
        bring: f.bring.map((b) => b.trim()).filter(Boolean),
        itinerary: f.itinerary
          .map((m) => ({ ...m, label: m.label.trim(), detail: m.detail?.trim() || undefined }))
          .filter((m) => m.label !== ''),
      })
      if ('error' in r) { setError(r.error); return }
      router.push('/trek-buddy')
    })
  }

  const dayLabel = new Date(f.startsOn + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  // The form's state, shaped as the row the board would have loaded. Fields the
  // card does not read are filled with something honest rather than something
  // clever — nothing here is written anywhere, it exists for one render.
  const preview: TrekPlanRow = {
    id: 'preview',
    host_id: userId,
    host_name: hostName,
    activity: f.activity,
    activity_other: spec.isOpenEnded ? f.activityOther : null,
    activity_label: spec.isOpenEnded ? f.activityOther || 'Something else' : spec.label,
    place: f.place || 'Where are you going?',
    meet_area: f.meetArea || '…',
    starts_on: f.startsOn,
    ends_on: f.endsOn,
    start_time: f.timed ? f.startTime : '06:00',
    back_by: f.backBy,
    // The card reads starts_at for both the date block and the countdown, so a
    // preview needs a real instant, not the date alone.
    starts_at: new Date(`${f.startsOn}T${f.timed ? f.startTime : '06:00'}:00+05:30`).toISOString(),
    ends_at: new Date(`${f.endsOn}T${f.backBy || '17:00'}:00+05:30`).toISOString(),
    day_part: 'day',
    min_party: spec.minParty,
    night_note: null,
    capacity: f.capacity,
    going_count: 1,
    spots_left: Math.max(0, f.capacity - 1),
    effort: 'moderate' as TrekPlanRow['effort'],
    difficulty: f.difficulty,
    women_only: f.womenOnly,
    senior_friendly: f.seniorFriendly,
    languages: f.languages,
    cover_urls: f.coverUrl ? [f.coverUrl] : [],
    distance_km: f.distanceKm.trim() === '' ? null : Number(f.distanceKm),
    gain_m: f.gainM.trim() === '' ? null : Number(f.gainM),
    cost_paise: f.costRupees.trim() === '' ? null : Math.round(Number(f.costRupees) * 100),
    bring: f.bring,
    itinerary: f.itinerary,
    is_live: true,
    note: f.note || null,
    status: 'open',
    cancelled_at: null,
    cancel_reason: null,
    hidden_at: null,
  }

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
              <p className="mt-1.5 font-body text-sm text-mid">
                Pick the closest thing. The hours and the group size fill themselves in from it,
                and the board refuses anything that disagrees.
              </p>

              {/* Grouped by when it happens, because that is the fact that
                  changes what the outing IS — a walk at 05:20 and one at 21:40
                  are different undertakings, not two rows in a list. */}
              {(['day', 'evening', 'overnight'] as const).map((part) => {
                const group = kinds.filter((k) => k.dayPart === part && !k.isOpenEnded)
                if (!group.length) return null
                return (
                  <div key={part} className="mt-6">
                    <p className={label}>
                      {part === 'day' ? 'In daylight' : part === 'evening' ? 'After dark' : 'Overnight'}
                    </p>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {group.map((a) => (
                        <button key={a.key} type="button" onClick={() => pickActivity(a.key)}
                          className="flex items-baseline justify-between gap-3 rounded-sm border border-rule px-4 py-3.5 text-left transition-colors hover:border-forest">
                          <span>
                            <span className="block font-body text-sm text-text">{a.label}</span>
                            <span className="block font-body text-xs text-mid">{a.blurb}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-mid tabular-nums">
                            {a.defaultStart}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* The host-named kind, kept apart from the list. It is a
                  different sort of choice: everything else tells you what you
                  are getting, this one asks you. */}
              {kinds.filter((k) => k.isOpenEnded).map((a) => (
                <button key={a.key} type="button" onClick={() => pickActivity(a.key)}
                  className="mt-6 flex w-full items-baseline justify-between gap-3 rounded-sm border border-dashed border-rule px-4 py-3.5 text-left transition-colors hover:border-forest">
                  <span>
                    <span className="block font-body text-sm text-text">{a.label}</span>
                    <span className="block font-body text-xs text-mid">
                      None of those fit? Name it yourself.
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-mid">+</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-text">Where?</h2>

              {spec.isOpenEnded && (
                <label className="block">
                  <span className={label}>What is it?</span>
                  <input value={f.activityOther}
                    onChange={(e) => set({ activityOther: e.target.value })}
                    required minLength={3} maxLength={40}
                    placeholder="Fossil hunting" className={field} />
                  <span className={hint}>
                    Two or three words. This is what people see on the board, so it is scanned
                    like everything else anyone writes here.
                  </span>
                </label>
              )}

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
                className="trek-pill trek-pill-act font-body disabled:opacity-40">
                Next — when
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <h2 className="font-display text-2xl text-text">How long are you out?</h2>

              {/* Length first, because it is the fact that decides whether the
                  hours even matter. A day walk is an hour; a six-day trek is a
                  span, and the form should not pretend they are the same shape. */}
              <div>
                <span className={label}>Days out</span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 5, 7].map((n) => (
                    <button key={n} type="button" onClick={() => setDays(n)}
                      aria-pressed={days === n}
                      className={`rounded-full border px-4 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                        days === n ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text'
                      }`}>
                      {n === 1 ? 'One day' : `${n} days`}
                    </button>
                  ))}
                  <span className="flex items-center gap-1.5 rounded-full border border-rule px-2 py-1">
                    <button type="button" onClick={() => setDays(Math.max(1, days - 1))}
                      aria-label="One day fewer"
                      className="h-6 w-6 rounded-full font-mono text-sm text-mid transition-colors hover:bg-paper-warm hover:text-text">−</button>
                    <span className="min-w-[2ch] text-center font-mono text-xs text-text tabular-nums">{days}</span>
                    <button type="button" onClick={() => setDays(Math.min(32, days + 1))}
                      aria-label="One day more"
                      className="h-6 w-6 rounded-full font-mono text-sm text-mid transition-colors hover:bg-paper-warm hover:text-text">+</button>
                  </span>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={label}>Setting off</span>
                  <input type="date" value={f.startsOn} min={tomorrowIst()}
                    onChange={(e) => setStart(e.target.value)} required className={field} />
                  <span className={hint}>
                    {days > 1 ? `Back on ${shortDay(f.endsOn)}.` : 'Back the same day.'}
                  </span>
                </label>
                <label className="block">
                  <span className={label}>How many people</span>
                  <input type="number" min={spec.minParty} max={8} value={f.capacity}
                    onChange={(e) => set({ capacity: Number(e.target.value) })} required className={field} />
                  <span className={hint}>Including you. Between {spec.minParty} and 8.</span>
                </label>
              </div>

              {/* Hours. Required for a day out and for anything after dark;
                  optional the moment a trip runs over several days. */}
              {f.timed ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className={label}>Leaving at</span>
                    <input type="time" value={f.startTime} min={spec.startMin} max={spec.startMax}
                      onChange={(e) => set({ startTime: e.target.value })} required className={field} />
                    <span className={hint}>Between {spec.startMin} and {spec.startMax} for {spec.label.toLowerCase()}.</span>
                  </label>
                  <label className="block">
                    <span className={label}>{days > 1 ? 'Back on the last day by' : 'Back by'}</span>
                    <input type="time" value={f.backBy}
                      onChange={(e) => set({ backBy: e.target.value })} required className={field} />
                    <span className={hint}>{spec.endsNextDay ? 'The next morning.' : '19:00 at the latest.'}</span>
                  </label>
                  {days > 1 && !hoursMatter && (
                    <button type="button" onClick={() => set({ timed: false })}
                      className="justify-self-start border-b border-rule pb-1 font-body text-xs text-mid transition-colors hover:text-text">
                      Drop the hours — this one is measured in days
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-rule px-4 py-4">
                  <p className="font-body text-sm text-text">
                    {days} days on the hill — no hours stated.
                  </p>
                  <p className={hint}>
                    Right for a long trek: the day-one departure is something you settle with
                    the people coming, not a headline on the board.
                  </p>
                  <button type="button" onClick={() => set({ timed: true })}
                    className="mt-2 border-b border-rule pb-1 font-body text-xs text-mid transition-colors hover:text-text">
                    Add a departure time anyway
                  </button>
                </div>
              )}

              <div>
                <span className={label}>How hard</span>
                <div className="mt-2 flex gap-2">
                  {(['easy', 'moderate', 'difficult'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => set({ difficulty: k })}
                      aria-pressed={f.difficulty === k}
                      className={`rounded-full border px-4 py-1.5 font-body text-xs capitalize transition-colors ${
                        f.difficulty === k ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text'
                      }`}>{k}</button>
                  ))}
                </div>
                <span className={hint}>Be honest — somebody will plan their day around this.</span>
              </div>

              <button type="button" onClick={() => setStep(3)}
                className="trek-pill trek-pill-act font-body disabled:opacity-40">
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

              {/* Who it is for. These are the filters people actually search the
                  board with, so they belong on the post rather than buried in
                  the note where nothing can read them. */}
              <div className="space-y-5 border-t border-rule pt-6">
                <div>
                  <span className={label}>Speaks</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button key={l} type="button" onClick={() => toggleLanguage(l)}
                        aria-pressed={f.languages.includes(l)}
                        className={`rounded-full border px-3.5 py-1.5 font-body text-xs transition-colors ${
                          f.languages.includes(l)
                            ? 'border-forest bg-forest text-paper'
                            : 'border-rule text-mid hover:border-text hover:text-text'
                        }`}>{l}</button>
                    ))}
                  </div>
                  <span className={hint}>What the group will be speaking on the walk.</span>
                </div>

                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={f.seniorFriendly}
                    onChange={(e) => set({ seniorFriendly: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-forest" />
                  <span>
                    <span className="block font-body text-sm text-text">Senior friendly</span>
                    <span className="block font-body text-xs text-mid">
                      Unhurried, with rests, and nothing that needs scrambling.
                    </span>
                  </span>
                </label>

                {canBeWomenOnly ? (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={f.womenOnly}
                      onChange={(e) => set({ womenOnly: e.target.checked })}
                      className="mt-1 h-4 w-4 accent-clay" />
                    <span>
                      <span className="block font-body text-sm text-text">Women only</span>
                      <span className="block font-body text-xs text-mid">
                        Only members whose profile says women can ask to come. The board enforces
                        this, not the note.
                      </span>
                    </span>
                  </label>
                ) : (
                  <p className="font-body text-xs leading-relaxed text-mid">
                    Women-only walks can be posted by members whose profile says women.{' '}
                    <Link href="/trek-buddy/profile" className="text-forest underline underline-offset-4">
                      Set that on your profile
                    </Link>{' '}
                    if it applies to you.
                  </p>
                )}
              </div>

              <DepthFields
                distanceKm={f.distanceKm}
                gainM={f.gainM}
                costRupees={f.costRupees}
                bring={f.bring}
                itinerary={f.itinerary}
                set={set}
                label={label}
                field={field}
              />

              <div>
                <span className={label}>The photograph</span>
                <div className="mt-2">
                  <CoverPicker
                    userId={userId}
                    value={f.coverUrl}
                    onChange={(coverUrl) => set({ coverUrl })}
                  />
                </div>
              </div>

              {/* Who may ask. Enforced in the database beside the women-only
                  gate, so it holds whatever route a request arrives by.
                  Deliberately not called "safety level": it filters who can
                  ask, and a host still chooses who actually comes. */}
              <div className="space-y-3">
                <span className={label}>Who can ask to come</span>
                {([
                  [0, 'Anyone on the board', 'Everyone who has joined and filled in a profile.'],
                  [1, 'People with a verified phone', 'A confirmed mobile number. It proves they hold a SIM, not who they are — but it makes a throwaway account cost something.'],
                  [2, 'People who have been vouched for', 'Two people who actually walked with them said so afterwards. The hardest to fake, and the smallest group.'],
                ] as const).map(([value, name, why]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name="minTrust"
                      checked={f.minTrust === value}
                      onChange={() => set({ minTrust: value })}
                      className="mt-1 h-4 w-4 accent-clay"
                    />
                    <span>
                      <span className="block font-body text-sm text-text">{name}</span>
                      <span className="block font-body text-xs text-mid">{why}</span>
                    </span>
                  </label>
                ))}
                {f.minTrust > 0 && (
                  <p className="font-body text-xs leading-relaxed text-mid">
                    Worth knowing: this is a young board, so a higher bar can mean nobody is able
                    to ask yet. You can lower it later if the walk stays empty.
                  </p>
                )}
              </div>

              <label className="block">
                <span className={label}>Anything else</span>
                <textarea value={f.note} onChange={(e) => set({ note: e.target.value })}
                  rows={3} maxLength={400}
                  placeholder="Bring 2L water and something warm. We'll stop for chai on the way back."
                  className={field} />
              </label>

              <SafetyNotes variant="compact" />

              <button type="button" onClick={() => setStep(4)}
                className="trek-pill trek-pill-quiet font-body disabled:opacity-40">
                Last look →
              </button>
            </div>
          )}

          {/* Publish. Its own step because posting a walk spends something —
              strangers read it, plan around it and turn up. Until now the
              button sat at the bottom of the longest step, so the last thing
              anyone saw before committing was a packing list. */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl text-text">Last look, then it is live.</h2>
                <p className="mt-1.5 font-body text-sm text-mid">
                  The card on the right is exactly what the board will show.
                </p>
              </div>

              <dl className="divide-y divide-rule border-y border-rule">
                {([
                  ['Doing', spec.isOpenEnded ? f.activityOther || '—' : spec.label],
                  ['Going to', f.place || '—'],
                  ['Meeting around', f.meetArea || '—'],
                  ['Exact spot', f.meetingPoint || '—'],
                  ['Day', dayLabel + (days > 1 ? ` · ${days} days` : '')],
                  ['Leaving', f.timed ? f.startTime : 'No stated hour'],
                  ['Spots', `${f.capacity} including you`],
                  ['How hard', DIFFICULTY_LABEL[f.difficulty] ?? f.difficulty],
                  ['Who can ask', ['Anyone on the board', 'People with a verified phone', 'People who have been vouched for'][f.minTrust]],
                  ['Cost share', f.costRupees.trim() === '' ? 'Not stated' : `₹${f.costRupees} each`],
                  ['Photograph', f.coverUrl ? 'Added' : 'None'],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex gap-4 py-2.5">
                    <dt className="w-36 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-mid">
                      {k}
                    </dt>
                    <dd className="min-w-0 flex-1 font-body text-sm text-text">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* The one thing on this screen that is not a summary. It is the
                  board's central safety rule and the last moment to explain it
                  before a host wonders why nobody can find them. */}
              <div className="rounded-sm border border-rule bg-paper-warm/50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
                  Held back on purpose
                </p>
                <p className="mt-2 font-body text-xs leading-relaxed text-mid">
                  The exact meeting point does not go on the public page. It reaches the people you
                  have confirmed, and only once {spec.minParty} are going — so a walk nobody joins
                  never hands out an address.
                </p>
              </div>

              {error && <p className="font-body text-sm text-clay">{error}</p>}

              <button type="submit" disabled={pending || !canPost}
                className="trek-pill trek-pill-act font-body disabled:opacity-40">
                {pending ? 'Posting…' : 'Put it on the board'}
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

      {/* The card they are building, live.
          
          This renders the REAL TrekPlanCard from the form's own state rather
          than a hand-built lookalike. The lookalike that used to be here was
          written when the board was text-on-paper, and it kept rendering that
          layout after the board became photographs — so a screen headed "how it
          will look" was showing a design that no longer existed anywhere. A
          preview that can drift from the thing it previews is worse than none,
          because it is believed. This one cannot drift: it is the same
          component. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className={label}>Live preview — what the board sees</p>
        <div className="mt-3">
          <TrekPlanCard plan={preview} />
        </div>
        <p className="mt-3 font-body text-xs leading-relaxed text-mid">
          The exact meeting point is never on this card. It reaches people only once{' '}
          {spec.minParty} are going and you have confirmed them.
        </p>
        <p className="mt-2 font-body text-xs leading-relaxed text-mid">
          Change the hour and the card changes colour — the board sorts a day by its light.
        </p>
      </aside>
    </form>
  )
}
