import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Polymorphic `as` needs a props shape TS can actually resolve. Left as a bare
// `ElementType`, the union of every possible element widens `children` to
// `never` and nothing can be passed to it.
type PolymorphicProps = { className?: string; children?: ReactNode; [key: string]: unknown }

// ── The card, at last ────────────────────────────────────────────────────────
//
// `app/globals.css` has defined `--surface`, a four-rung shadow ladder and a
// seven-rung radius ladder since the palette was rebuilt. Outside Trek Buddy,
// none of it was ever used: 75 places across the storefront draw a card as
// `border border-rule rounded-sm bg-paper` — cream on cream, separated from the
// ground by a 1px hairline and a 2px corner.
//
// That is why the site read as flat. A card the same colour as the sheet behind
// it is not an object on a page, it is a boxed-off region of the same page, and
// six of them stacked read as one undifferentiated slab. The fix was never a
// different cream; it was giving the cream something to sit *under*.
//
// So: one component, and the rule that goes with it. Cream is floor. White is
// furniture. Anything with a border and content inside it is furniture.

type Elevation = 'flat' | 'card' | 'lift' | 'panel' | 'float'
type Radius = 'input' | 'card' | 'panel' | 'shell'

const ELEVATION: Record<Elevation, string> = {
  flat:  '',
  card:  'shadow-[var(--shadow-card)]',
  lift:  'shadow-[var(--shadow-lift)]',
  panel: 'shadow-[var(--shadow-panel)]',
  float: 'shadow-[var(--shadow-float)]',
}

const RADIUS: Record<Radius, string> = {
  input: 'rounded-[var(--r-input)]',
  card:  'rounded-[var(--r-card)]',
  panel: 'rounded-[var(--r-panel)]',
  shell: 'rounded-[var(--r-shell)]',
}

export function Surface({
  as = 'div',
  elevation = 'card',
  radius = 'card',
  // A card that is a link or a button rises when pointed at. Static cards must
  // NOT do this — a surface that moves under the cursor and then does nothing
  // when clicked is a promise the page cannot keep.
  interactive = false,
  bordered = true,
  className,
  children,
  ...rest
}: {
  as?: ElementType
  elevation?: Elevation
  radius?: Radius
  interactive?: boolean
  bordered?: boolean
  className?: string
  children?: ReactNode
} & Record<string, unknown>) {
  const Tag = as as ElementType<PolymorphicProps>
  return (
    <Tag
      className={cn(
        'bg-surface',
        bordered && 'border border-rule/70',
        RADIUS[radius],
        ELEVATION[elevation],
        interactive &&
          'transition-[box-shadow,border-color,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// A panel is a larger enclosure that holds cards, or a sidebar, or a form
// section. Bigger surface, bigger radius — the ladder is monotonic with size
// precisely so that a chip, a card and a panel cannot read as the same kind of
// object, which is most of what "everything looks the same" means.
export function Panel({
  as = 'section',
  className,
  children,
  ...rest
}: {
  as?: ElementType
  className?: string
  children?: ReactNode
} & Record<string, unknown>) {
  const Tag = as as ElementType<PolymorphicProps>
  return (
    <Tag
      className={cn(
        'border border-rule/70 bg-surface shadow-[var(--shadow-card)] rounded-[var(--r-panel)]',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// The heading strip at the top of a panel. Its own hairline is `--rule-soft`,
// which exists for exactly this: a division *inside* a card has to be quieter
// than the card's own edge, or the card's internal structure shouts as loudly
// as its boundary.
export function PanelHeader({
  title,
  action,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-rule-soft px-5 py-4 md:px-6',
        className
      )}
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-mid">{title}</h2>
      {action}
    </div>
  )
}
