import Image from 'next/image'
import { requireAuth } from '@/actions/auth'
import { getMyRentalBookings } from '@/actions/rentals'
import { formatPrice } from '@/lib/utils'
import CancelRentalButton from '@/components/account/CancelRentalButton'
import ExtendRental from '@/components/account/ExtendRental'
import RentalPayButton from '@/components/account/RentalPayButton'
import { Surface } from '@/components/ui/surface'
import StatusBadge from '@/components/ui/status-badge'
import EmptyState from '@/components/ui/empty-state'
import { Tent } from 'lucide-react'

/**
 * The bookings a customer has made.
 *
 * This did not exist. Somebody could book a tent on the website and then had no
 * way to see it again — not the dates, not the booking number they are asked to
 * bring, not what happened to their deposit. The app has had this screen since
 * the feature shipped; the website, where the booking was made, had nothing.
 */

// Rental states, mapped onto the shared badge. Two of these ('returned',
// 'closed') previously used `bg-sand`, and 'cancelled' used `text-rust` —
// neither name is defined in the theme, so in Tailwind v4 both compiled to
// nothing and those pills rendered with no background at all.
const RENTAL_STATUS = {
  reserved:  { label: 'Held for you', tone: 'live' },
  out:       { label: 'With you',     tone: 'moving' },
  returned:  { label: 'Returned',     tone: 'done' },
  closed:    { label: 'Closed',       tone: 'neutral' },
  cancelled: { label: 'Cancelled',    tone: 'stopped' },
} as const

const DEPOSIT_NOTE: Record<string, string> = {
  pending: 'Deposit due at the counter',
  held: 'Deposit held',
  refunded: 'Deposit returned',
  forfeited: 'Deposit kept',
  waived: 'Deposit waived',
}

function pretty(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export default async function AccountRentalsPage() {
  await requireAuth('/account/rentals')
  const bookings = await getMyRentalBookings()
  const live = bookings.filter((b) => b.status === 'reserved' || b.status === 'out').length

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-text">Your rentals</h2>
        <p className="mt-1 font-body text-sm text-mid">
          {bookings.length === 0
            ? 'Gear you book shows up here with its dates and its deposit.'
            : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}${live > 0 ? ` · ${live} in flight` : ''}`}
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<Tent className="h-5 w-5" strokeWidth={1.5} />}
          title="Nothing booked yet."
          body="Tents, packs and stoves, by the day — booked here, collected in Dehradun or posted to you."
          action={{ label: 'Browse the locker', href: '/rent' }}
        />
      ) : (
        <ul className="space-y-4">
          {bookings.map((b) => {
            const owed = (b.late_fee ?? 0) + (b.damage_fee ?? 0)
            // The last end date on the booking: the rental is not over until
            // the last thing on it is due back, so that is what an extension
            // moves from.
            const live = (b.reservations ?? []).filter((r) => r.status !== 'cancelled')
            const endsOn = live.length
              ? live.reduce((a, r) => (r.ends_on > a ? r.ends_on : a), live[0].ends_on)
              : null
            return (
              <Surface as="li" key={b.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={b.status} map={RENTAL_STATUS} />
                    <span className="font-mono text-[13px] text-text">{b.booking_number}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[15px] tabular-nums text-text">{formatPrice(b.total_amount)}</p>
                    <p className="mt-1 font-mono text-[11px] text-mid">
                      {DEPOSIT_NOTE[b.deposit_state] ?? 'Deposit'} · {formatPrice(b.deposit_amount)}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-3 border-t border-rule-soft pt-4">
                  {b.reservations?.map((r) => (
                    <li key={r.id} className="flex items-center gap-3">
                      <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[var(--r-input)] border border-rule bg-paper-deep">
                        {r.item?.images?.[0] && (
                          <Image src={r.item.images[0]} alt="" fill sizes="48px" className="object-cover" />
                        )}
                      </span>
                      <span className="flex-1">
                        <span className="block font-body text-[15px] text-text">{r.item?.name ?? 'Gear'}</span>
                        <span className="block font-mono text-[11px] text-mid">
                          {pretty(r.starts_on)} → {pretty(r.ends_on)} · {r.days} day{r.days === 1 ? '' : 's'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                {owed > 0 && (
                  <p className="mt-3 font-body text-[13px] text-clay-deep">
                    Deducted from the deposit: {formatPrice(owed)}
                    {b.late_fee > 0 ? ` (late ${formatPrice(b.late_fee)})` : ''}
                    {b.damage_fee > 0 ? ` (damage ${formatPrice(b.damage_fee)})` : ''}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft pt-3">
                  <p className="font-body text-[13px] text-mid">
                    {b.status === 'reserved'
                      ? b.fulfilment === 'ship'
                        ? b.payment_status === 'paid'
                          ? 'Paid. We post it to arrive on the first day.'
                          // "Nothing is charged yet" was rendered in the same
                          // flex row as a Pay button for the amount due.
                          : 'We post it to arrive on the first day — pay below and we’ll get it packed.'
                        : 'Collect from the Dehradun shop on the first day. Bring this number and some ID.'
                      : b.status === 'out'
                        ? 'Bring it back by the end date — a late return is charged at the day rate, capped at the deposit.'
                        : 'Nothing left to do on this one.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Unpaid rentals get a way to pay before anything else —
                        it is the only action on the card that is blocking. */}
                    {b.payment_status !== 'paid' && b.status !== 'cancelled' && b.total_amount > 0 && (
                      <RentalPayButton
                        bookingId={b.id}
                        bookingNumber={b.booking_number}
                        amount={b.total_amount}
                        depositAmount={b.deposit_amount}
                        depositState={b.deposit_state}
                        fulfilment={b.fulfilment}
                      />
                    )}
                    {/* Extending is offered while the gear is reserved or out —
                        the two states where more days are a thing that can be
                        had. Once it is back, a new booking is the honest answer. */}
                    {(b.status === 'reserved' || b.status === 'out') && endsOn && (
                      <ExtendRental
                        bookingId={b.id}
                        bookingNumber={b.booking_number}
                        currentEnd={endsOn}
                      />
                    )}
                    {b.status === 'reserved' && (
                      <CancelRentalButton bookingId={b.id} number={b.booking_number} />
                    )}
                  </div>
                </div>
              </Surface>
            )
          })}
        </ul>
      )}
    </div>
  )
}
