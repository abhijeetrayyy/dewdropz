'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ACTIVITIES } from '@/lib/trek'

const chip = (on: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.08em] transition-colors ${
    on ? 'border-forest bg-forest text-paper' : 'border-rule text-mid hover:border-text hover:text-text'
  }`

// Filters live in the URL, not in component state.
//
// It costs nothing and it buys three things: a filtered board can be sent to
// someone, the back button behaves, and a refresh does not dump you back at
// "everything". The shop's own filter rail keeps its state internally and is
// the poorer for it.
export default function BoardFilters({ counts }: { counts: Record<string, number> }) {
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
          className="w-full rounded-sm border border-rule bg-white px-3.5 py-2.5 font-body text-sm text-text placeholder:text-mid/70 focus:border-forest focus:outline-none"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => set('activity', 'all')} className={chip(activity === 'all')}>
          All{counts.all ? ` ${counts.all}` : ''}
        </button>
        {ACTIVITIES.filter((a) => counts[a.key] > 0 || activity === a.key).map((a) => (
          <button key={a.key} type="button" onClick={() => set('activity', a.key)} className={chip(activity === a.key)}>
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
          <button key={k} type="button" onClick={() => set('when', k)} className={chip(when === k)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
