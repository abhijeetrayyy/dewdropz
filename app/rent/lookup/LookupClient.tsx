'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import { findRentalBooking } from '@/actions/rentals'
import { formatPrice } from '@/lib/utils'
import type { RentalBooking, RentalReservation } from '@/types/database'

type Found = RentalBooking & { reservations: RentalReservation[] }

const STATUS: Record<string, string> = {
  reserved: 'Held for you', out: 'With you', returned: 'Returned',
  closed: 'Closed', cancelled: 'Cancelled',
}
const DEPOSIT: Record<string, string> = {
  pending: 'Deposit due at the counter', held: 'Deposit held',
  refunded: 'Deposit returned', forfeited: 'Deposit kept', waived: 'Deposit waived',
}

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })

export default function LookupClient() {
  const [number, setNumber] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [found, setFound] = useState<Found | null>(null)

  async function look(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setFound(null)
    try {
      const res = await findRentalBooking(number, email)
      if (!res.ok) { setError(res.error); return }
      setFound(res.booking as Found)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form onSubmit={look} className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Booking number</span>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="DDZ-R-20260828-ZT4ZZ"
            className="mt-1 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-mono text-sm uppercase text-ink"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">Email you used</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-[var(--r-input)] border border-rule bg-surface px-3 py-2 font-body text-sm text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-[22px] inline-flex h-[42px] items-center justify-center gap-2 rounded-full bg-forest px-6 font-body text-sm text-paper disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find it
        </button>
      </form>

      {error && <p className="mt-4 font-body text-[14px] text-clay-deep">{error}</p>}

      {found && (
        <div className="mt-8 rounded-[var(--r-panel)] border border-rule bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-sage">
                {STATUS[found.status] ?? found.status}
              </p>
              <p className="mt-1 font-mono text-lg text-ink">{found.booking_number}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[15px] tabular-nums text-ink">{formatPrice(found.total_amount)}</p>
              <p className="font-mono text-[11px] text-mid">
                {DEPOSIT[found.deposit_state] ?? 'Deposit'} · {formatPrice(found.deposit_amount)}
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {found.reservations?.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[var(--r-card)] bg-paper-deep">
                  {r.item?.images?.[0] && (
                    <Image src={r.item.images[0]} alt="" fill sizes="48px" className="object-cover" />
                  )}
                </span>
                <span>
                  <span className="block font-body text-[15px] text-ink">{r.item?.name ?? 'Gear'}</span>
                  <span className="block font-mono text-[11px] text-mid">
                    {day(r.starts_on)} → {day(r.ends_on)} · {r.days} day{r.days === 1 ? '' : 's'}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 border-t border-rule pt-4 font-body text-[14px] leading-relaxed text-mid">
            {found.fulfilment === 'ship'
              ? 'We post it to arrive on the first day of your booking.'
              : 'Collect from the Dehradun shop on the first day. Bring this number and some ID.'}{' '}
            Make an account with this email and it will show up under your rentals automatically.
          </p>
        </div>
      )}
    </>
  )
}
