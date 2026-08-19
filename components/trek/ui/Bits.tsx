import Link from 'next/link'
import type { ReactNode } from 'react'

// The small parts, in one file because they are one idea: a screen is built
// from a handful of stamps repeated exactly, and the moment each component
// hand-writes its own version of a section heading, the product loses the thing
// that made it look designed.

/**
 * The section stamp.
 *
 * It used to be 10px monospace at 0.22em tracking, which is a typographic
 * costume: mono says "this is machine output" and a section heading is not.
 * Mono is now rationed to figures. This is 11px medium, uppercase, at a
 * tracking a person can still read at a glance.
 */
export function SectionLabel({
  children,
  tone = 'quiet',
  className = '',
  as: As = 'h2',
}: {
  children: ReactNode
  /** `lede` is the one section stamp per screen allowed to take the accent. */
  tone?: 'quiet' | 'lede' | 'ondark' | 'trust'
  className?: string
  as?: 'h2' | 'h3' | 'p'
}) {
  // `lede` used to be ember. Amber is the warning lamp on this product — a
  // walk about to leave, an unread, a host being kept waiting — and spending
  // it on the word above a section meant the alarm colour was lit on every
  // screen at once, which is the same as it being lit on none of them. The
  // accent on paper is forest, which is also what the primary control wears.
  const tones = {
    quiet: 'text-mid',
    lede: 'text-forest',
    ondark: 'text-paper/55',
    trust: 'text-sage',
  }
  return (
    <As
      className={`trek-label ${tones[tone]} ${className}`}
    >
      {children}
    </As>
  )
}

/** The page eyebrow — one step wider than a section stamp. One per screen. */
export function Eyebrow({
  children,
  tone = 'lede',
  className = '',
}: {
  children: ReactNode
  tone?: 'lede' | 'ondark' | 'trust'
  className?: string
}) {
  // Forest on paper, sage on ink — never ember. An eyebrow is a signpost, and
  // amber is reserved for a clock that is actually running.
  const tones = { lede: 'text-forest', ondark: 'text-sage', trust: 'text-sage' }
  return (
    <p className={`trek-eyebrow ${tones[tone]} ${className}`}>
      {children}
    </p>
  )
}

/**
 * A number set large with its key above it.
 *
 * The unit of every stat strip on the product — the hero ticker, the board
 * counts, the plan facts, the person page, the basecamp tiles. The key is
 * small and the figure is not, which is the whole difference between a
 * dashboard and a caption.
 */
export function Datum({
  k,
  v,
  tone = 'light',
  size = 'md',
  className = '',
}: {
  k: string
  v: ReactNode
  tone?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const figure =
    size === 'lg' ? 'trek-figure-lg' : size === 'sm' ? 'font-mono text-base leading-none tabular-nums' : 'trek-figure'
  return (
    <div className={className}>
      <p className={`${figure} ${tone === 'dark' ? 'text-paper' : 'text-text'}`}>{v}</p>
      <p
        className={`trek-datum-key ${
          tone === 'dark' ? 'text-paper/50' : 'text-mid'
        }`}
      >
        {k}
      </p>
    </div>
  )
}

/** The facts row under a masthead — a `<dl>`, because that is what it is. */
export function FactRow({
  facts,
  tone = 'dark',
  className = '',
}: {
  facts: { k: string; v: ReactNode }[]
  tone?: 'light' | 'dark'
  className?: string
}) {
  if (facts.length === 0) return null
  return (
    <dl
      className={`flex flex-wrap gap-x-11 gap-y-3.5 border-t pt-4.5 ${
        tone === 'dark' ? 'border-paper/20' : 'border-rule'
      } ${className}`}
    >
      {facts.map((f) => (
        <div key={f.k}>
          <dt
            className={`trek-label-xs ${tone === 'dark' ? 'text-paper/50' : 'text-mid'}`}
          >
            {f.k}
          </dt>
          <dd
            className={`mt-1 font-mono text-[19px] leading-none tabular-nums ${
              tone === 'dark' ? 'text-paper' : 'text-text'
            }`}
          >
            {f.v}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The live dot. Two seconds, and only ever next to something actually live. */
export function LiveDot({
  color = 'var(--dawn)',
  size = 7,
  className = '',
}: {
  color?: string
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`tb-pulse block shrink-0 rounded-full ${className}`}
      style={{ height: size, width: size, background: color }}
    />
  )
}

/** A micro tag: cost, difficulty, a constraint. 4px, never a pill. */
export function Tag({
  children,
  tone = 'outline',
  className = '',
}: {
  children: ReactNode
  tone?: 'outline' | 'sage' | 'clay' | 'dawn' | 'ondark'
  className?: string
}) {
  const tones = {
    outline: 'border border-rule text-mid',
    sage: 'border border-forest/25 bg-sage-soft text-forest',
    clay: 'border border-clay/35 bg-clay-wash text-clay-deep',
    dawn: 'border border-dawn/35 bg-amber-wash text-ember',
    ondark: 'border border-paper/25 text-paper/75',
  }
  return (
    <span
      className={`rounded-[var(--r-tag)] px-2 py-[3px] text-[11px] font-medium leading-[1.4] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** The trailing link. Mono, underlined, always ends in an arrow. */
export function MoreLink({
  href,
  children,
  tone = 'light',
  className = '',
}: {
  href: string
  children: ReactNode
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap border-b pb-0.5 font-body text-[13px] font-medium transition-colors ${
        tone === 'dark'
          ? 'border-paper/25 text-paper/70 hover:border-paper hover:text-paper'
          : 'border-rule text-mid hover:border-forest hover:text-forest'
      } ${className}`}
    >
      {children} →
    </Link>
  )
}

/**
 * A section head with a rule running out of it to the count.
 *
 * The bucket headings on the board were mono labels sitting alone above a
 * grid, which made a group of walks look like a filter that had been applied
 * rather than a shelf that had been arranged. The rule is what turns a label
 * into a shelf edge.
 */
export function ShelfHead({
  title,
  count,
  action,
  as: As = 'h2',
  className = '',
}: {
  title: ReactNode
  count?: ReactNode
  action?: ReactNode
  /**
   * `h2` by default, because everywhere this is used it is a top-level section
   * under the page's own h1. It was hard-coded to `h3`, which skipped a level
   * on every screen that carries one — and a heading outline with a hole in it
   * is how a screen-reader user loses the shape of the page.
   */
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={`flex items-baseline gap-3.5 pb-4.5 ${className}`}>
      <As className="trek-h2 text-text">{title}</As>
      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
      {count !== undefined && (
        <span className="font-mono text-[13px] text-mid tabular-nums">{count}</span>
      )}
      {action}
    </div>
  )
}
