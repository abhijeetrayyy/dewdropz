'use client'

import Link from 'next/link'
import { ACTIVITIES } from '@/lib/trek'

// The quick way in.
//
// "Post a walk" alone is a blank form, and a blank form is where an idea dies —
// especially for the person who thought "I might go stargazing on Saturday" and
// now has to decide eleven things. Each button carries its own sensible hours
// through to the form, so the fastest path from thought to posted plan is two
// taps and a place name.
export default function QuickStart({ canHost }: { canHost: boolean }) {
  if (!canHost) return null

  return (
    <div className="trek-card border border-rule bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest">
          Going somewhere? Start here
        </h2>
        <Link
          href="/trek-buddy/new"
          className="font-body text-[10px] uppercase tracking-[0.12em] text-mid underline underline-offset-4 transition-colors hover:text-text"
        >
          Start from blank
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVITIES.map((a) => (
          <Link
            key={a.key}
            href={`/trek-buddy/new?activity=${a.key}`}
            className="group flex items-baseline justify-between gap-3 trek-card border border-rule px-3.5 py-3 transition-colors hover:border-forest"
          >
            <span className="min-w-0">
              <span className="block font-body text-sm text-text">{a.label}</span>
              <span className="block truncate font-body text-[11px] text-mid">{a.blurb}</span>
            </span>
            <span className="shrink-0 font-mono text-[10px] text-mid tabular-nums transition-colors group-hover:text-forest">
              {a.defaultStart}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
