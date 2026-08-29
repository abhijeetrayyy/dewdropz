'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── The chip ─────────────────────────────────────────────────────────────────
//
// One control, two jobs it must keep straight.
//
// A DIMENSION chip opens a panel ("Apparel ▾", "Price ▾"). It is a disclosure:
// it gets `aria-expanded`, and pressing it reveals choices.
//
// A VALUE chip selects ("T-Shirts", "Under ₹1,500"). It is a checkbox: it gets
// `aria-pressed`, it is multi-selectable, and it shows a tick when on.
//
// The shop previously used one visual for both and radio behaviour for
// everything, so a control that looked multi-select silently replaced your
// choice instead of adding to it. Splitting the two roles is what makes the
// filter honest.

export function FilterChip({
  children,
  count,
  active = false,
  onClick,
  role = 'value',
  expanded,
  className,
}: {
  children: ReactNode
  count?: number
  active?: boolean
  onClick?: () => void
  role?: 'value' | 'dimension'
  expanded?: boolean
  className?: string
}) {
  const isDimension = role === 'dimension'

  return (
    <button
      type="button"
      onClick={onClick}
      {...(isDimension ? { 'aria-expanded': expanded } : { 'aria-pressed': active })}
      className={cn(
        'group inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-full border px-4 font-body text-[11px] uppercase tracking-[0.1em] transition-[background-color,border-color,color] duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        active
          ? 'border-forest bg-forest text-paper'
          : 'border-rule bg-surface text-mid hover:border-forest/40 hover:text-forest',
        className
      )}
    >
      {/* The tick only exists for value chips, and only when on — it is the
          affordance that says "this adds, it does not replace". */}
      {!isDimension && active && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}

      <span>{children}</span>

      {/* The count used to be `opacity-50` decoration. It is the single most
          useful thing on the chip — it is what stops someone selecting an empty
          result — so it is legible now: a real tally, at full contrast. */}
      {typeof count === 'number' && (
        <span
          className={cn(
            'font-mono text-[10px] tabular-nums transition-colors',
            active ? 'text-paper/70' : 'text-light group-hover:text-forest/60'
          )}
        >
          {count}
        </span>
      )}

      {isDimension && (
        <span
          aria-hidden="true"
          className={cn(
            'ml-0.5 text-[9px] transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        >
          ▾
        </span>
      )}
    </button>
  )
}

export default FilterChip
