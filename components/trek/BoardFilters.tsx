'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ACTIVITIES, DIFFICULTY_LABEL } from '@/lib/trek'

const LANGUAGES = ['Hindi', 'English', 'Garhwali', 'Punjabi', 'Bengali']

// Two grounds: the filters sit inside the dark header on the board, and on
// paper elsewhere. Same control, so it keeps one implementation rather than
// growing a second copy that drifts.
const chip = (on: boolean, dark: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.08em] transition-colors ${
    on
      // Amber, on both grounds. The selected filter is the loudest thing on the
      // board and the design spends its one saturated colour here; sage read as
      // "another green among greens" on a page already full of them.
      ? 'border-dawn bg-dawn text-ink'
      : dark
        // A real surface, not a hairline over a photograph. backdrop-blur is
        // the part that matters: it is a low-pass filter, so it collapses the
        // local variance that makes small type unreadable even where the
        // average contrast measures fine.
        ? 'border-paper/30 bg-ink/55 text-paper/80 backdrop-blur-sm hover:border-paper/70 hover:bg-ink/70 hover:text-paper'
        : 'border-rule text-mid hover:border-text hover:text-text'
  }`

// Filters live in the URL, not in component state.
//
// It costs nothing and it buys three things: a filtered board can be sent to
// someone, the back button behaves, and a refresh does not dump you back at
// "everything". The shop's own filter rail keeps its state internally and is
// the poorer for it.
export default function BoardFilters({
  counts,
  tone = 'light',
}: {
  counts: Record<string, number>
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  const activity = params.get('activity') ?? 'all'
  const when = params.get('when') ?? 'all'
  const difficulty = params.get('difficulty') ?? 'all'
  const language = params.get('language') ?? 'all'
  const womenOnly = params.get('womenOnly') === '1'
  const seniorFriendly = params.get('senior') === '1'
  const hasSpots = params.get('spots') === '1'

  // How many refinements are on, so the disclosure can say so rather than
  // hiding the fact that the board is filtered.
  const refined =
    (difficulty !== 'all' ? 1 : 0) + (language !== 'all' ? 1 : 0) +
    (womenOnly ? 1 : 0) + (seniorFriendly ? 1 : 0) + (hasSpots ? 1 : 0)
  const [open, setOpen] = useState(refined > 0)

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all' || value === '0') next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }
  const toggle = (key: string, on: boolean) => set(key, on ? '0' : '1')

  // Debounced so a filtered board is not re-fetched on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) set('q', q)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Search walks by place</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place — Nag Tibba, Mussoorie, Benog…"
          className={
            dark
              // Was border-paper/20 on bg-paper/[0.07] — effectively nothing —
              // and it spans the full content width, so its right half floated
              // over the open part of the photograph. Measured at 2.46:1
              // against the placeholder, well under the 4.5:1 small text needs.
              ? 'w-full rounded-sm border border-paper/30 bg-ink/70 px-3.5 py-3 font-body text-sm text-paper shadow-[0_2px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md placeholder:text-paper/60 focus:border-sage focus:bg-ink/80 focus:outline-none'
              : 'w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-sm text-text placeholder:text-mid/70 focus:border-forest focus:outline-none'
          }
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => set('activity', 'all')} className={chip(activity === 'all', dark)}>
          All{counts.all ? ` ${counts.all}` : ''}
        </button>
        {ACTIVITIES.filter((a) => counts[a.key] > 0 || activity === a.key).map((a) => (
          <button key={a.key} type="button" onClick={() => set('activity', a.key)} className={chip(activity === a.key, dark)}>
            {a.label}
            {counts[a.key] ? <span className="ml-1.5 opacity-60">{counts[a.key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          ['all', 'Any time'],
          ['week', 'Next 7 days'],
          ['weekend', 'This weekend'],
        ].map(([k, label]) => (
          <button key={k} type="button" onClick={() => set('when', k)} className={chip(when === k, dark)}>
            {label}
          </button>
        ))}

        {/* The rest are refinements rather than the first cut, so they fold
            away. The count keeps a filtered board from looking like an empty
            one. */}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className={`ml-auto shrink-0 whitespace-nowrap border-b pb-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
            dark ? 'border-paper/40 text-paper/85 hover:text-paper' : 'border-rule text-mid hover:text-text'
          }`}>
          {refined > 0 ? `Refined · ${refined}` : 'More filters'} {open ? '−' : '+'}
        </button>
      </div>

      {open && (
        <div className={`space-y-3 border-t pt-3 ${dark ? 'border-paper/25' : 'border-rule'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${dark ? 'text-paper/65' : 'text-mid'}`}>
              How hard
            </span>
            <button type="button" onClick={() => set('difficulty', 'all')} className={chip(difficulty === 'all', dark)}>
              Any
            </button>
            {(['easy', 'moderate', 'difficult'] as const).map((k) => (
              <button key={k} type="button" onClick={() => set('difficulty', k)} className={chip(difficulty === k, dark)}>
                {DIFFICULTY_LABEL[k] ?? k}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${dark ? 'text-paper/65' : 'text-mid'}`}>
              Speaks
            </span>
            <button type="button" onClick={() => set('language', 'all')} className={chip(language === 'all', dark)}>
              Any
            </button>
            {LANGUAGES.map((l) => (
              <button key={l} type="button" onClick={() => set('language', l)} className={chip(language === l, dark)}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toggle('spots', hasSpots)} aria-pressed={hasSpots}
              className={chip(hasSpots, dark)}>Has spaces</button>
            <button type="button" onClick={() => toggle('senior', seniorFriendly)} aria-pressed={seniorFriendly}
              className={chip(seniorFriendly, dark)}>Senior friendly</button>
            <button type="button" onClick={() => toggle('womenOnly', womenOnly)} aria-pressed={womenOnly}
              className={chip(womenOnly, dark)}>Women only</button>
            {refined > 0 && (
              <button type="button"
                onClick={() => {
                  const next = new URLSearchParams(params.toString())
                  for (const k of ['difficulty', 'language', 'womenOnly', 'senior', 'spots']) next.delete(k)
                  router.replace(`${pathname}?${next.toString()}`, { scroll: false })
                }}
                className={`border-b pb-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  dark ? 'border-paper/40 text-paper/80 hover:text-paper' : 'border-rule text-mid hover:text-text'
                }`}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
