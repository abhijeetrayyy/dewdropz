import {
  ArrowDownLeft, ArrowUpRight, Ban, Camera, CheckCircle2, CircleDollarSign,
  FileText, Mail, PackageCheck, PackageOpen, Plus, RotateCcw, ShieldCheck,
  Truck, Wrench,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { RentalHistoryEntry } from '@/actions/rentalOps'

/**
 * What happened to this booking, in order.
 *
 * THE ONE READER. `rental_events` had twenty-eight write sites and no readers
 * at all; the rental council found it four separate times and proposed three
 * different screens. It is one query with two audiences, so this is one
 * component with two audiences — the operator on `/admin/rentals`, and the
 * customer on `/account/rentals` asking the only question that really matters
 * about a deposit: *why is this figure not the figure I handed over?*
 *
 * SOME EVENTS ARE NOT THE CUSTOMER'S BUSINESS, and that is what `audience`
 * decides. An internal note or a failed payment attempt is an operational
 * detail; showing it to the person it is about invites a support conversation
 * about something that was already handled. Every event that moved MONEY is
 * shown to both, always — that is the whole point of keeping the log.
 */

const LOOK: Record<string, { label: (e: RentalHistoryEntry) => string; icon: typeof Plus; tone: string }> = {
  created:            { label: () => 'Booked',                     icon: Plus,             tone: 'text-mid' },
  payment_received:   { label: () => 'Payment received',           icon: CircleDollarSign, tone: 'text-forest' },
  payment_failed:     { label: () => 'Payment failed',             icon: Ban,              tone: 'text-clay-deep' },
  refunded:           { label: () => 'Refunded',                   icon: RotateCcw,        tone: 'text-forest' },
  coupon_applied:     { label: () => 'Discount code applied',      icon: CircleDollarSign, tone: 'text-forest' },
  deposit_held:       { label: () => 'Deposit taken',              icon: ShieldCheck,      tone: 'text-mid' },
  deposit_refunded:   { label: () => 'Deposit returned',           icon: ArrowDownLeft,    tone: 'text-forest' },
  deposit_forfeited:  { label: () => 'Deposit kept',               icon: Ban,              tone: 'text-clay-deep' },
  handed_over:        { label: () => 'Handed over',                icon: PackageOpen,      tone: 'text-mid' },
  returned:           { label: () => 'Returned',                   icon: PackageCheck,     tone: 'text-forest' },
  inspected:          { label: () => 'Checked over',               icon: CheckCircle2,     tone: 'text-mid' },
  late_fee:           { label: () => 'Late return charged',        icon: CircleDollarSign, tone: 'text-clay-deep' },
  damage_fee:         { label: () => 'Damage charged',             icon: Wrench,           tone: 'text-clay-deep' },
  cancelled:          { label: () => 'Cancelled',                  icon: Ban,              tone: 'text-clay-deep' },
  note:               { label: () => 'Note',                       icon: FileText,         tone: 'text-mid' },
  extension_requested:{ label: () => 'Extension asked for',        icon: ArrowUpRight,     tone: 'text-mid' },
  extension_confirmed:{ label: () => 'Extension confirmed',        icon: CheckCircle2,     tone: 'text-forest' },
  extension_declined: { label: () => 'Extension declined',         icon: Ban,              tone: 'text-clay-deep' },
  photo_added:        { label: () => 'Photograph added',           icon: Camera,           tone: 'text-mid' },
  reminder_sent:      { label: () => 'Reminder sent',              icon: Mail,             tone: 'text-mid' },
  dispatched:         { label: () => 'Posted out',                 icon: Truck,            tone: 'text-mid' },
  delivered:          { label: () => 'Delivered',                  icon: PackageCheck,     tone: 'text-forest' },
  return_booked:      { label: () => 'Return collection booked',   icon: Truck,            tone: 'text-mid' },
}

/** Operational detail the customer has no use for. Anything that moved money is
 *  deliberately absent from this list. */
const STAFF_ONLY = new Set(['note', 'photo_added', 'payment_failed', 'inspected'])

export default function RentalHistory({
  entries,
  audience,
}: {
  entries: RentalHistoryEntry[]
  audience: 'staff' | 'customer'
}) {
  const shown = audience === 'staff' ? entries : entries.filter((e) => !STAFF_ONLY.has(e.kind))

  if (!shown.length) {
    return (
      <p className="font-body text-[13px] text-mid">
        Nothing has happened to this booking yet.
      </p>
    )
  }

  return (
    <ol className="relative space-y-0">
      {shown.map((e, i) => {
        // An unrecognised kind is rendered with its raw name rather than
        // dropped. A log that silently hides what it does not recognise is not
        // a log — and this list has grown three times already.
        const look = LOOK[e.kind] ?? { label: () => e.kind.replace(/_/g, ' '), icon: FileText, tone: 'text-mid' }
        const Icon = look.icon
        const last = i === shown.length - 1
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* The rule joining one event to the next, stopped short of the
                last so the timeline ends rather than trailing off. */}
            {!last && <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px bg-rule" />}
            <span className={`relative mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-rule bg-surface ${look.tone}`}>
              <Icon className="h-3 w-3" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-body text-[14px] text-ink">{look.label(e)}</span>
                {/* The figure is the reason this screen exists. It reads as
                    money, tabular, aligned to the right — not buried in the
                    note beside it. */}
                {e.amount != null && e.amount !== 0 && (
                  <span className={`font-mono text-[13px] tabular-nums ${look.tone}`}>{formatPrice(e.amount)}</span>
                )}
              </div>
              {e.note && <p className="mt-0.5 font-body text-[12px] leading-relaxed text-mid">{e.note}</p>}
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-light">
                {stamp(e.createdAt)}
                {/* Only to staff: a customer does not need to know which member
                    of staff, and naming them invites a conversation about a
                    person rather than about the charge. */}
                {audience === 'staff' && e.actor && <> · {e.actor}</>}
                {audience === 'staff' && !e.actor && <> · automatic</>}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Shown in the shop's timezone, because the person reading it is standing in
 *  it. A timestamp rendered in UTC is how a handover at 00:30 IST reads as
 *  having happened yesterday. */
function stamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}
