'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { saveTrekPerson, vouchFor, type PersonCard, type TrekKind } from '@/actions/trekBuddy'
import PersonCardTile, { EXPERIENCE_LABEL } from '@/components/trek/PersonCardTile'
import Avatar from '@/components/trek/ui/Avatar'
import { Datum, Eyebrow, MoreLink, SectionLabel, Tag } from '@/components/trek/ui/Bits'

const TOWNS = ['Dehradun', 'Mussoorie', 'Rishikesh', 'Haridwar', 'Sahastradhara', 'Chakrata', 'Elsewhere']
const PACES = [
  ['steady', 'Steady', 'Stops often, no rush'],
  ['brisk', 'Brisk', 'Keeps moving'],
  ['fast', 'Fast', 'Expects a pace'],
] as const
const LANGUAGES = ['Hindi', 'English', 'Garhwali', 'Punjabi', 'Bengali']
const EXPERIENCE = [
  ['new', 'New to this', 'First few times out'],
  ['some', 'Been out a few times', 'Comfortable on a day walk'],
  ['seasoned', 'Seasoned', 'Multi-day, most seasons'],
  ['veteran', 'Years of it', 'Been doing this a long time'],
] as const
const DAYS = ['Weekends', 'Weekdays', 'Either']
const CARRIES = [
  'First aid kit', 'Head torch', 'Extra water', 'Extra layer', 'Power bank',
  'Offline map', 'Whistle', 'Rope', 'Stove', 'Tent',
]

type Vouchable = {
  planId: string
  place: string
  when: string
  people: { user_id: string; display_name: string; vouched: boolean }[]
}

// A field key, and only a field key. It was `trek-label font-mono`, which put
// every legend on the longest form on the board into a typeface now reserved
// for figures — "What you carry" is not a reading.
const label = 'trek-label text-mid'
const field =
  'mt-2 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-2.5 font-body text-text placeholder:text-mid/50 focus:border-forest focus:outline-none'
const railCard = 'rounded-[var(--r-panel)] border border-rule bg-surface p-6'

// One selection idiom for the whole form.
//
// Nine groups of choices used to be drawn three different ways — pill chips for
// activities, 6px wash tiles for pace and experience, and a third treatment for
// the vouch buttons — so nothing on the page said "selected" the same way
// twice. Solid forest when on, a 1px rule when off, everywhere. Colour is never
// the only signal: every one of these carries aria-pressed.
//
// They are the product's own pills now rather than a local copy of them —
// `trek-pill-act` and `trek-pill-quiet` at the small size — so a chip on this
// form, a filter chip in the directory and a button on a walk are one control
// with one hover, one padding and one radius. The focus ring moves to sage with
// the rest of the board.
const chip = (on: boolean) =>
  `trek-pill trek-pill-sm font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
    on ? 'trek-pill-act' : 'trek-pill-quiet'
  }`

// The same idiom at tile size, for the two groups whose options carry a line of
// explanation. Pace and experience cannot collapse to a bare chip — "Brisk" on
// its own is exactly the ambiguity "Keeps moving" exists to remove — so the
// fill is the chip's, and only the geometry is bigger.
const tile = (on: boolean) =>
  `rounded-[var(--r-input)] border px-3.5 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
    on ? 'border-forest bg-forest' : 'border-rule bg-surface hover:border-text'
  }`

/** "Priya and Rohan" · "Priya, Rohan and Asha" — a sentence, not a join(', '). */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
  })

