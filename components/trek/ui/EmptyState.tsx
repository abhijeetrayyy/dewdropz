import Link from 'next/link'
import type { ReactNode } from 'react'
import { HOUR_BANDS } from '@/lib/trek'

// The board is empty today, and it will be empty again — on a Tuesday, under a
// filter nobody matches, on a profile with no walks yet. There were ten
// identical dashed grey boxes handling that, each one a small apology.
//
// An empty state is a real screen. It gets the same day-arc the full board
// gets, because the idea the product is built on does not switch off when
// there is no data — and it gets exactly one thing to do, because a person
// looking at nothing needs a door, not an explanation.

export default function EmptyState({
  title,
  body,
  action,
  secondary,
  className = '',
}: {
  title: string
  body: ReactNode
  action?: { label: string; href: string }
  secondary?: { label: string; href: string }
  className?: string
}) {
  return (
    <div
      className={`trek-provisional relative overflow-hidden px-6 py-10 text-center md:px-10 md:py-14 ${className}`}
    >
      {/* The day, still passing. Five bands, in order, at a whisper. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1">
        {HOUR_BANDS.map((b) => (
          <span key={b.key} className="flex-1" style={{ background: b.bg, opacity: 0.55 }} />
        ))}
      </div>

      <p className="mx-auto max-w-md font-display text-[22px] font-normal leading-tight text-text">
        {title}
      </p>
      <div className="mx-auto mt-3 max-w-md font-body text-sm leading-relaxed text-mid">
        {body}
      </div>

      {(action || secondary) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          {action && (
            <Link href={action.href} className="trek-pill trek-pill-act font-body font-semibold">
              {action.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:text-text"
            >
              {secondary.label} →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/** The ghost of a card, for a shelf that has nothing in it yet. */
export function GhostCard({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[var(--r-card)] border border-dashed border-rule-warm ${className}`}
      style={{ minHeight: 240 }}
    />
  )
}
