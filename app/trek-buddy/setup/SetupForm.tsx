'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveTrekPerson, saveTrekProfile, type TrekKind } from '@/actions/trekBuddy'
import SafetyNotes from '@/components/trek/SafetyNotes'
import { dotColor, lightForTime } from '@/lib/trek'

/** The towns the profile editor offers, so the two agree on the same values. */
const TOWNS = ['Dehradun', 'Mussoorie', 'Rishikesh', 'Haridwar', 'Sahastradhara', 'Chakrata', 'Elsewhere']

/**
 * The deal, as the four separate things it always was.
 *
 * This is the existing consent sentence, unedited and unabridged — every clause
 * of it is below, in its original words and its original order. What changed is
 * that it stopped being one 58-word paragraph beside a tick-box, which is the
 * shape of a cookie banner and gets read like one. Four numbered rows is the
 * shape of an agreement, and it is the only honest way to draw a thing whose
 * whole point is that somebody actually reads it.
 */
const DEAL: { t: string; d: string }[] = [
  {
    t: 'DEWDROPZ does not organise, lead, vet or supervise these walks',
    d: 'And it does not check who anyone is.',
  },
  {
    t: 'I am meeting strangers outdoors at my own risk',
    d: 'Nobody is watching a screen while you are out. In an emergency, call 112.',
  },
  {
    t: 'I will tell someone not on the walk where I am going',
    d: 'The place, the start time and when you expect to be back. It costs one message.',
  },
  {
    t: 'I will not post anything I would not want a stranger to know',
    d: 'Everything you write here is read by people you have not met yet.',
  },
]

/**
 * The three steps, in sentence case.
 *
 * They used to carry their own index inside the string — '01 · Who shows up' —
 * and were set in 10px monospace capitals at 0.26em, which is a machine readout
 * standing in for a wayfinder. The number is a figure and stays monospace; the
 * name is words and is set as words.
 */
const STEP_LABELS = ['Who shows up', 'What you chase', 'The deal'] as const

// Sage, not dawn, everywhere a state is shown on this card. Amber on this board
// means a clock is running — an onboarding form has no clock — and sage is the
// accent that reads on an ink ground.
const labelOnInk = 'trek-label text-paper/55'
const fieldOnInk =
  'mt-2 w-full rounded-[var(--r-input)] border border-paper/25 bg-paper/[0.06] px-4 py-3.5 font-body text-[15px] text-paper placeholder:text-paper/35 focus:border-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/40'
/**
 * The one act on each step.
 *
 * It was a full-width amber pill with 0.12em tracking. On an ink band the
 * board's primary is the inverted pill — paper fill, ink type — because forest
 * on near-black is a button nobody can find. Sentence case, because you press
 * it.
 */
const act =
  'trek-pill trek-pill-actinv trek-pill-lg mt-8 w-full justify-center font-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-50'

