import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Nothing here, said properly ──────────────────────────────────────────────
//
// The storefront had eleven variations on `border border-dashed border-rule
// rounded-sm py-20 text-center` with one grey sentence in the middle. A dashed
// grey box is what a layout does when nobody decided what should happen — and
// it is shown at the exact moments a person is most likely to leave: an empty
// cart, an empty order history, a filter combination that matched nothing.
//
// An empty state is a real screen. It gets a surface like everything else, it
// says what would be here, and it offers exactly one door out. Two doors is a
// decision; one door is a direction.

export default function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: { label: string; href: string }
  secondary?: { label: string; href: string } | { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--r-panel)] border border-rule/70 bg-surface px-6 py-14 text-center shadow-[var(--shadow-card)] md:py-16',
        className
      )}
    >
      {/* A hairline of first light along the top edge. The page is empty; the
          brand is not. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-dawn/50 to-transparent"
      />

      {icon && (
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-paper-warm text-forest">
          {icon}
        </div>
      )}

      <p className="mx-auto max-w-md font-display text-[clamp(20px,2.4vw,26px)] leading-tight text-text">
        {title}
      </p>
      {body && (
        <div className="mx-auto mt-3 max-w-sm font-body text-sm leading-relaxed text-mid">{body}</div>
      )}

      {(action || secondary) && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {action && (
            <Link
              href={action.href}
              className="inline-flex min-h-[44px] items-center rounded-full bg-forest px-7 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-paper transition-colors duration-300 hover:bg-forest-mid"
            >
              {action.label}
            </Link>
          )}
          {secondary &&
            ('href' in secondary ? (
              <Link
                href={secondary.href}
                className="border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:border-forest hover:text-forest"
              >
                {secondary.label} →
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondary.onClick}
                className="border-b border-rule pb-1 font-body text-[13px] text-mid transition-colors hover:border-forest hover:text-forest"
              >
                {secondary.label}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
