'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveTrekPerson, vouchFor, type PersonCard, type TrekKind } from '@/actions/trekBuddy'
import PersonCardTile from '@/components/trek/PersonCardTile'
import { EXPERIENCE_LABEL } from '@/components/trek/PersonCardTile'

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

const label = 'font-mono text-[10px] uppercase tracking-[0.2em] text-mid'
const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 font-body text-xs transition-colors ${
    on ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text hover:text-text'
  }`

// Managing how people see you.
//
// Every control here is a choice about what a stranger learns before deciding
// whether to walk with you, so the page says what each one is for rather than
// just labelling the field. The counted facts are shown but not editable —
// experience on this board is derived from what happened, and a profile that
// lets you type "experienced" is a profile that means nothing.
export default function ProfileForm({
  person,
  vouchable,
  kinds,
}: {
  person: PersonCard
  vouchable: Vouchable[]
  /** From the kinds table (057), not a frozen list — an activity an admin adds
      has to be selectable here too, or profiles cannot describe the board. */
  kinds: TrekKind[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
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

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await saveTrekPerson(f)
      if ('error' in r) { setError(r.error ?? 'Could not save'); return }
      setSaved(true)
      router.refresh()
    })
  }

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

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="min-w-0 space-y-12">
      <form onSubmit={submit}>
        <div className="space-y-8">
          <div>
            <label className="block">
              <span className={label}>Name people see</span>
              <input
                value={f.displayName} onChange={(e) => set({ displayName: e.target.value })}
                required minLength={2} maxLength={40} autoComplete="nickname"
                className="mt-2 w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-base text-text focus:border-forest focus:outline-none"
              />
            </label>
            <p className="mt-1.5 font-body text-xs text-mid">
              Not your delivery name. A first name is plenty.
            </p>
          </div>

          <div>
            <span className={label}>Where you set off from</span>
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
          </div>

          <div>
            <span className={label}>What you go out for</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {kinds.filter((a) => !a.isOpenEnded).map((a) => (
                <button key={a.key} type="button" onClick={() => toggle('activities', a.key)}
                  aria-pressed={f.activities.includes(a.key)} className={chip(f.activities.includes(a.key))}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>Your pace</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {PACES.map(([k, t, d]) => (
                <button key={k} type="button" onClick={() => set({ pace: f.pace === k ? '' : k })}
                  aria-pressed={f.pace === k}
                  className={`rounded-sm border px-3.5 py-3 text-left transition-colors ${
                    f.pace === k ? 'border-forest bg-forest/[0.06]' : 'border-rule hover:border-text'
                  }`}>
                  <span className="block font-body text-sm text-text">{t}</span>
                  <span className="block font-body text-xs text-mid">{d}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-body text-xs text-mid">
              Be honest. Somebody is going to plan their day around this.
            </p>
          </div>

          <div>
            <span className={label}>Speaks</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button key={l} type="button" onClick={() => toggle('languages', l)}
                  aria-pressed={f.languages.includes(l)} className={chip(f.languages.includes(l))}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* The self-declared half.
              Everything below is a claim, and the profile page says so where it
              shows it — it sits next to four counted facts the board can
              actually prove, and blurring that line would make the proven ones
              worthless. Nobody is asked to justify any of it. */}
          <div>
            <span className={label}>How much you have done</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXPERIENCE.map(([k, t, d]) => (
                <button key={k} type="button"
                  onClick={() => set({ experience: f.experience === k ? '' : k })}
                  aria-pressed={f.experience === k}
                  className={`rounded-sm border px-3.5 py-3 text-left transition-colors ${
                    f.experience === k ? 'border-forest bg-forest/[0.06]' : 'border-rule hover:border-text'
                  }`}>
                  <span className="block font-body text-sm text-text">{t}</span>
                  <span className="block font-body text-xs text-mid">{d}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Years going out</span>
              <input type="number" min={0} max={60} value={f.yearsOut ?? ''}
                onChange={(e) => set({ yearsOut: e.target.value === '' ? null : Number(e.target.value) })}
                className="mt-2 w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-base text-text focus:border-forest focus:outline-none" />
            </label>
            <label className="block">
              <span className={label}>Highest you have been (m)</span>
              <input type="number" min={0} max={8849} value={f.highestM ?? ''}
                onChange={(e) => set({ highestM: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="3022"
                className="mt-2 w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-base text-text placeholder:text-mid/50 focus:border-forest focus:outline-none" />
              <span className="mt-1.5 block font-body text-xs text-mid">
                Nobody checks this. It is here because it tells another walker more than
                &ldquo;experienced&rdquo; does.
              </span>
            </label>
          </div>

          <div>
            <span className={label}>When you usually go</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button key={d} type="button" onClick={() => toggle('usualDays', d)}
                  aria-pressed={f.usualDays.includes(d)} className={chip(f.usualDays.includes(d))}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>What you carry</span>
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
          </div>

          <div>
            <label className="block">
              <span className={label}>A line about you</span>
              <textarea
                value={f.intro} onChange={(e) => set({ intro: e.target.value })}
                rows={3} maxLength={280}
                placeholder="Slow walker, happiest above the treeline. Usually out on Sundays."
                className="mt-2 w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-sm text-text focus:border-forest focus:outline-none"
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
          </div>
        </div>

        {error && <p className="mt-6 font-body text-sm text-clay">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending}
            className="rounded-sm bg-forest px-6 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-forest-mid disabled:opacity-50">
            {pending ? 'Saving…' : 'Save profile'}
          </button>
          {saved && <span className="font-body text-sm text-forest">Saved.</span>}
          <Link href={`/trek-buddy/people/${person.userId}`}
            className="border-b border-rule pb-1 font-body text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text">
            See how you look
          </Link>
        </div>
      </form>

      {/* Vouching lives here rather than on the other person's page, because it
          is a thing you do about a walk you were on — the list is the walks, and
          the people are inside them. */}
      {vouchable.length > 0 && (
        <section className="border-t border-rule pt-8">
          <h2 className={label}>Vouch for people you have walked with</h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-mid">
            Only you can say this, and only about someone who was actually out with you. It is the
            strongest thing on their profile, so mean it.
          </p>
          <div className="mt-5 space-y-5">
            {vouchable.map((w) => (
              <div key={w.planId}>
                <p className="font-body text-sm text-text">
                  {w.place}{' '}
                  <span className="text-mid">
                    · {new Date(w.when).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}
                  </span>
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {w.people.map((p) => (
                    <li key={p.user_id}>
                      {p.vouched ? (
                        <span className="rounded-full border border-forest/40 bg-forest/[0.06] px-3.5 py-1.5 font-body text-xs text-forest">
                          {p.display_name} · vouched
                        </span>
                      ) : (
                        <button type="button" disabled={pending}
                          onClick={() => start(async () => { await vouchFor(w.planId, p.user_id); router.refresh() })}
                          className="rounded-full border border-rule px-3.5 py-1.5 font-body text-xs text-mid transition-colors hover:border-forest hover:text-forest disabled:opacity-40">
                          Vouch for {p.display_name}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>

      {/* The other half of the page, and the reason it is one page now: the
          public view lived at a different URL, so seeing the effect of an edit
          meant saving, navigating away, and navigating back. */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className={label}>How you look on the board</p>
        <div className="mt-3">
          <PersonCardTile person={preview} />
        </div>

        <div className="mt-5 border-t border-rule pt-4">
          <p className={label}>On your profile</p>
          <dl className="mt-3 space-y-2">
            {[
              ['Experience', f.experience ? EXPERIENCE_LABEL[f.experience] ?? f.experience : null],
              ['Going out for', f.yearsOut != null ? `${f.yearsOut} year${f.yearsOut === 1 ? '' : 's'}` : null],
              ['Highest been', f.highestM != null ? `${f.highestM.toLocaleString('en-IN')} m` : null],
              ['Usually goes', f.usualDays.length ? f.usualDays.join(', ') : null],
              ['Carries', f.carries.length ? f.carries.join(', ') : null],
              ['Speaks', f.languages.length ? f.languages.join(', ') : null],
            ].map(([k, v]) => (
              <div key={k as string} className="flex gap-3">
                <dt className="w-24 shrink-0 font-body text-xs text-mid">{k}</dt>
                <dd className={`font-body text-xs ${v ? 'text-text' : 'text-mid/45'}`}>
                  {(v as string) ?? 'Not said'}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-4 font-body text-xs leading-relaxed text-mid">
          This updates as you type. Nothing is saved until you press the button.
        </p>

        <Link
          href={`/trek-buddy/people/${person.userId}`}
          className="mt-3 inline-block border-b border-rule pb-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mid transition-colors hover:text-text"
        >
          Open the real page →
        </Link>
      </aside>
    </div>
  )
}
