'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TrekMoment } from '@/actions/trekBuddy'
import { createTrekPlan, type TrekKind } from '@/actions/trekBuddy'
import { DIFFICULTY_LABEL, costLabel, dotColor, hourInk, lightForTime } from '@/lib/trek'
import SafetyNotes from '@/components/trek/SafetyNotes'
import CoverPicker from '@/components/trek/CoverPicker'
import DepthFields from '@/components/trek/DepthFields'
import Avatar from '@/components/trek/ui/Avatar'
import Cover from '@/components/trek/ui/Cover'
import HourPill from '@/components/trek/ui/HourPill'
import SeatMeter from '@/components/trek/ui/SeatMeter'
import Countdown from '@/components/trek/Countdown'
import { LiveDot, Tag } from '@/components/trek/ui/Bits'

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

/**
 * What each of the three difficulties actually means, in a sentence.
 *
 * The control was three chips reading "easy / moderate / difficult" with one
 * grey line under the row asking the host to be honest — which is a request
 * without a yardstick. A person who has walked for twenty years and a person
 * who has never left a park do not mean the same thing by "moderate", and the
 * whole reason this field exists is so a stranger can calibrate the day before
 * committing to it. So the three now carry the calibration on the face of the
 * control, where the host reads it at the moment of choosing.
 */
const DIFFICULTY_MEANING = [
  [
    'easy',
    'A path most of the way, nothing steep for long, and a rest whenever anybody needs one. Somebody who has never walked a hill can do this.',
  ],
  [
    'moderate',
    'A few hours of steady climbing and some rough ground. Comfortable if you walk regularly; genuinely hard work if you do not.',
  ],
  [
    'difficult',
    'Long, steep or exposed. Hill fitness assumed, and a head for ground where a slip would matter.',
  ],
] as const

/**
 * Who may ask to come, and what each bar actually proves.
 *
 * Lifted out of the JSX because it is the same species of data as the
 * difficulties above — a value, a name, and the honest limit of what it means.
 */
const TRUST_BARS = [
  [0, 'Anyone on the board', 'Everyone who has joined and filled in a profile.'],
  [1, 'People with a verified phone', 'A confirmed mobile number. It proves they hold a SIM, not who they are — but it makes a throwaway account cost something.'],
  [2, 'People who have been vouched for', 'Two people who actually walked with them said so afterwards. The hardest to fake, and the smallest group.'],
] as const

/** The three names, in the order TRUST_BARS declares them, for the summary. */
const TRUST_NAMES = TRUST_BARS.map(([, name]) => name)

// The form's shared field language. Every focus ring on the board is sage now —
// dawn was the old ring colour, and a focus ring is not an urgency, it is where
// the keyboard is.
const label = 'trek-label text-mid'
const field =
  'mt-2 w-full rounded-[var(--r-input)] border border-rule bg-surface px-4 py-3 font-body text-[15px] text-text placeholder:text-light focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/50'
/** The one input on a step that carries the walk's name. Set like a headline. */
const fieldDisplay =
  'mt-2 w-full rounded-[var(--r-input)] border border-rule bg-surface px-4 py-3.5 font-display text-xl font-normal text-text placeholder:text-light focus:border-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/50'
const hint = 'mt-1.5 block font-body text-xs leading-relaxed text-mid'
/** A choice you make by pressing the whole row. Selected state is set inline. */
const choiceRow =
  'flex cursor-pointer items-start gap-3 rounded-[var(--r-card)] border p-4 transition-colors duration-200'

/**
 * The four questions, in the order a person actually asks them.
 *
 * It was five, and the split was by database neighbourhood rather than by
 * thought — "Where" then "How long" then "The details" meant a host answered
 * where they were meeting three screens apart from where they were going. These
 * four are the design's, and each one is a whole question a person can answer
 * without holding the next one in their head.
 */
const STEPS = [
  'What are you gathering people for?',
  'When, and where in the world?',
  'Who is coming with you?',
  'Last look, then it is live.',
] as const

/** The rail's short form. The heading carries the whole sentence. */
const STEP_TABS = ['The idea', 'When & where', 'The company', 'Publish'] as const

/** A chip in the two selected/unselected states the board uses on paper. */
const chip = (on: boolean) =>
  `rounded-full border px-4 py-1.5 font-body text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
    on ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text hover:text-text'
  }`

/**
 * The pill that moves you on.
 *
 * It was an ink pill with amber type, which made every step of the composer
 * look like an urgent act. There is exactly one act per step and it is the same
 * act — go on — so it takes the board's primary: forest, sentence case, once.
 * The submit on step four is the only other pill on the screen and the two are
 * never visible together.
 */
const nextPill =
  'trek-pill trek-pill-act self-start font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage'

/** A quiet textual act — dropping the hours, adding them back. */
const quietAct =
  'border-b border-rule pb-1 font-body text-xs text-mid transition-colors hover:border-text hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage'

