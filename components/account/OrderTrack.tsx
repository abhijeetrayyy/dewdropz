import { cn } from '@/lib/utils'

// ── Where the order actually is ──────────────────────────────────────────────
//
// The account showed order state as a single coloured word. That answers "what
// is it called" and not "how far along is it", which is the only question the
// customer opened the page to ask. Four stages, drawn, so progress is a
// distance rather than a vocabulary.
//
// Cancelled and refunded orders never render this — a progress track for
// something that stopped is a lie about what happened next.

const STAGES = [
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'processing', label: 'In the studio' },
  { key: 'shipped',    label: 'On its way' },
  { key: 'delivered',  label: 'Delivered' },
] as const

const ORDER: Record<string, number> = {
  pending: -1, confirmed: 0, processing: 1, shipped: 2, delivered: 3,
}

export default function OrderTrack({ status, className }: { status: string; className?: string }) {
  if (status === 'cancelled' || status === 'refunded') return null
  const at = ORDER[status] ?? -1

  return (
    <ol className={cn('flex items-start gap-1', className)} aria-label={`Order status: ${status}`}>
      {STAGES.map((stage, i) => {
        const done = i <= at
        const current = i === at
        return (
          <li key={stage.key} className="flex-1">
            <div className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                  current ? 'bg-dawn ring-4 ring-dawn/20' : done ? 'bg-forest' : 'bg-rule-warm'
                )}
              />
              {/* The connector belongs to the gap AFTER a node, so the last
                  stage does not draw a rail into empty space. */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn('h-px flex-1 transition-colors', i < at ? 'bg-forest' : 'bg-rule-warm')}
                />
              )}
            </div>
            <span
              className={cn(
                'mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] transition-colors',
                current ? 'text-ember' : done ? 'text-forest' : 'text-light'
              )}
            >
              {stage.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
