'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ACTIVITIES, DIFFICULTY_LABEL } from '@/lib/trek'

const LANGUAGES = ['Hindi', 'English', 'Garhwali', 'Punjabi', 'Bengali']

// The chip is the board's whole selection idiom, and it now states a selection
// the way a control does rather than the way a highlighter does.
//
// What was here: 11px uppercase at 0.08em tracking, and a selected chip filled
// with `dawn` on both grounds. Two things were wrong with that. Amber on this
// board means A CLOCK IS RUNNING and nothing else, so a person with four
// filters on was looking at four urgent-coloured pills and had no way left to
// see the one walk that actually was about to leave. And small caps at wide
// tracking is a display gesture — it says "brand" — on a thing you press.
//
// So: selected is a solid forest fill with paper type, the same green as the
// one act on any screen; unselected is a 1px rule on whatever ground it is
// sitting on, and nothing else. Sentence case, 13px, medium.
//
// On ink the fill steps to `forest-mid`: #1F4A2E against #0F1210 is a 1.6:1
// edge, so a selected chip on the dark band would read as an unbordered hole
// in the row rather than as a filled one. forest-mid is the same colour with
// the block back, and paper on it still measures well past AA.
const chip = (on: boolean, dark: boolean) =>
  `whitespace-nowrap rounded-full border px-3.5 py-[7px] font-body text-[13px] font-medium leading-[1.2] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
    on
      ? dark
        ? 'border-forest-mid bg-forest-mid text-paper hover:bg-forest'
        : 'border-forest bg-forest text-paper hover:bg-forest-mid hover:border-forest-mid'
      : dark
        ? 'border-paper/30 text-paper/80 hover:border-paper/70 hover:text-paper'
        : 'border-rule text-mid hover:border-text hover:text-text'
  }`

/** The count inside a chip. A figure, so it is the one thing here set in mono. */
const chipCount = (on: boolean) =>
  // opacity-60 put the unselected count at 3.5:1. The count is the
  // most useful thing on a filter chip — it says whether pressing it
  // is worth anything — so it stays legible and separates from the
  // label by weight instead.
  `ml-1.5 font-mono text-[12px] font-medium tabular-nums ${on ? 'opacity-80' : 'opacity-85'}`

/** The key above a row of chips. A key, not a heading and not a control. */
const groupKey = (dark: boolean) => `trek-label ${dark ? 'text-paper/60' : 'text-mid'}`

/**
 * The disclosure and the clear link. Both are pressed, so neither may be
 * uppercase, tracked or monospace — they are sentences with a rule under them.
 */