// The three questions, on the threshold.
//
// It was one column of three fields — a name, a date, and a tick-box under six
// lines of safety notes — which asked a person to read the whole contract before
// they had told the board anything about themselves. That order is backwards:
// the agreement is the last thing you sign, not the first thing you meet.
//
// So: who you are, what you go out for, and then what you are agreeing to. The
// rail above the card is clickable both ways, because somebody who wants to
// change the name they picked should not have to start again.
//
// ONE SUBMIT, AND THE GATE IS UNCHANGED. `saveTrekProfile` is called with
// exactly the payload it was called with before — the name, the date of birth
// and the acknowledgement — and every one of its refusals still reaches the
// screen in its own words. The home base and the activities are written
// afterwards, through the profile action that already owns those two columns,
// and only when the person actually answered them: a board that asks what you
// chase and then throws the answer away is worse than a board that never asked.
export default function SetupForm({
  suggestedName,
  kinds,
}: {
  suggestedName: string
  /** What the board is taking, so the tiles here match the composer's. */
  kinds: TrekKind[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState(suggestedName)
  const [dob, setDob] = useState('')
  const [homeBase, setHomeBase] = useState('')
  const [activities, setActivities] = useState<string[]>([])
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState('')

  const toggleActivity = (key: string) =>
    setActivities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  // Both live on step one, so an error about either is unreachable from where
  // it is shown. The way back is offered rather than forced.
  const missingIdentity = !displayName.trim() || !dob

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await saveTrekProfile({ displayName, dob, acceptTerms: accept })
      if ('error' in r) { setError(r.error ?? 'Could not save'); return }

      // Only if there is something to write. With both left blank this is the
      // same single round trip onboarding always was.
      if (homeBase || activities.length) {
        const p = await saveTrekPerson({ displayName, homeBase, activities, languages: [] })
        // Not swallowed, and not navigated past: the membership is already
        // saved, so pressing the button again simply re-runs both — the first
        // is idempotent and the second is the one that failed.
        if ('error' in p) { setError(p.error ?? 'Could not save'); return }
      }

      router.replace('/trek-buddy')
    })
  }

  return (
    <form onSubmit={submit}>
      {/* Where you are, and the way back.
          It was three lamps — a 24px amber bar for the current step and two 6px
          dots — with the step names hidden in aria-labels. A person mid-way
          through giving a board their date of birth should be able to see what
          the three questions are without a screen reader, so the rail states
          them, in sentence case, on one ruled line. The done step is sage
          because it is finished, not because it is urgent. */}
      <ol className="flex flex-wrap gap-x-7 gap-y-2.5 border-b border-paper/15 pb-4">
        {STEP_LABELS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex items-baseline gap-2 whitespace-nowrap font-body text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage ${
                i === step
                  ? 'font-medium text-paper'
                  : i < step
                    ? 'text-sage hover:text-paper'
                    : 'text-paper/40 hover:text-paper/70'
              }`}
            >
              <span className="font-mono text-xs tabular-nums">{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div
        className="mt-7 rounded-[var(--r-shell)] border border-paper/12 bg-ink-raised p-6 md:p-10"
        style={{ boxShadow: 'var(--shadow-panel)' }}
      >
        {/* ── 01 · Who shows up ─────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 className="trek-h2 text-paper">
              A name for the trail,
              <br />
              and where you start from.
            </h1>

            <label className="mt-7 block">
              <span className={labelOnInk}>Name other walkers see</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={2}
                maxLength={40}
                autoComplete="nickname"
                placeholder="A first name is plenty"
                className={`${fieldOnInk} font-display text-xl`}
              />
              <span className="mt-2 block font-body text-xs leading-relaxed text-paper/55">
                Not your delivery name. A first name is plenty.
              </span>
            </label>

            <label className="mt-5 block">
              <span className={labelOnInk}>Date of birth</span>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                autoComplete="bday"
                className={`${fieldOnInk} font-mono tabular-nums`}
              />
              <span className="mt-2 block font-body text-xs leading-relaxed text-paper/55">
                Trek Buddy is for adults. We do not show this to anyone.
              </span>
            </label>

            <div className="mt-5">
              <span className={labelOnInk}>Home base</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {TOWNS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHomeBase(homeBase === t ? '' : t)}
                    aria-pressed={homeBase === t}
                    className={`rounded-full border px-4 py-2 font-body text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
                      homeBase === t
                        ? 'border-sage bg-sage text-ink'
                        : 'border-paper/25 text-paper/70 hover:border-paper/60 hover:text-paper'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="mt-2.5 block font-body text-xs leading-relaxed text-paper/55">
                A town, never an address. It helps people find others leaving from the same place.
              </span>
            </div>

            <button type="button" onClick={() => setStep(1)} className={act}>
              Next — what you chase
            </button>
          </div>
        )}

        {/* ── 02 · What you chase ───────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="trek-h2 text-paper">Pick your hours.</h1>
            <p className="mt-3 font-body text-sm leading-relaxed text-paper/60">
              This tunes your board — and tells hosts what kind of company you are.
            </p>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {kinds.filter((k) => !k.isOpenEnded).map((k) => {
                const on = activities.includes(k.key)
                const light = lightForTime(k.defaultStart)
                return (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => toggleActivity(k.key)}
                    aria-pressed={on}
                    className="flex items-center gap-3 rounded-[var(--r-card)] border-2 border-paper/15 p-4 text-left transition-all duration-200 hover:border-paper/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                    style={on ? { borderColor: 'var(--sage)', background: 'rgba(110,155,121,0.14)' } : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: dotColor(light, 'dark') }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-body text-sm font-medium text-paper">
                        {k.label}
                      </span>
                      <span className="block font-body text-xs text-paper/50">
                        around <span className="font-mono tabular-nums">{k.defaultStart}</span>
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto font-body text-sm leading-none"
                      style={{ color: on ? 'var(--sage)' : 'transparent' }}
                    >
                      ✓
                    </span>
                  </button>
                )
              })}
            </div>

            <button type="button" onClick={() => setStep(2)} className={act}>
              Next — the deal
            </button>
          </div>
        )}

        {/* ── 03 · The deal ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="trek-h2 text-paper">
              Read once.
              <br />
              It is short, and it matters.
            </h1>

            {/* The platform's honesty moment, and the calmest thing on the
                screen. Four consequences, numbered, on ruled lines — not four
                bordered boxes, which is a warning panel repeated four times and
                reads as a thing to dismiss. Nothing here is coloured except the
                index, and the index is sage rather than amber because none of
                this is an alarm. It is simply true. */}
            <ol className="mt-7 flex flex-col">
              {DEAL.map((d, i) => (
                <li
                  key={d.t}
                  className="flex gap-4 border-t border-paper/12 py-4 first:border-0 first:pt-0"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs leading-[1.5] text-sage tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-[15px] leading-snug text-paper">{d.t}</span>
                    <span className="mt-1.5 block font-body text-[13px] leading-relaxed text-paper/55">
                      {d.d}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            {/* The rules of the place, before the box that says you accept them.
                A tick-box above unread guidance is a tick-box; below it, it is
                at least an acknowledgement of something the person has seen.
                Behind a disclosure now rather than always open, because six more
                paragraphs between the four rows and the button is how the four
                rows stop being the thing that gets read. */}
            <details className="group mt-5 border-t border-paper/12 pt-5">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-body text-sm font-medium text-paper/70 transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
                Before you go — six things to take care of
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-paper/25 text-paper/60 transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <SafetyNotes variant="compact" className="mt-3.5" />
            </details>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[var(--r-card)] border border-paper/25 bg-paper/[0.06] p-4">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sage)]"
              />
              <span className="font-body text-sm leading-relaxed text-paper">
                I understand, and I agree to all four.
              </span>
            </label>

            {/* A refusal from the server, held in clay — the colour of a thing
                that stopped. It used to be a line of amber type, which on this
                board now means a clock, and there is no clock here: the save
                simply did not happen and the sentence explaining why is the
                only thing that matters. */}
            {error && (
              <div className="mt-4 rounded-[var(--r-card)] border border-clay/50 bg-clay/15 px-4 py-3.5">
                <p className="font-body text-sm leading-relaxed text-paper">{error}</p>
                {missingIdentity && (
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="mt-2 border-b border-paper/30 pb-1 font-body text-[13px] font-medium text-paper/75 transition-colors hover:border-paper hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                  >
                    Back to {STEP_LABELS[0].toLowerCase()}
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={pending} className={act}>
              {pending ? 'Saving…' : 'Join the board'}
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
