import { cn } from '@/lib/utils'

// ── Status, said out loud ────────────────────────────────────────────────────
//
// Every surface that shows an order state re-implemented this, and all of them
// did it the same wrong way:
//
//   <span className={order.status === 'delivered' ? 'text-forest'
//                  : order.status === 'cancelled' ? 'text-clay' : 'text-sage'}>
//
// Three problems. It encodes meaning in hue alone, which fails WCAG 1.4.1 and
// is invisible to roughly one man in twelve. `--sage` against `--forest` is a
// distinction almost nobody makes at 12px even with full colour vision. And
// because it collapses five live states into one "not finished" green, the
// screen cannot tell you the difference between *paid and waiting* and *on a
// van near you* — which is the only thing the customer opened the page to find.
//
// So a badge carries three signals, not one: a dot whose FORM differs (filled,
// ringed, hollow), a word, and a colour. Any two of the three are enough.

type Tone = 'neutral' | 'live' | 'moving' | 'done' | 'stopped' | 'warn'

const TONE: Record<Tone, { chip: string; dot: string }> = {
  // Waiting on someone. Deliberately quiet — this is not news.
  neutral: { chip: 'bg-paper-warm text-mid border-rule-warm',          dot: 'bg-faint' },
  // Accepted, in our hands, not yet moving. Dawn is the arrival colour.
  live:    { chip: 'bg-dawn-soft text-ember border-dawn/40',            dot: 'bg-dawn' },
  // Physically in transit.
  moving:  { chip: 'bg-sage-soft text-forest border-sage/40',           dot: 'bg-forest-mid ring-2 ring-sage/50' },
  // Finished well.
  done:    { chip: 'bg-forest text-paper border-forest',                dot: 'bg-sage-lit' },
  // Finished badly, or unwound.
  stopped: { chip: 'bg-clay-wash text-clay-deep border-clay/30',        dot: 'border-2 border-clay-deep bg-transparent' },
  // Needs the customer to do something.
  warn:    { chip: 'bg-amber-wash text-ember border-dawn/40',           dot: 'border-2 border-ember bg-transparent' },
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending:    { label: 'Pending',    tone: 'neutral' },
  confirmed:  { label: 'Confirmed',  tone: 'live' },
  processing: { label: 'In the studio', tone: 'live' },
  shipped:    { label: 'On its way', tone: 'moving' },
  delivered:  { label: 'Delivered',  tone: 'done' },
  cancelled:  { label: 'Cancelled',  tone: 'stopped' },
  refunded:   { label: 'Refunded',   tone: 'stopped' },
}

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending:            { label: 'Payment due',   tone: 'warn' },
  paid:               { label: 'Paid',          tone: 'done' },
  failed:             { label: 'Payment failed', tone: 'stopped' },
  refunded:           { label: 'Refunded',      tone: 'stopped' },
  partially_refunded: { label: 'Part refunded', tone: 'stopped' },
}

export const DEPOSIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending:   { label: 'Deposit due',  tone: 'warn' },
  held:      { label: 'Deposit held', tone: 'live' },
  refunded:  { label: 'Deposit back', tone: 'done' },
  forfeited: { label: 'Forfeited',    tone: 'stopped' },
  waived:    { label: 'Waived',       tone: 'neutral' },
}

export default function StatusBadge({
  status,
  map = ORDER_STATUS,
  size = 'md',
  className,
}: {
  status: string
  map?: Record<string, { label: string; tone: Tone }>
  size?: 'sm' | 'md'
  className?: string
}) {
  // An unmapped status still renders, spelled out rather than swallowed — a
  // silent blank is how a new backend state disappears from the UI unnoticed.
  const entry = map[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as Tone }
  const tone = TONE[entry.tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-tag)] border font-body font-medium uppercase tracking-[0.1em]',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        tone.chip,
        className
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
      {entry.label}
    </span>
  )
}