const textAction = (dark: boolean) =>
  `shrink-0 whitespace-nowrap border-b pb-0.5 font-body text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
    dark
      ? 'border-paper/40 text-paper/85 hover:border-paper hover:text-paper'
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
  withSearch = true,
}: {
  counts: Record<string, number>
  tone?: 'light' | 'dark'
  /** Discover renders its own, larger, above the chips — see that page. */
  withSearch?: boolean
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
      {withSearch && (
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
              ? 'w-full rounded-[var(--r-input)] border border-paper/30 bg-ink/70 px-3.5 py-3 font-body text-sm text-paper shadow-[0_2px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md placeholder:text-paper/60 focus:border-sage focus:bg-ink/80 focus:outline-none'
              : 'w-full rounded-[var(--r-input)] border border-rule bg-surface px-3.5 py-2.5 font-body text-sm text-text placeholder:text-mid/70 focus:border-forest focus:outline-none'
          }
        />
      </label>
      )}

      {/* Each row is a single-choice group, so every chip carries aria-pressed
          — a screen reader that cannot see a forest fill otherwise has no way
          to know which cut of the board it is being read. */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => set('activity', 'all')}
          aria-pressed={activity === 'all'}
          className={chip(activity === 'all', dark)}
        >
          All
          {counts.all ? <span className={chipCount(activity === 'all')}>{counts.all}</span> : null}
        </button>
        {ACTIVITIES.filter((a) => counts[a.key] > 0 || activity === a.key).map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => set('activity', a.key)}
            aria-pressed={activity === a.key}
            className={chip(activity === a.key, dark)}
          >
            {a.label}
            {counts[a.key] ? (
              <span className={chipCount(activity === a.key)}>{counts[a.key]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* WRAPS RATHER THAN SCROLLS, and that is the point of this row.
          `overflow-x-auto` was fine while this held three time chips, and wrong
          the moment the two provision toggles moved up into it: at 375px the
          time chips alone fill the row, so anything after them starts
          off-screen behind a scrollbar this board deliberately hides. A
          promoted control you have to discover by swiping is not promoted. */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          ['all', 'Any time'],
          ['week', 'Next 7 days'],
          ['weekend', 'This weekend'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => set('when', k)}
            aria-pressed={when === k}
            className={chip(when === k, dark)}
          >
            {label}
          </button>
        ))}

        {/* Hidden on phones. The row wraps there, and a vertical rule that
            lands first on a wrapped line is a tick mark floating in the margin
            — it separates nothing. The wrap itself does the separating. */}
        <span
          aria-hidden="true"
          className={`mx-1 hidden h-5 w-px sm:block ${dark ? 'bg-paper/20' : 'bg-rule'}`}
        />

        {/* UP FROM BEHIND THE DISCLOSURE.
            These two were the last row inside "More filters", under a "Only
            show" key — three taps and a swipe from a board that prints their
            counts as headline statistics directly above. This product's case
            for itself is that it is somewhere a woman and somewhere a
            sixty-year-old can actually go; the controls that find those walks
            were the most buried on the screen. They are the first cut, not a
            refinement, so they sit with the time chips.

            "Has spaces", "How hard" and "Speaks" stay folded away. Those are
            genuine refinements — you reach for them once you are already
            looking at a board you can use. */}
        <button
          type="button"
          onClick={() => toggle('senior', seniorFriendly)}
          aria-pressed={seniorFriendly}
          className={chip(seniorFriendly, dark)}
        >
          Senior friendly
        </button>
        <button
          type="button"
          onClick={() => toggle('womenOnly', womenOnly)}
          aria-pressed={womenOnly}
          className={chip(womenOnly, dark)}
        >
          Women only
        </button>

        {/* The rest are refinements rather than the first cut, so they fold
            away. The count keeps a filtered board from looking like an empty
            one. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`ml-auto ${textAction(dark)}`}
        >
          {refined > 0 ? (
            <>
              Refined · <span className="font-mono tabular-nums">{refined}</span>
            </>
          ) : (
            'More filters'
          )}{' '}
          {open ? '−' : '+'}
        </button>
      </div>

      {open && (
        <div className={`space-y-3 border-t pt-3 ${dark ? 'border-paper/25' : 'border-rule'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={groupKey(dark)}>How hard</span>
            <button type="button" onClick={() => set('difficulty', 'all')}
              aria-pressed={difficulty === 'all'} className={chip(difficulty === 'all', dark)}>
              Any
            </button>
            {(['easy', 'moderate', 'difficult'] as const).map((k) => (
              <button key={k} type="button" onClick={() => set('difficulty', k)}
                aria-pressed={difficulty === k} className={chip(difficulty === k, dark)}>
                {DIFFICULTY_LABEL[k] ?? k}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={groupKey(dark)}>Speaks</span>
            <button type="button" onClick={() => set('language', 'all')}
              aria-pressed={language === 'all'} className={chip(language === 'all', dark)}>
              Any
            </button>
            {LANGUAGES.map((l) => (
              <button key={l} type="button" onClick={() => set('language', l)}
                aria-pressed={language === l} className={chip(language === l, dark)}>
                {l}
              </button>
            ))}
          </div>

          {/* Senior-friendly and women-only used to live here too. They are in
              the always-visible row above now — the counts for both are printed
              as headline statistics on this page, and a statistic you cannot
              act on without opening a disclosure is an advertisement rather
              than a control. "Has spaces" stays: it is a refinement. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={groupKey(dark)}>Only show</span>
            <button type="button" onClick={() => toggle('spots', hasSpots)} aria-pressed={hasSpots}
              className={chip(hasSpots, dark)}>Has spaces</button>
            {refined > 0 && (
              <button type="button"
                onClick={() => {
                  const next = new URLSearchParams(params.toString())
                  for (const k of ['difficulty', 'language', 'womenOnly', 'senior', 'spots']) next.delete(k)
                  router.replace(`${pathname}?${next.toString()}`, { scroll: false })
                }}
                className={textAction(dark)}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
