import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRentalItemsAdmin } from '@/actions/rentals'
import { getRentalCalendar } from '@/actions/rentalReports'
import RentalCalendar from '@/components/admin/RentalCalendar'

export const metadata = { title: 'Rental calendar — DEWDROPZ Admin' }

/**
 * The month, at a glance.
 *
 * The single most-requested thing missing from the rental system: availability
 * could be answered per item and per range, but nobody could SEE it. Without
 * this, "can I extend this rental?" is a question the operator answers by
 * trying it, and "which weekend is quiet?" has no answer at all.
 *
 * Fetched on the server and sent with the page, like the rest of this admin —
 * these functions run in US East and the people using them are in India, so a
 * fetch-after-mount is a second crossing that cannot start until the first has
 * finished.
 */
export default async function RentalCalendarPage() {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)

  const [items, calendar] = await Promise.all([
    getRentalItemsAdmin(),
    getRentalCalendar({ from, to }),
  ])

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/rentals"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-mid hover:text-forest"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Rentals
          </Link>
          <h1 className="mt-2 font-display text-3xl text-ink">The calendar</h1>
          <p className="mt-1 max-w-prose font-body text-sm text-mid">
            One row per physical unit, because that is what availability is decided on. The pale
            tail after a booking is the cleaning buffer — the unit is unavailable, and nobody paid
            for those days.
          </p>
        </div>
        <Link
          href="/admin/rentals/reports"
          className="rounded-[var(--r-input)] border border-rule bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink shadow-[var(--shadow-card)] hover:border-forest"
        >
          Utilisation →
        </Link>
      </div>

      <RentalCalendar
        initial={calendar}
        items={items.map((i) => ({ id: i.id, name: i.name }))}
      />
    </div>
  )
}
