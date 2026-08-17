'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ACTIVITIES } from '@/lib/trek'

// Two grounds: the filters sit inside the dark header on the board, and on
// paper elsewhere. Same control, so it keeps one implementation rather than
// growing a second copy that drifts.
const chip = (on: boolean, dark: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.08em] transition-colors ${
    on
      ? dark ? 'border-sage bg-sage text-ink' : 'border-forest bg-forest text-paper'
      : dark
        ? 'border-paper/25 text-paper/60 hover:border-paper/60 hover:text-paper'
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

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

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
              ? 'w-full rounded-sm border border-paper/20 bg-paper/[0.07] px-3.5 py-3 font-body text-sm text-paper placeholder:text-paper/40 focus:border-sage focus:outline-none'
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

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          ['all', 'Any time'],
          ['week', 'Next 7 days'],
          ['weekend', 'This weekend'],
        ].map(([k, label]) => (
          <button key={k} type="button" onClick={() => set('when', k)} className={chip(when === k, dark)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
