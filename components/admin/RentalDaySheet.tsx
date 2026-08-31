import Link from 'next/link'
import { shopAddDays } from '@/lib/shopTime'

/**
 * What goes out today, what comes back today, and what is late.
 *
 * Designed to be PRINTED and carried. The shop reads this at the counter with a
 * customer in front of them, so: phone numbers are tappable, unit codes are the
 * biggest thing in each row (a code is what an operator actually hunts for on a
 * shelf), and the overdue section is first when it is not empty — because it is
 * the only section that represents money already leaking.
 */

/** PostgREST types an embedded relation as an array even when the foreign key
 *  makes it to-one, and the runtime value is whichever the planner produced. So
 *  the type admits both and `one()` collapses it — casting one shape away would
 *  be a lie that only shows up at runtime. */
type Embed<T> = T | T[] | null

type Row = {
  id: string
  starts_on: string
  ends_on: string
  item: Embed<{ name: string }>
  unit: Embed<{ code: string }>
  booking: Embed<{
    id: string
    booking_number: string
    email: string
    phone: string | null
    fulfilment?: string
    status: string
    pickup_slot?: string | null
  }>
}

function one<T>(v: Embed<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type Sheet = { day: string; going: Row[]; coming: Row[]; overdue: Row[] }

function daysLate(endsOn: string, today: string): number {
  const a = new Date(`${endsOn}T00:00:00Z`).getTime()
  const b = new Date(`${today}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function Rows({ rows, today, late }: { rows: Row[]; today: string; late?: boolean }) {
  if (!rows.length) {
    return <p className="px-1 py-6 font-body text-[13px] text-mid">Nothing.</p>
  }
  return (
    <ul className="divide-y divide-rule-soft">
      {rows.map((r) => {
        const over = late ? daysLate(r.ends_on, today) : 0
        const item = one(r.item)
        const unit = one(r.unit)
        const booking = one(r.booking)
        return (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            {/* The unit code leads: it is what somebody physically looks for. */}
            <span className="font-mono text-[15px] font-medium tabular-nums text-ink">
              {unit?.code ?? '—'}
            </span>
            <span className="font-body text-[15px] text-text">{item?.name ?? 'Item'}</span>
            {over > 0 && (
              <span className="rounded-[var(--r-tag)] bg-dawn-soft px-2 py-0.5 font-body text-[11px] font-medium text-ink">
                {over} {over === 1 ? 'day' : 'days'} late
              </span>
            )}
            <span className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {booking?.pickup_slot && (
                <span className="font-mono text-[12px] tabular-nums text-mid">
                  {new Date(booking.pickup_slot).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
                  })}
                </span>
              )}
              {booking?.phone && (
                // Tappable, because the operator's next move on an overdue
                // rental is to ring the customer.
                <a href={`tel:${booking.phone}`} className="font-mono text-[13px] tabular-nums text-forest underline">
                  {booking.phone}
                </a>
              )}
              <span className="font-mono text-[12px] text-mid">{booking?.booking_number}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Section({
  title, count, children, tone = 'plain',
}: {
  title: string; count: number; children: React.ReactNode; tone?: 'plain' | 'alarm'
}) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="flex items-baseline gap-3 border-b border-rule pb-2">
        <span className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-mid">{title}</span>
        <span
          className={
            tone === 'alarm' && count > 0
              ? 'rounded-full bg-clay-deep px-2 py-0.5 font-mono text-[11px] tabular-nums text-paper'
              : 'font-mono text-[11px] tabular-nums text-mid'
          }
        >
          {count}
        </span>
      </h2>
      {children}
    </section>
  )
}

export default function RentalDaySheet({ sheet, today }: { sheet: Sheet; today: string }) {
  const isToday = sheet.day === today
  return (
    <div className="mx-auto max-w-measure px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-forest">
            Rentals
          </p>
          <h1 className="mt-1 font-display text-[clamp(28px,4vw,40px)] leading-tight text-ink">
            {isToday ? 'Today' : sheet.day}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/rentals/today?day=${shopAddDays(sheet.day, -1)}`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-input)] border border-rule px-3 font-body text-[13px] text-mid hover:border-forest hover:text-forest"
          >
            ← Previous
          </Link>
          <Link
            href={`/admin/rentals/today?day=${shopAddDays(sheet.day, 1)}`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-input)] border border-rule px-3 font-body text-[13px] text-mid hover:border-forest hover:text-forest"
          >
            Next →
          </Link>
          <Link
            href="/admin/rentals"
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-input)] border border-rule px-3 font-body text-[13px] text-mid hover:border-forest hover:text-forest"
          >
            All bookings
          </Link>
        </div>
      </div>

      {/* Printed sheets need to say which day they are. */}
      <p className="hidden font-mono text-[12px] tabular-nums text-ink print:block">
        DEWDROPZ · rentals · {sheet.day}
      </p>

      {/* Overdue first when there is any, because it is the only section that is
          money already leaking. Empty, it sits last and stays quiet. */}
      {sheet.overdue.length > 0 && (
        <Section title="Overdue" count={sheet.overdue.length} tone="alarm">
          <Rows rows={sheet.overdue} today={today} late />
        </Section>
      )}

      <Section title="Out today" count={sheet.going.length}>
        <Rows rows={sheet.going} today={today} />
      </Section>

      <Section title="Back today" count={sheet.coming.length}>
        <Rows rows={sheet.coming} today={today} />
      </Section>

      {sheet.overdue.length === 0 && (
        <Section title="Overdue" count={0}>
          <Rows rows={[]} today={today} />
        </Section>
      )}
    </div>
  )
}
