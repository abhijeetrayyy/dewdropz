'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveTrekPerson, vouchFor, type PersonCard } from '@/actions/trekBuddy'
import { ACTIVITIES } from '@/lib/trek'

const TOWNS = ['Dehradun', 'Mussoorie', 'Rishikesh', 'Haridwar', 'Sahastradhara', 'Chakrata', 'Elsewhere']
const PACES = [
  ['steady', 'Steady', 'Stops often, no rush'],
  ['brisk', 'Brisk', 'Keeps moving'],
  ['fast', 'Fast', 'Expects a pace'],
] as const
const LANGUAGES = ['Hindi', 'English', 'Garhwali', 'Punjabi', 'Bengali']

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
}: {
  person: PersonCard
  vouchable: Vouchable[]
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
  })
  // Functional updates, not { ...f, ...p }.
  //
  // Every chip on this page is a separate click, and two clicks in the same
  // tick both read the same captured `f` — so picking a town and then an
  // activity silently threw the town away. Caught by filling the form in a
  // test and finding three fields missing from the row afterwards.
  const set = (p: Partial<typeof f>) => { setF((prev) => ({ ...prev, ...p })); setSaved(false) }
  const toggle = (key: 'activities' | 'languages', v: string) => {
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

  return (
    <div className="mx-auto max-w-2xl space-y-12">
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
              {ACTIVITIES.map((a) => (
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
  )
}
