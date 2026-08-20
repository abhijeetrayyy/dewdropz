'use client'

import Link from 'next/link'
import { ACTIVITIES, DAY_PART_LABEL, dotColor, lightForTime } from '@/lib/trek'
import { MoreLink, ShelfHead } from './ui/Bits'

// The quick way in.
//
// "Post a walk" alone is a blank form, and a blank form is where an idea dies —
// especially for the person who thought "I might go stargazing on Saturday" and
// now has to decide eleven things. Each tile carries its own sensible hours
// through to the composer, so the fastest path from thought to posted plan is
// two taps and a place name.
//
// Drawn as the composer's own activity tiles rather than as a row of links: the
// grid you tap here is the grid you land on, with the same dot in the same
// hour's colour and the same "usually 05:20" underneath. A shortcut that looks
// nothing like the thing it is a shortcut to is a second interface to learn.
//
// The tile is now the product's choice-tile idiom: a 1px rule, and forest — the
// primary — when it is the one you are choosing. It was a 2px rule going amber
// on hover with an amber focus ring, which spent the board's urgency colour on
// a shortcut that is not urgent about anything, and put a 2px box around six
// tiles so the grid read heavier than the walks below it.
//
// Each tile also states the part of the day it lands in. "Stargazing · after
// dark" and "Camping · overnight" are the two kinds of outing where the hour is
// the whole safety question, and a host picking a tile should meet that fact
// here rather than at the validation error.
export default function QuickStart({ canHost }: { canHost: boolean }) {
  if (!canHost) return null

  return (
    <section className="trek-card p-5 md:p-6">
      <ShelfHead
        title="Going somewhere? Start here"
        action={<MoreLink href="/trek-buddy/new">Start from blank</MoreLink>}
      />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVITIES.map((a) => {
          const light = lightForTime(a.defaultStart)
          return (
            <Link
              key={a.key}
              href={`/trek-buddy/new?activity=${a.key}`}
              className="group flex flex-col gap-1 rounded-[var(--r-card)] border border-rule bg-surface p-4 transition-colors duration-200 hover:border-forest hover:bg-sage-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-body text-[15px] font-medium leading-snug text-text transition-colors group-hover:text-forest">
                  {a.label}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: dotColor(light, 'light') }}
                />
              </span>
              <span className="font-body text-xs leading-snug text-mid">{a.blurb}</span>
              <span className="mt-0.5 font-body text-[11px] text-mid">
                Usually <span className="font-mono tabular-nums">{a.defaultStart}</span> ·{' '}
                {DAY_PART_LABEL[a.dayPart]}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