// Managing how people see you.
//
// Every control here is a choice about what a stranger learns before deciding
// whether to walk with you, so the page says what each one is for rather than
// just labelling the field. The counted facts are shown but not editable —
// experience on this board is derived from what happened, and a profile that
// lets you type "experienced" is a profile that means nothing.
//
// The screen is two bands on one measure. It used to change measure mid-scroll
// (max-w-2xl for the counted half, then max-w-5xl for the form), so the two
// halves of the same page did not share a left edge.
//
//   INK · who this is for, and the live preview of what they will read.
//   PAPER · the counted half, then the fields, with the rail beside them.
export default function ProfileForm({
  person,
  vouchable,
  kinds,
  counted,
}: {
  person: PersonCard
  vouchable: Vouchable[]
  /** From the kinds table (057), not a frozen list — an activity an admin adds
      has to be selectable here too, or profiles cannot describe the board. */
  kinds: TrekKind[]
  /** `Evidence` and `TrustCard`, rendered on the server and slotted in, so the
      part of this page that cannot be edited is not shipped as client code. */
  counted: ReactNode
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  const [fading, setFading] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    displayName: person.displayName,
    homeBase: person.homeBase ?? '',
    intro: person.intro ?? '',
    pace: person.pace ?? '',
    activities: person.activities,
    languages: person.languages,
    experience: person.experience ?? '',
    yearsOut: person.yearsOut,
    highestM: person.highestM,
    usualDays: person.usualDays,
    carries: person.carries,
  })
  // Functional updates, not { ...f, ...p }.
  //
  // Every chip on this page is a separate click, and two clicks in the same
  // tick both read the same captured `f` — so picking a town and then an
  // activity silently threw the town away. Caught by filling the form in a
  // test and finding three fields missing from the row afterwards.
  const set = (p: Partial<typeof f>) => { setF((prev) => ({ ...prev, ...p })); setSaved(false) }
  const toggle = (key: 'activities' | 'languages' | 'usualDays' | 'carries', v: string) => {
    setF((prev) => ({
      ...prev,
      [key]: prev[key].includes(v) ? prev[key].filter((x) => x !== v) : [...prev[key], v],
    }))
    setSaved(false)
  }

  // The confirmation arrives and then leaves.
  //
  // It used to be the bare word "Saved." sitting next to a button you can press
  // again, which after the second save tells you nothing — you cannot tell
  // whether it refers to this press or the last one. Entry is `tb-rise`; the
  // exit is a plain opacity transition, so nothing outside the motion budget is
  // involved. The classes swap rather than stack because an animation with
  // fill-mode `both` outranks a utility class and would pin the opacity at 1.
  useEffect(() => {
    if (!saved) return
    const out = window.setTimeout(() => setFading(true), 3200)
    const gone = window.setTimeout(() => { setSaved(false); setFading(false) }, 3700)
    return () => { window.clearTimeout(out); window.clearTimeout(gone) }
  }, [saved])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await saveTrekPerson(f)
      if ('error' in r) { setError(r.error ?? 'Could not save'); return }
      setFading(false)
      setSaved(true)
      router.refresh()
    })
  }

  // Which field the refusal belongs under.
  //
  // Two of the three things that can go wrong are constraints in Postgres —
  // `no_contact` and `intro_len` — and the action turns both into a sentence
  // about the intro. Rendering every error in one place at the bottom of the
  // form meant the board's best rule ("take the phone number out of your
  // intro") appeared several hundred pixels away from the intro. The message
  // itself is never touched; only where it lands is decided here, and anything
  // unrecognised still falls through to the action row so no error can vanish.
  const errorField =
    !error ? null
      : /intro|contact detail|phone number/i.test(error) ? 'intro'
      : /\bname\b/i.test(error) ? 'displayName'
      : null

  // What a stranger would see, built from the form's own state rather than
  // from the saved row — so the preview answers the question you actually have
  // while editing ("what does this look like to them?") instead of the one you
  // do not ("what did it look like before I started?").
  const preview = {
    userId: person.userId,
    displayName: f.displayName || 'Your name',
    homeBase: f.homeBase || null,
    intro: f.intro || null,
    pace: f.pace || null,
    activities: f.activities,
    languages: f.languages,
    experience: f.experience || null,
    yearsOut: f.yearsOut,
    mentor: person.mentor,
    canHost: person.canHost,
    memberSince: person.memberSince,
    walksHosted: person.walksHosted,
    walksJoined: person.walksJoined,
    vouches: person.vouches,
  }

  const been = person.walksHosted + person.walksJoined
  const kindLabel = (k: string) => kinds.find((x) => x.key === k)?.label ?? k.replace(/_/g, ' ')
  const paceLabel = PACES.find(([k]) => k === f.pace)?.[1] ?? null

  // The completeness meter, counted off the form instead of off the row.
  //
  // The same seven checks, in the same order and with the same prompts, as
  // `getMyTrekCard` — which reads the saved profile and so cannot move until
  // you press the button. Here it has to answer while you type, which is the
  // only version of this that changes anyone's behaviour. If that list is ever
  // reordered in the action, reorder it here too: two meters that disagree
  // about what a finished profile is would be worse than one.
  const checks: { field: string; filled: boolean; prompt: string }[] = [
    { field: 'Activities', filled: f.activities.length > 0,
      prompt: 'Say what you actually go out for' },
    { field: 'Home base', filled: Boolean(f.homeBase),
      prompt: 'Add the town you set off from' },
    { field: 'Pace', filled: Boolean(f.pace),
      prompt: 'Say how fast you walk — somebody will plan their day around it' },
    { field: 'Intro', filled: Boolean(f.intro.trim()),
      prompt: 'Write a line about yourself' },
    { field: 'Experience', filled: Boolean(f.experience),
      prompt: 'Say how much of this you have done' },
    { field: 'Kit', filled: f.carries.length > 0,
      prompt: 'List what you carry — the most useful thing on a profile' },
    { field: 'Languages', filled: f.languages.length > 0,
      prompt: 'Add the languages you speak' },
  ]
  const done = checks.filter((c) => c.filled).length
  const nextUp = checks.find((c) => !c.filled) ?? null

  // The vouches you owe, counted across every past walk at once — the number is
  // the headline, so it has to be one number and not a list you total yourself.
  const owed = vouchable.reduce((n, w) => n + w.people.filter((p) => !p.vouched).length, 0)

  return (
    <>
      {/* ── Band one · you, as they meet you ─────────────────────────────── */}
      <section className="trek-band bg-ink pb-11 pt-28 md:pt-32">
        <div className="trek-measure grid grid-cols-1 items-end gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="min-w-0">
            <Eyebrow tone="ondark">Your profile</Eyebrow>
            {/* The headline was Newsreader at 300 with "you." set in amber and
                italic. Amber is the one colour on this board that means a clock
                is running, and nothing on a settings screen is running; the
                hairline weight is a fashion masthead. Both are gone and the
                sentence is untouched. */}
            <h1 className="trek-h1 mt-3.5 text-paper">How people see you.</h1>
            <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-paper/70">
              Somebody reads this before deciding whether to spend a day in the hills with
              you. Everything on it is a choice about what they learn first.
            </p>
          </div>

          {/* The preview, on the band rather than buried beside field nine.
              This is the shape of the header a stranger actually lands on —
              same avatar, same order, same three counted figures — built from
              what is in the form right now. A profile editor that never shows
              you the thing you are editing is asking you to hold the result in
              your head, and nobody does. */}
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel tone="ondark">How a stranger meets you</SectionLabel>
              <span className="font-body text-[12px] text-paper/55">Updates as you type</span>
            </div>

            <div className="mt-3 rounded-[var(--r-panel)] border border-paper/12 bg-paper/[0.04] p-5">
              <div className="flex items-center gap-4">
                <Avatar
                  name={preview.displayName}
                  id={person.userId}
                  size={64}
                  ground="dark"
                  role={person.mentor ? 'mentor' : 'none'}
                />
                <div className="min-w-0">
                  {person.mentor && (
                    <p className="mb-1.5 font-body text-[12px] font-medium leading-none text-[#C09A85]">
                      Mentor · appointed, never claimed
                    </p>
                  )}
                  <p className="trek-h3 truncate text-paper">{preview.displayName}</p>
                  <p className="mt-1 font-body text-xs text-paper/55">
                    {f.homeBase || 'No town yet'}
                    {paceLabel ? ` · ${paceLabel} pace` : ''}
                    {f.experience ? ` · ${EXPERIENCE_LABEL[f.experience] ?? f.experience}` : ''}
                  </p>
                </div>
              </div>

              {/* Curly quotes, because a person wrote this. The dashed line is
                  the one state this preview must not skip: an empty intro is
                  what most of the board looks like, and hiding it here would
                  make the page pretend the field is optional. */}
              {f.intro ? (
                <p className="mt-4 font-display text-base font-normal leading-relaxed text-paper/85">
                  &ldquo;{f.intro}&rdquo;
                </p>
              ) : (
                <p className="mt-4 rounded-[var(--r-input)] border border-dashed border-paper/25 px-3 py-2 font-body text-xs text-paper/55">
                  Nothing written yet — they read this line first.
                </p>
              )}

              {f.activities.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {f.activities.slice(0, 5).map((a) => (
                    <li key={a}>
                      <Tag tone="ondark">{kindLabel(a)}</Tag>
                    </li>
                  ))}
                  {f.activities.length > 5 && (
                    <li className="self-center font-mono text-[10px] text-paper/55 tabular-nums">
                      +{f.activities.length - 5}
                    </li>
                  )}
                </ul>
              )}

              <div className="mt-5 flex flex-wrap gap-x-9 gap-y-3 border-t border-paper/12 pt-4">
                <Datum k={been === 1 ? 'walk' : 'walks'} v={been} tone="dark" size="sm" />
                <Datum k="hosted" v={person.walksHosted} tone="dark" size="sm" />
                <Datum k="vouched" v={person.vouches} tone="dark" size="sm" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Band two · the counted half, the fields, and the rail ─────────── */}
      <section className="trek-band bg-paper pb-24 pt-11">
        <div className="trek-measure grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="min-w-0 space-y-11">
            {counted}

            <form onSubmit={submit} className="space-y-11">
              {/* ── Who you are ─────────────────────────────────────────── */}
              <div className="space-y-8">
                <h2 className="trek-h3 text-text">Who you are</h2>

                <div>
                  <label className="block">
                    <span className={label}>Name people see</span>
                    <input
                      value={f.displayName} onChange={(e) => set({ displayName: e.target.value })}
                      required minLength={2} maxLength={40} autoComplete="nickname"
                      aria-invalid={errorField === 'displayName'}
                      aria-describedby={errorField === 'displayName' ? 'profile-name-error' : undefined}
                      className={`${field} text-base`}
                    />
                  </label>
                  <p className="mt-1.5 font-body text-xs text-mid">
                    Not your delivery name. A first name is plenty.
                  </p>
                  {errorField === 'displayName' && (
                    <p id="profile-name-error" className="mt-1.5 font-body text-sm text-clay-deep">
                      {error}
                    </p>
                  )}
                </div>

                <fieldset className="min-w-0">
                  <legend className={label}>Where you set off from</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TOWNS.map((t) => (
                      <button key={t} type="button" onClick={() => set({ homeBase: f.homeBase === t ? '' : t })}
                        aria-pressed={f.homeBase === t} className={chip(f.homeBase === t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 font-body text-xs text-mid">
                    A town, never an address. It helps people find others leaving from the same place.
                  </p>
                </fieldset>

                <div>
                  <label className="block">
                    <span className={label}>A line about you</span>
                    <textarea
                      value={f.intro} onChange={(e) => set({ intro: e.target.value })}
                      rows={3} maxLength={280}
                      placeholder="Slow walker, happiest above the treeline. Usually out on Sundays."
                      aria-invalid={errorField === 'intro'}
                      aria-describedby={errorField === 'intro' ? 'profile-intro-error' : undefined}
                      className={`${field} text-sm`}
                    />
                  </label>
                  <div className="mt-1.5 flex justify-between gap-4">
                    <p className="font-body text-xs text-mid">
                      No phone numbers, emails or handles — the board refuses them, and that is the
                      point of it.
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-mid tabular-nums">
                      {f.intro.length}/280
                    </span>
                  </div>
                  {/* The refusal, under the field it is about. The database
                      writes this sentence, not the form — the constraint is the
                      rule, and paraphrasing it here would let the two drift. */}
                  {errorField === 'intro' && (
                    <p id="profile-intro-error" className="mt-1.5 font-body text-sm text-clay-deep">
                      {error}
                    </p>
                  )}
                </div>
              </div>

              {/* ── How you walk ────────────────────────────────────────── */}
              <div className="space-y-8 border-t border-rule pt-9">
                <h2 className="trek-h3 text-text">How you walk</h2>

                <fieldset className="min-w-0">
                  <legend className={label}>What you go out for</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {kinds.filter((a) => !a.isOpenEnded).map((a) => (
                      <button key={a.key} type="button" onClick={() => toggle('activities', a.key)}
                        aria-pressed={f.activities.includes(a.key)} className={chip(f.activities.includes(a.key))}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className={label}>Your pace</legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {PACES.map(([k, t, d]) => (
                      <button key={k} type="button" onClick={() => set({ pace: f.pace === k ? '' : k })}
                        aria-pressed={f.pace === k} className={tile(f.pace === k)}>
                        <span className={`block font-body text-sm ${f.pace === k ? 'text-paper' : 'text-text'}`}>{t}</span>
                        <span className={`block font-body text-xs ${f.pace === k ? 'text-paper/70' : 'text-mid'}`}>{d}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 font-body text-xs text-mid">
                    Be honest. Somebody is going to plan their day around this.
                  </p>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className={label}>Speaks</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button key={l} type="button" onClick={() => toggle('languages', l)}
                        aria-pressed={f.languages.includes(l)} className={chip(f.languages.includes(l))}>
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className={label}>When you usually go</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button key={d} type="button" onClick={() => toggle('usualDays', d)}
                        aria-pressed={f.usualDays.includes(d)} className={chip(f.usualDays.includes(d))}>
                        {d}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              {/* ── What you bring to a day ─────────────────────────────────
                  The self-declared half.
                  Everything below is a claim, and the profile page says so where
                  it shows it — it sits next to four counted facts the board can
                  actually prove, and blurring that line would make the proven
                  ones worthless. Nobody is asked to justify any of it. */}
              <div className="space-y-8 border-t border-rule pt-9">
                <h2 className="trek-h3 text-text">What you bring to a day</h2>

                <fieldset className="min-w-0">
                  <legend className={label}>How much you have done</legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EXPERIENCE.map(([k, t, d]) => (
                      <button key={k} type="button"
                        onClick={() => set({ experience: f.experience === k ? '' : k })}
                        aria-pressed={f.experience === k} className={tile(f.experience === k)}>
                        <span className={`block font-body text-sm ${f.experience === k ? 'text-paper' : 'text-text'}`}>{t}</span>
                        <span className={`block font-body text-xs ${f.experience === k ? 'text-paper/70' : 'text-mid'}`}>{d}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className={label}>Years going out</span>
                    <input type="number" min={0} max={60} value={f.yearsOut ?? ''}
                      onChange={(e) => set({ yearsOut: e.target.value === '' ? null : Number(e.target.value) })}
                      className={`${field} font-mono text-base tabular-nums`} />
                  </label>
                  <label className="block">
                    <span className={label}>Highest you have been (m)</span>
                    <input type="number" min={0} max={8849} value={f.highestM ?? ''}
                      onChange={(e) => set({ highestM: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="3022"
                      className={`${field} font-mono text-base tabular-nums`} />
                    <span className="mt-1.5 block font-body text-xs text-mid">
                      Nobody checks this. It is here because it tells another walker more than
                      &ldquo;experienced&rdquo; does.
                    </span>
                  </label>
                </div>

                <fieldset className="min-w-0">
                  <legend className={label}>What you carry</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CARRIES.map((c) => (
                      <button key={c} type="button" onClick={() => toggle('carries', c)}
                        aria-pressed={f.carries.includes(c)} className={chip(f.carries.includes(c))}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 font-body text-xs text-mid">
                    The most useful thing on a profile, and the one people skip. Somebody deciding
                    whether to join a long day wants to know who has the first aid kit.
                  </p>
                </fieldset>
              </div>

              {/* Anything the action returned that does not belong to a field —
                  a raw Postgres message, say — still has to land somewhere. */}
              {error && errorField === null && (
                <p className="font-body text-sm text-clay-deep">{error}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-9">
                <button type="submit" disabled={pending}
                  className="trek-pill trek-pill-act font-body disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save profile'}
                </button>

                {/* Sage, because on this board sage is the colour of a thing
                    that is now true — a confirmed walk, a vouch, a completed
                    day. A save is the same species of event, and it used to be
                    announced in the same forest green as the button that had
                    just been pressed. */}
                {saved && (
                  <p
                    role="status"
                    className={`inline-flex items-center gap-2 rounded-full bg-sage-soft px-3.5 py-1.5 font-body text-[13px] text-forest ${
                      fading ? 'opacity-0 transition-opacity duration-[400ms]' : 'tb-rise opacity-100'
                    }`}
                  >
                    <span aria-hidden="true">✓</span>
                    Saved. Anyone opening your page sees this now.
                  </p>
                )}

                <MoreLink href={`/trek-buddy/people/${person.userId}`} className="ml-auto">
                  See how you look
                </MoreLink>
              </div>
            </form>
          </div>

          {/* ── The rail ───────────────────────────────────────────────────
              What you owe, what you look like, and what is still missing —
              parked beside the fields rather than stacked under them, because
              all three are answers to questions you have *while* editing. */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-[88px] lg:self-start">
            {/* Vouching, moved out of the foot of the form.
                It is the strongest thing anyone can put on another person's
                profile and it was the last thing on the longest page on the
                board — under nine field groups, where it was reached by nobody.
                It is a debt, so it goes where debts go: the top. */}
            {owed > 0 ? (
              <div className="rounded-[var(--r-panel)] border border-forest/25 bg-sage-soft p-6">
                {/* The debt as an instrument reading rather than as a sentence
                    with a number inside it. It is the one figure on this screen
                    that asks somebody to go and do something. */}
                <Datum k={owed === 1 ? 'vouch to write' : 'vouches to write'} v={owed} />
                <p className="mt-4 font-body text-sm leading-relaxed text-text">
                  Say so while it is fresh.
                </p>

                {/* Only the walks that still owe somebody. A walk you have
                    finished vouching for drops off the card entirely — this is
                    a list of debts, and a debt you have settled is not a
                    smaller debt. */}
                <div className="mt-4 space-y-4">
                  {vouchable.filter((w) => w.people.some((p) => !p.vouched)).map((w) => {
                    const owedNames = w.people.filter((p) => !p.vouched).map((p) => p.display_name)
                    return (
                      <div key={w.planId}>
                        <p className="font-body text-sm text-mid">
                          You finished <span className="text-text">{w.place}</span> with{' '}
                          {joinNames(owedNames)}.{' '}
                          <span className="font-mono text-[11px] tabular-nums">
                            · {shortDate(w.when)}
                          </span>
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {w.people.map((p) => (
                            <li key={p.user_id}>
                              {/* Written and not written, in the same two
                                  states the rest of the form uses: the act is
                                  the forest pill, the thing already done is a
                                  sage line you cannot press. */}
                              {p.vouched ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-forest/40 bg-surface px-3.5 py-[7px] font-body text-xs text-forest">
                                  <span aria-hidden="true">✓</span>
                                  {p.display_name} · vouched
                                </span>
                              ) : (
                                <button type="button" disabled={pending}
                                  onClick={() => start(async () => { await vouchFor(w.planId, p.user_id); router.refresh() })}
                                  className="trek-pill trek-pill-sm trek-pill-act font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-40">
                                  Vouch for {p.display_name}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>

                <p className="mt-4 border-t border-forest/20 pt-3.5 font-body text-xs leading-relaxed text-mid">
                  Only you can say this, and only about someone who was actually out with you. It is
                  the strongest thing on their profile, so mean it.
                </p>
              </div>
            ) : (
              /* Nothing owed is still a state worth drawing: it is where the
                 rule lives, and a card that only exists when you are in debt
                 never gets to explain how the debt is incurred. */
              <div className={railCard}>
                <SectionLabel tone="trust">Vouches to write</SectionLabel>
                <p className="mt-3 font-body text-sm leading-relaxed text-mid">
                  {vouchable.length > 0
                    ? 'Nothing owed — you have vouched for everyone you have been out with.'
                    : 'Nothing yet. After a walk you were confirmed on, everyone who was there appears here for you to vouch for.'}
                </p>
              </div>
            )}

            {/* The other half of the reason this is one page: the public view
                lived at a different URL, so seeing the effect of an edit meant
                saving, navigating away, and navigating back. */}
            <div>
              <SectionLabel>How you look on the board</SectionLabel>
              <div className="mt-3">
                <PersonCardTile person={preview} />
              </div>
              <p className="mt-3 font-body text-xs leading-relaxed text-mid">
                This updates as you type. Nothing is saved until you press the button.
              </p>
            </div>

            <div className={railCard}>
              {/* The meter counts the seven things another walker actually
                  reads, and names the next missing one — a prompt, not a
                  score. Segments rather than a bar, because seven discrete
                  things you can go and do reads as a checklist and a smooth
                  percentage reads as a game. */}
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel>Your profile</SectionLabel>
                <span className="font-mono text-[10px] text-mid tabular-nums">
                  {done}/{checks.length}
                </span>
              </div>

              <div
                className="mt-3 flex gap-1"
                role="img"
                aria-label={`${done} of ${checks.length} fields a walker reads are filled in`}
              >
                {checks.map((c) => (
                  <span
                    key={c.field}
                    aria-hidden="true"
                    className={`h-[4px] flex-1 rounded-full transition-colors duration-[400ms] ${
                      c.filled ? 'bg-sage' : 'bg-rule-soft'
                    }`}
                  />
                ))}
              </div>

              <p className="mt-3 font-body text-xs leading-relaxed text-mid">
                {nextUp ? (
                  <><span className="text-forest">Next:</span> {nextUp.prompt}.</>
                ) : (
                  <>Nothing missing. This is what a stranger sees before asking to walk with you.</>
                )}
              </p>

              {/* What you have claimed, on the warm ground this product uses
                  for a claim — the same tint your card and your public page
                  put these six lines on. It is worth being reminded, on the
                  screen where you type them, that none of them is checked. */}
              <div className="mt-5 border-t border-rule-soft pt-4">
                <SectionLabel>On your profile</SectionLabel>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-mid">
                  Typed by you. Nobody checks any of it.
                </p>
                <dl className="mt-3 space-y-2 rounded-[var(--r-input)] border border-rule-warm bg-paper-warm px-3.5 py-3">
                  {[
                    ['Experience', f.experience ? EXPERIENCE_LABEL[f.experience] ?? f.experience : null],
                    ['Going out for', f.yearsOut != null ? `${f.yearsOut} year${f.yearsOut === 1 ? '' : 's'}` : null],
                    ['Highest been', f.highestM != null ? `${f.highestM.toLocaleString('en-IN')} m` : null],
                    ['Usually goes', f.usualDays.length ? f.usualDays.join(', ') : null],
                    ['Carries', f.carries.length ? f.carries.join(', ') : null],
                    ['Speaks', f.languages.length ? f.languages.join(', ') : null],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex gap-3">
                      <dt className="trek-label-xs w-24 shrink-0 pt-[3px] text-mid">{k}</dt>
                      <dd className={`font-body text-xs ${v ? 'text-text' : 'text-mid/45'}`}>
                        {(v as string) ?? 'Not said'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <MoreLink href={`/trek-buddy/people/${person.userId}`} className="mt-5 inline-block">
                Open the real page
              </MoreLink>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