// Posting a walk, as a composer rather than a form.
//
// The old version was fourteen labelled inputs in a column — every field the
// database wanted, in schema order, all at the same visual weight. That is a
// data-entry screen, and it asks somebody who had a nice idea about Sunday to
// fill in a record.
//
// This asks four questions in the order a person actually thinks about them —
// what, when and where, who, and then a last look — and shows the card they are
// building, live, beside it. The preview is the point: you are not filling in a
// form, you are writing the thing other people will read, and you can see it the
// whole time.
//
// WHAT THE RESET CHANGED HERE, beyond the palette. This composer is where a
// walk's safety facts are either stated or lost, and until now they were the
// smallest things on it: difficulty was three word-chips in half a grid column,
// distance and climb were two 12px keys inside an optional block, and
// women-only and senior-friendly were tick-boxes sitting under a language
// picker. Every one of those is what a cautious stranger reads first. So step
// three is re-ordered around them and each one is given a panel, a heading and
// a sentence that says why an honest answer matters — difficulty now states
// what the three words actually mean, because "moderate" means nothing until
// somebody defines it.
//
// THE ONE MOMENT THE PRODUCT TEACHES ITSELF is still the departure-time field
// on step two. Its border and its type take the hour's own colour, the line
// under it names the band in plain words, and the preview card beside it moves
// to the same light. The hour colours are the one place colour carries meaning
// rather than emphasis, so they survive the reset untouched.
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
  // Always the first question, even when a quick-start button already answered
  // half of it. It used to jump to step two on arrival, which was right when
  // step one was only the activity picker — now step one also carries the place
  // and the story, and skipping it left a host looking at a departure time for
  // a walk that had no destination.
  const [step, setStep] = useState(0)

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

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="min-w-0">
        {/* Where you are in the sequence. Numbered because posting a walk IS an
            order — you cannot say where you are meeting before you know what
            you are doing.

            It was four uppercase mono micro-labels at 0.14em tracking, with the
            done steps in amber. Both were wrong: a tab is something you press,
            and nothing you press on this board is set in tracked-out capitals;
            and a step you have finished is a completed thing, which is forest,
            not a clock running down. So the rail is sentence case at reading
            size, the index stays monospace because an index is a figure, and
            the trail behind you is green. */}
        <ol className="flex flex-wrap gap-x-7 gap-y-2.5 border-b border-rule pb-4.5">
          {STEP_TABS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`flex items-baseline gap-2 whitespace-nowrap font-body text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage ${
                  i === step
                    ? 'font-medium text-text'
                    : i < step
                      ? 'text-forest hover:text-forest-mid'
                      : 'text-light hover:text-mid'
                }`}
              >
                <span className="font-mono text-xs tabular-nums">{i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          {/* ── 01 · The idea ──────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col gap-7">
              <div>
                <h2 className="trek-h2 text-text">{STEPS[0]}</h2>
                <p className="mt-2.5 max-w-prose font-body text-sm leading-relaxed text-mid">
                  Pick the closest thing. The hours and the group size fill themselves in from it,
                  and the board refuses anything that disagrees.
                </p>

                {/* Tiles, not a list of rows and not a select.
                    A select hides five of six choices behind a click, and every
                    one of them changes what the outing IS — a walk at 05:20 and
                    one at 21:40 are different undertakings. The dot is the
                    hour's own colour, so the grid is already the day. */}
                {(['day', 'evening', 'overnight'] as const).map((part) => {
                  const group = kinds.filter((k) => k.dayPart === part && !k.isOpenEnded)
                  if (!group.length) return null
                  return (
                    <div key={part} className="mt-6">
                      <p className={label}>
                        {part === 'day' ? 'In daylight' : part === 'evening' ? 'After dark' : 'Overnight'}
                      </p>
                      {/* `auto-rows-fr`: the kinds carry blurbs of different lengths, so
                          without it the tiles came out at 100 and 116px and a grid of
                          fifteen choices looked like a mistake. A chooser is a set of
                          equals — the whole point is that you are comparing them. */}
                      <div className="mt-2.5 grid grid-cols-1 auto-rows-fr gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {group.map((a) => (
                          <ActivityTile
                            key={a.key}
                            kind={a}
                            selected={f.activity === a.key}
                            onPick={() => pickActivity(a.key)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* The host-named kind, kept apart from the list. It is a
                    different sort of choice: everything else tells you what you
                    are getting, this one asks you — so it is drawn provisional,
                    with the dashed edge the product uses for anything not yet
                    settled. */}
                {kinds.filter((k) => k.isOpenEnded).map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => pickActivity(a.key)}
                    aria-pressed={f.activity === a.key}
                    className="mt-4 flex w-full items-center justify-between gap-3 rounded-[var(--r-card)] border-2 border-dashed border-rule-warm bg-paper-warm/40 px-4 py-4 text-left transition-colors duration-200 hover:border-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                    style={
                      f.activity === a.key
                        ? { borderColor: 'var(--forest)', background: 'var(--sage-soft)' }
                        : undefined
                    }
                  >
                    <span>
                      <span className="block font-body text-[15px] font-medium text-text">{a.label}</span>
                      <span className="mt-0.5 block font-body text-xs text-mid">
                        None of those fit? Name it yourself.
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 font-body text-lg leading-none text-mid">
                      +
                    </span>
                  </button>
                ))}
              </div>

              {spec.isOpenEnded && (
                <label className="block">
                  <span className={label}>What is it?</span>
                  <input value={f.activityOther}
                    onChange={(e) => set({ activityOther: e.target.value })}
                    required minLength={3} maxLength={40}
                    placeholder="Fossil hunting" className={fieldDisplay} />
                  <span className={hint}>
                    Two or three words. This is what people see on the board, so it is scanned
                    like everything else anyone writes here.
                  </span>
                </label>
              )}

              {/* The headline on the board, so it is set like one. */}
              <label className="block">
                <span className={label}>The place</span>
                <input value={f.place} onChange={(e) => set({ place: e.target.value })}
                  required minLength={2} maxLength={80} placeholder="Nag Tibba" className={fieldDisplay} />
                <span className={hint}>Where you are actually going. Everyone sees this.</span>
              </label>

              <label className="block">
                <span className={label}>Anything else</span>
                <textarea value={f.note} onChange={(e) => set({ note: e.target.value })}
                  rows={3} maxLength={400}
                  placeholder="Bring 2L water and something warm. We'll stop for chai on the way back."
                  className={`${field} resize-y leading-relaxed`} />
                <span className={hint}>
                  Two honest sentences beat ten bullet points. Say what the day feels like.
                </span>
              </label>

              <button type="button" onClick={() => setStep(1)} className={nextPill}>
                Next — when &amp; where
              </button>
            </div>
          )}

          {/* ── 02 · When and where ────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-7">
              <h2 className="trek-h2 text-text">{STEPS[1]}</h2>

              <label className="block">
                <span className={label}>Meet around</span>
                <input value={f.meetArea} onChange={(e) => set({ meetArea: e.target.value })}
                  required minLength={2} maxLength={120} placeholder="Dehradun ISBT" className={field} />
                <span className={hint}>
                  A town or landmark. Somewhere public with people around — a bus stand, a car
                  park, a chai stall. The exact spot comes later and goes to fewer people.
                </span>
              </label>

              {/* Length first, because it is the fact that decides whether the
                  hours even matter. A day walk is an hour; a six-day trek is a
                  span, and the form should not pretend they are the same shape. */}
              <div>
                <span className={label}>Days out</span>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 5, 7].map((n) => (
                    <button key={n} type="button" onClick={() => setDays(n)}
                      aria-pressed={days === n}
                      className={`${chip(days === n)} tabular-nums`}>
                      {n === 1 ? 'One day' : `${n} days`}
                    </button>
                  ))}
                  <span className="flex items-center gap-1.5 rounded-full border border-rule px-2 py-1">
                    <button type="button" onClick={() => setDays(Math.max(1, days - 1))}
                      aria-label="One day fewer"
                      className="h-6 w-6 rounded-full font-body text-base leading-none text-mid transition-colors hover:bg-paper-warm hover:text-text">−</button>
                    <span className="min-w-[2ch] text-center font-mono text-xs text-text tabular-nums">{days}</span>
                    <button type="button" onClick={() => setDays(Math.min(32, days + 1))}
                      aria-label="One day more"
                      className="h-6 w-6 rounded-full font-body text-base leading-none text-mid transition-colors hover:bg-paper-warm hover:text-text">+</button>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className={label}>Setting off</span>
                  <input type="date" value={f.startsOn} min={tomorrowIst()}
                    onChange={(e) => setStart(e.target.value)} required className={field} />
                  <span className={hint}>
                    {days > 1 ? `Back on ${shortDay(f.endsOn)}.` : 'Back the same day.'}
                  </span>
                </label>

                {/* Hours. Required for a day out and for anything after dark;
                    optional the moment a trip runs over several days. */}
                {f.timed && (
                  <label className="block">
                    <span className={label}>Leaving at</span>
                    {/* THE FIELD THAT TEACHES THE PRODUCT. Its edge and its type
                        are the hour's own colour, and the line under it names
                        the band and says out loud what the card will do with it.
                        2px because a coloured 1px edge reads as a focus ring.
                        The line was 10px mono in capitals at 0.14em — a status
                        sentence dressed as a machine readout. It is a sentence,
                        so it is set as one. */}
                    <input type="time" value={f.startTime} min={spec.startMin} max={spec.startMax}
                      onChange={(e) => set({ startTime: e.target.value })} required
                      className="mt-2 w-full rounded-[var(--r-input)] border-2 bg-surface px-4 py-[11px] font-mono text-[15px] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/50"
                      style={{
                        borderColor: hourInk(light, 'light'),
                        color: hourInk(light, 'light'),
                        transition: 'border-color .25s ease, color .25s ease',
                      }} />
                    <span
                      className="mt-2 flex items-center gap-2 font-body text-[13px] font-medium"
                      style={{ color: hourInk(light, 'light'), transition: 'color .25s ease' }}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: dotColor(light, 'light'), transition: 'background .25s ease' }}
                      />
                      {light.label} — the card takes this colour
                    </span>
                    <span className={hint}>
                      Between {spec.startMin} and {spec.startMax} for {spec.label.toLowerCase()}.
                    </span>
                  </label>
                )}
              </div>

              {f.timed ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* The hour back. It reads as a scheduling detail and it is
                      not one: it is the hour somebody at home has been told to
                      expect, and the one a walker checks against the light left
                      in the sky. So it carries a real sentence now instead of
                      three words. */}
                  <label className="block">
                    <span className={label}>{days > 1 ? 'Back on the last day by' : 'Back by'}</span>
                    <input type="time" value={f.backBy}
                      onChange={(e) => set({ backBy: e.target.value })} required
                      className={`${field} font-mono tabular-nums`} />
                    <span className={hint}>
                      The hour you expect everyone to be down. It goes on the card, and it is the
                      hour the person you told about this walk will be watching.{' '}
                      {spec.endsNextDay ? 'The next morning.' : '19:00 at the latest.'}
                    </span>
                  </label>
                  {days > 1 && !hoursMatter && (
                    <button type="button" onClick={() => set({ timed: false })}
                      className={`self-end justify-self-start ${quietAct}`}>
                      Drop the hours — this one is measured in days
                    </button>
                  )}
                </div>
              ) : (
                <div className="trek-provisional px-4 py-4">
                  <p className="font-body text-sm text-text">
                    {days} days on the hill — no hours stated.
                  </p>
                  <p className={hint}>
                    Right for a long trek: the day-one departure is something you settle with
                    the people coming, not a headline on the board.
                  </p>
                  <button type="button" onClick={() => set({ timed: true })}
                    className={`mt-2 ${quietAct}`}>
                    Add a departure time anyway
                  </button>
                </div>
              )}

              <div>
                <span className={label}>The photograph</span>
                <div className="mt-2.5">
                  <CoverPicker
                    userId={userId}
                    value={f.coverUrl}
                    onChange={(coverUrl) => set({ coverUrl })}
                  />
                </div>
              </div>

              <button type="button" onClick={() => setStep(2)} className={nextPill}>
                Next — the company
              </button>
            </div>
          )}

          {/* ── 03 · The company ───────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-7">
              <div>
                <h2 className="trek-h2 text-text">{STEPS[2]}</h2>
                <p className="mt-2.5 max-w-prose font-body text-sm leading-relaxed text-mid">
                  Everything on this step is what a stranger reads before deciding whether the day
                  is theirs. None of it is decoration, and none of it is checked by anybody but you.
                </p>
              </div>

              {/* HOW HARD. The first field on the step, in a panel of its own,
                  because it is the single most consequential sentence a host
                  writes — and it was three chips in half a grid column. */}
              <div className="rounded-[var(--r-card)] border border-rule bg-surface p-5">
                <h3 className="trek-h3 text-text">How hard is it?</h3>
                <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
                  Be honest — somebody will plan their day around this. It is the first thing a
                  person who has never walked a hill looks for, and the thing they will hold you to.
                </p>
                <div className="mt-4 flex flex-col gap-2.5">
                  {DIFFICULTY_MEANING.map(([k, meaning]) => (
                    <label
                      key={k}
                      className={choiceRow}
                      style={
                        f.difficulty === k
                          ? { borderColor: 'var(--forest)', background: 'var(--sage-soft)' }
                          : { borderColor: 'var(--rule)' }
                      }
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        checked={f.difficulty === k}
                        onChange={() => set({ difficulty: k })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
                      />
                      <span className="min-w-0">
                        <span className="block font-body text-[15px] font-medium text-text">
                          {DIFFICULTY_LABEL[k] ?? k}
                        </span>
                        <span className="mt-1 block font-body text-[13px] leading-relaxed text-mid">
                          {meaning}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className={label}>How many people</span>
                <input type="number" min={spec.minParty} max={8} value={f.capacity}
                  onChange={(e) => set({ capacity: Number(e.target.value) })} required
                  className={`${field} w-40 font-mono tabular-nums`} />
                <span className={hint}>Including you. Between {spec.minParty} and 8.</span>
              </label>

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

              {/* Who it is for. These are the filters people actually search the
                  board with, so they belong on the post rather than buried in
                  the note where nothing can read them — and they were two
                  tick-boxes under a language picker, which is where a fact goes
                  to be missed. Each is a pressable row that takes the same
                  colour its tag takes on the card: sage for a slower pace, clay
                  for women-only, so the composer and the board agree. */}
              <div className="rounded-[var(--r-card)] border border-rule bg-surface p-5">
                <h3 className="trek-h3 text-text">Who this walk suits</h3>
                <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
                  Both of these are filters on the board, not notes. Somebody searching for them is
                  searching because the answer decides whether they come at all.
                </p>

                <div className="mt-4 flex flex-col gap-2.5">
                  <label
                    className={choiceRow}
                    style={
                      f.seniorFriendly
                        ? { borderColor: 'var(--forest)', background: 'var(--sage-soft)' }
                        : { borderColor: 'var(--rule)' }
                    }
                  >
                    <input type="checkbox" checked={f.seniorFriendly}
                      onChange={(e) => set({ seniorFriendly: e.target.checked })}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
                    <span className="min-w-0">
                      <span className="block font-body text-[15px] font-medium text-text">
                        Senior friendly
                      </span>
                      <span className="mt-1 block font-body text-[13px] leading-relaxed text-mid">
                        Unhurried, with rests, and nothing that needs scrambling. Tick it only if
                        you will genuinely wait — somebody has been told this before and been left
                        behind.
                      </span>
                    </span>
                  </label>

                  {canBeWomenOnly ? (
                    <label
                      className={choiceRow}
                      style={
                        f.womenOnly
                          ? { borderColor: 'var(--clay)', background: 'var(--clay-wash)' }
                          : { borderColor: 'var(--rule)' }
                      }
                    >
                      <input type="checkbox" checked={f.womenOnly}
                        onChange={(e) => set({ womenOnly: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-clay" />
                      <span className="min-w-0">
                        <span className="block font-body text-[15px] font-medium text-text">
                          Women only
                        </span>
                        <span className="mt-1 block font-body text-[13px] leading-relaxed text-mid">
                          Only members whose profile says women can ask to come. The board enforces
                          this, not the note.
                        </span>
                      </span>
                    </label>
                  ) : (
                    <p className="rounded-[var(--r-card)] border border-rule px-4 py-3.5 font-body text-[13px] leading-relaxed text-mid">
                      Women-only walks can be posted by members whose profile says women.{' '}
                      <Link href="/trek-buddy/profile" className="text-forest underline underline-offset-4">
                        Set that on your profile
                      </Link>{' '}
                      if it applies to you.
                    </p>
                  )}
                </div>

                <div className="mt-5 border-t border-rule-soft pt-5">
                  <span className={label}>Speaks</span>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button key={l} type="button" onClick={() => toggleLanguage(l)}
                        aria-pressed={f.languages.includes(l)}
                        className={chip(f.languages.includes(l))}>{l}</button>
                    ))}
                  </div>
                  <span className={hint}>What the group will be speaking on the walk.</span>
                </div>
              </div>

              {/* Who may ask. Enforced in the database beside the women-only
                  gate, so it holds whatever route a request arrives by.
                  Deliberately not called "safety level": it filters who can
                  ask, and a host still chooses who actually comes. */}
              <div className="rounded-[var(--r-card)] border border-rule bg-surface p-5">
                <h3 className="trek-h3 text-text">Who can ask to come</h3>
                <p className="mt-2 max-w-prose font-body text-[13.5px] leading-relaxed text-mid">
                  This only decides who may ask. You still choose who actually comes, one person at
                  a time, and declining is silent.
                </p>
                <div className="mt-4 flex flex-col gap-2.5">
                  {TRUST_BARS.map(([value, name, why]) => (
                    <label
                      key={value}
                      className={choiceRow}
                      style={
                        f.minTrust === value
                          ? { borderColor: 'var(--forest)', background: 'var(--sage-soft)' }
                          : { borderColor: 'var(--rule)' }
                      }
                    >
                      <input
                        type="radio"
                        name="minTrust"
                        checked={f.minTrust === value}
                        onChange={() => set({ minTrust: value })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
                      />
                      <span className="min-w-0">
                        <span className="block font-body text-[15px] font-medium text-text">{name}</span>
                        <span className="mt-1 block font-body text-[13px] leading-relaxed text-mid">
                          {why}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {f.minTrust > 0 && (
                  <p className="mt-3.5 font-body text-[13px] leading-relaxed text-mid">
                    Worth knowing: this is a young board, so a higher bar can mean nobody is able
                    to ask yet. You can lower it later if the walk stays empty.
                  </p>
                )}
              </div>

              {/* The address, and the one field on this form that is not
                  published. It was held in a 2px amber card, on the theory that
                  amber meant "critical". Amber means a clock now, and nothing
                  about a meeting point is running out — what it is, is the
                  board's central protection, so it takes the board's primary
                  and says on its face what happens to it. */}
              <div
                className="rounded-[var(--r-card)] border-2 p-5"
                style={{ borderColor: 'var(--forest)', background: 'var(--sage-soft)' }}
              >
                <p className="trek-label text-forest">Never on the public page</p>
                <label className="mt-3.5 block">
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
                <div className="rounded-[var(--r-card)] border border-clay/40 bg-clay-wash/60 p-5">
                  <p className="trek-label text-clay-deep">Required after dark</p>
                  <label className="mt-3.5 block">
                    <span className={label}>How does everyone get back in the dark?</span>
                    <textarea value={f.nightNote} onChange={(e) => set({ nightNote: e.target.value })}
                      rows={2} minLength={10} maxLength={400} required
                      placeholder="Two cars, headlamps required, we drive back together at 00:30."
                      className={`${field} resize-y leading-relaxed`} />
                    <span className={hint}>
                      Required for anything after dark, and not a checkbox on purpose — writing the
                      sentence is what makes you check the descent actually works.
                    </span>
                  </label>
                </div>
              )}

              <SafetyNotes variant="compact" />

              <button type="button" onClick={() => setStep(3)} className={nextPill}>
                Last look
              </button>
            </div>
          )}

          {/* ── 04 · Publish ───────────────────────────────────────────────────
              Its own step because posting a walk spends something — strangers
              read it, plan around it and turn up. Until now the button sat at
              the bottom of the longest step, so the last thing anyone saw
              before committing was a packing list. */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="trek-h2 text-text">{STEPS[3]}</h2>
                <p className="mt-2.5 font-body text-sm text-mid">
                  The card on the right is exactly what the board will show.
                </p>
              </div>

              {/* The summary was a <dl> of grey key/value pairs, which is a
                  receipt — you read it, you do not check it. These are rows with
                  a disc, so the four that are still empty are countable from
                  across the room.

                  THREE marks, not two. A tick and a cross alone would put the
                  same red-adjacent weight on "no photograph" as on "no meeting
                  point", and one of those stops the post while the other is a
                  choice. Optional-and-blank gets a quiet dot instead.

                  The values were set in 11px monospace, which turned "Anyone on
                  the board" and "Nag Tibba" into machine output. Mono is for a
                  figure; these are mostly sentences, so they are body type. */}
              <ul className="flex flex-col gap-3">
                {([
                  ['Doing', spec.isOpenEnded ? f.activityOther : spec.label, spec.isOpenEnded ? 'need' : 'have'],
                  ['Going to', f.place, 'need'],
                  ['Meeting around', f.meetArea, 'need'],
                  ['Exact spot', f.meetingPoint, 'need'],
                  ['Day', dayLabel + (days > 1 ? ` · ${days} days` : ''), 'have'],
                  ['Leaving', f.timed ? f.startTime : 'No stated hour', 'have'],
                  ['Back by', f.timed ? f.backBy : 'No stated hour', 'have'],
                  ['Spots', `${f.capacity} including you`, 'have'],
                  ['How hard', DIFFICULTY_LABEL[f.difficulty] ?? f.difficulty, 'have'],
                  ['Distance', f.distanceKm.trim() === '' ? '' : `${f.distanceKm} km`, 'want'],
                  ['Total climb', f.gainM.trim() === '' ? '' : `${f.gainM} m`, 'want'],
                  ['Senior friendly', f.seniorFriendly ? 'Yes' : 'No', 'have'],
                  // Only shown to somebody who could actually set it — a row
                  // reading "Women only · No" on a host who is not permitted to
                  // post one is a fact about the account, not about the walk.
                  ['Women only', f.womenOnly ? 'Yes' : 'No', canBeWomenOnly ? 'have' : 'skip'],
                  ['Who can ask', TRUST_NAMES[f.minTrust], 'have'],
                  ['Getting back in the dark', f.nightNote, spec.needsNightNote ? 'need' : 'skip'],
                  ['Cost share', f.costRupees.trim() === '' ? '' : `₹${f.costRupees} each`, 'want'],
                  ['Photograph', f.coverUrl ? 'Added' : '', 'want'],
                ] as const)
                  .filter(([, , kind]) => kind !== 'skip')
                  .map(([k, v, kind]) => {
                    const filled = String(v).trim() !== ''
                    const missing = !filled && kind === 'need'
                    return (
                      <li
                        key={k}
                        className="flex items-center gap-3 rounded-[var(--r-card)] border bg-surface px-4.5 py-3.5"
                        style={{ borderColor: missing ? 'var(--clay)' : 'var(--rule)' }}
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full text-[11px] leading-none"
                          style={
                            filled
                              ? { background: 'var(--sage-soft)', color: 'var(--forest)' }
                              : missing
                                ? { background: 'var(--clay-wash)', color: 'var(--clay-deep)' }
                                : { background: 'var(--rule-soft)', color: 'var(--light)' }
                          }
                        >
                          {filled ? '✓' : missing ? '✕' : '·'}
                        </span>
                        <span className="font-body text-sm text-text">{k}</span>
                        <span
                          className={`ml-auto text-right font-body text-[13px] ${
                            missing ? 'text-clay-deep' : 'text-mid'
                          }`}
                        >
                          {filled ? v : missing ? 'Still needed' : 'Not stated'}
                        </span>
                      </li>
                    )
                  })}
              </ul>

              {/* The one thing on this screen that is not a summary. It is the
                  board's central safety rule and the last moment to explain it
                  before a host wonders why nobody can find them. */}
              <div className="trek-provisional p-4.5">
                <p className="trek-label text-forest">Held back on purpose</p>
                <p className="mt-2.5 font-body text-[13px] leading-relaxed text-mid">
                  The exact meeting point does not go on the public page. It reaches the people you
                  have confirmed, and only once {spec.minParty} are going — so a walk nobody joins
                  never hands out an address.
                </p>
              </div>

              {error && <p className="font-body text-sm text-clay-deep">{error}</p>}

              <button type="submit" disabled={pending || !canPost}
                className="trek-pill trek-pill-act trek-pill-lg w-full justify-center font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40">
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

      {/* The card they are building, live. */}
      <aside className="min-w-0 lg:sticky lg:top-[88px]">
        <p className="trek-label flex items-center gap-2 text-mid">
          {/* Sage, not dawn. The dot pulses because the card beside it really is
              re-rendering as you type; it is not a clock running out. */}
          <LiveDot size={6} color="var(--sage)" />
          Live preview — what the board sees
        </p>
        <div className="mt-3.5">
          <PreviewCard
            light={light}
            coverUrl={f.coverUrl}
            place={f.place}
            meetArea={f.meetArea}
            activityLabel={spec.isOpenEnded ? f.activityOther || 'Something else' : spec.label}
            startsOn={f.startsOn}
            endsOn={f.endsOn}
            startTime={f.timed ? f.startTime : null}
            backBy={f.backBy}
            capacity={f.capacity}
            difficulty={f.difficulty}
            womenOnly={f.womenOnly}
            seniorFriendly={f.seniorFriendly}
            distanceKm={f.distanceKm}
            gainM={f.gainM}
            costRupees={f.costRupees}
            hostName={hostName}
            hostId={userId}
          />
        </div>
        <p className="mt-3.5 font-body text-xs leading-relaxed text-mid">
          Change the hour and watch the card change colour — the board sorts a day by its light.
        </p>
        <p className="mt-2 font-body text-xs leading-relaxed text-mid">
          The exact meeting point is never on this card. It reaches people only once{' '}
          {spec.minParty} are going and you have confirmed them.
        </p>
      </aside>
    </form>
  )
}

/**
 * One kind of outing, as a tile.
 *
 * Selection is the product's large-choice idiom and nothing else: a 2px forest
 * edge and the sage wash. The border is 2px in both states so picking one does
 * not shift the grid by a pixel, which is the tell that gives away a
 * border-width toggle.
 *
 * It used to be a dawn edge over an 8%-dawn wash. Amber is a clock on this
 * board and choosing what you are doing on Sunday is not one; a made choice is
 * green wherever it appears here.
 */
function ActivityTile({
  kind,
  selected,
  onPick,
}: {
  kind: TrekKind
  selected: boolean
  onPick: () => void
}) {
  const l = lightForTime(kind.defaultStart)
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className="flex flex-col gap-1 rounded-[var(--r-card)] border-2 border-rule bg-surface p-4 text-left transition-all duration-200 hover:border-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
      style={selected ? { borderColor: 'var(--forest)', background: 'var(--sage-soft)' } : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-body text-[15px] font-medium leading-snug text-text">{kind.label}</span>
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: dotColor(l, 'light') }}
        />
      </span>
      <span className="font-body text-xs leading-snug text-mid">{kind.blurb}</span>
      <span className="mt-0.5 font-body text-xs text-mid">
        usually <span className="font-mono tabular-nums">{kind.defaultStart}</span>
      </span>
    </button>
  )
}

/**
 * The card the board would draw, from the form's own state.
 *
 * It is not a `<Link>`, and that is the only thing it does differently from
 * `TrekPlanCard`: a preview must not navigate to `/trek-buddy/preview`, which
 * is a walk that does not exist. Everything else — `Cover`, the torn calendar
 * corner, `HourPill`, `Countdown`, `SeatMeter`, `Avatar` and the three `Tag`s —
 * is the same part in the same place at the same size, and the type is the same
 * `trek-h3` / `trek-label-xs` / 13px body the real card uses.
 *
 * THE EARLIER VERSION HAND-DREW ALL OF IT so that every hour-coloured surface
 * could take a 400ms transition and visibly follow the time input. That was a
 * good lesson bought at a bad price: the preview drifted from the real card on
 * eight separate values — a 9px mono kicker against a `trek-label-xs` one, a
 * solid hour lozenge against a neutral chip with a dot, `text-xs` against 13px
 * — so the one thing the preview promises, that this is exactly what the board
 * will show, was quietly false. The hour still drives the card; it now does it
 * through the same components the board uses, and the honesty is worth more
 * than the four tenths of a second.
 */
function PreviewCard({
  light, coverUrl, place, meetArea, activityLabel, startsOn, endsOn, startTime, backBy,
  capacity, difficulty, womenOnly, seniorFriendly, distanceKm, gainM, costRupees,
  hostName, hostId,
}: {
  light: ReturnType<typeof lightForTime>
  coverUrl: string | null
  place: string
  meetArea: string
  activityLabel: string
  startsOn: string
  endsOn: string
  startTime: string | null
  backBy: string
  capacity: number
  difficulty: string
  womenOnly: boolean
  seniorFriendly: boolean
  distanceKm: string
  gainM: string
  costRupees: string
  hostName: string
  hostId: string
}) {
  const km = distanceKm.trim() === '' ? null : Number(distanceKm)
  const up = gainM.trim() === '' ? null : Number(gainM)
  const paise = costRupees.trim() === '' ? null : Math.round(Number(costRupees) * 100)
  const previewCost = costLabel(paise)

  // A date input can be cleared, and `new Date('T06:00+05:30').toISOString()`
  // throws — which took the whole composer down mid-edit. Everything derived
  // from the date is computed once, defensively, and the countdown simply does
  // not render while there is no day to count to.
  const dayDate = startsOn ? new Date(`${startsOn}T00:00:00`) : null
  const valid = dayDate !== null && !Number.isNaN(dayDate.getTime())
  const weekday = valid ? dayDate.toLocaleDateString('en-IN', { weekday: 'short' }) : '—'
  const dayNum = valid ? dayDate.toLocaleDateString('en-IN', { day: '2-digit' }) : '··'
  const monthName = valid ? dayDate.toLocaleDateString('en-IN', { month: 'short' }) : ''
  const departure = valid
    ? new Date(`${startsOn}T${startTime ?? '06:00'}:00+05:30`)
    : null
  const departureIso =
    departure && !Number.isNaN(departure.getTime()) ? departure.toISOString() : null

  const nights = valid && endsOn
    ? Math.max(0, Math.round((new Date(endsOn).getTime() - new Date(startsOn).getTime()) / 86400000))
    : 0

  return (
    <div className="trek-card flex flex-col">
      <Cover
        src={coverUrl}
        light={light}
        place={place}
        distanceKm={km}
        gainM={up}
        sizes="380px"
        className="aspect-[16/10] w-full"
      >
        {/* The date, torn off a calendar. */}
        <span className="absolute left-3 top-3 flex flex-col items-center rounded-[var(--r-input)] bg-paper/95 px-2.5 py-1.5 leading-none">
          <span className="trek-label-xs text-mid">{weekday}</span>
          <span className="mt-1 font-display text-[19px] font-medium text-text tabular-nums">
            {dayNum}
          </span>
          {monthName && <span className="mt-1 trek-label-xs text-mid">{monthName}</span>}
        </span>

        {/* The hour, in its own colour — the surface the whole screen is about. */}
        {startTime ? (
          <HourPill time={startTime} light={light} className="absolute right-3 top-3" />
        ) : (
          <span className="trek-glass-sm absolute right-3 top-3 rounded-full px-2.5 py-1.5 font-mono text-[11px] font-medium leading-none text-paper tabular-nums">
            {nights + 1} days
          </span>
        )}

        {departureIso && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
            <Countdown
              iso={departureIso}
              prefix="Leaves in"
              className="trek-glass-sm rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-paper tabular-nums"
            />
          </div>
        )}
      </Cover>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3.5">
        <div className="min-w-0">
          <p className="trek-label-xs" style={{ color: hourInk(light, 'light') }}>
            {activityLabel} · {startTime ? light.label : 'On the hill'}
          </p>
          <h3 className="trek-h3 mt-2 text-text">{place || 'Where are you going?'}</h3>
          <p className="mt-1.5 truncate font-body text-[13px] text-mid">
            From {meetArea || '…'}
            {nights > 0 ? ` · ${nights + 1} days` : backBy ? ` · back ${backBy}` : ''}
            {km ? ` · ${km} km` : ''}
            {up ? ` · ${up} m up` : ''}
          </p>
        </div>

        <SeatMeter taken={1} capacity={capacity} light={light} captionClassName="text-mid" />

        {/* The same two rows as the real card, in the same order, for the same
            reason — this preview only does its job if it is what the board will
            actually draw. A host ticking "senior friendly" on a women-only walk
            needs to see the tag appear here, because seeing it is what tells
            them the board will say it. Cost sits on the numbers line above,
            where the real card puts it. */}
        <div className="mt-auto flex flex-col gap-2.5 border-t border-rule-soft pt-3">
          <span className="flex h-[22px] shrink-0 flex-nowrap items-center gap-1.5 overflow-hidden">
            <Tag tone="outline">{DIFFICULTY_LABEL[difficulty] ?? difficulty}</Tag>
            {womenOnly && <Tag tone="clay">Women only</Tag>}
            {seniorFriendly && <Tag tone="sage">Senior friendly</Tag>}
            {previewCost.stated && (
              <Tag tone={previewCost.isFigure ? 'outline' : 'sage'}>{previewCost.short}</Tag>
            )}
          </span>

          <span className="flex items-center gap-2">
            <Avatar name={hostName} id={hostId} size={24} />
            <span className="min-w-0 flex-1 truncate font-body text-[13px] text-mid">{hostName}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
