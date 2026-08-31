import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRentalUtilisation } from '@/actions/rentalReports'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Rental utilisation — DEWDROPZ Admin' }

/**
 * Which gear earns its shelf space.
 *
 * UNIT-DAYS, NOT BOOKINGS, and the distinction is why this report is worth
 * having. A tent booked once for ten days and a tent booked ten times for a day
 * each have identical utilisation and are very different businesses — but
 * ranking by BOOKINGS puts the second far above the first and would tell you to
 * buy more of the wrong thing.
 *
 * The denominator is days a unit existed and was serviceable, so a tent bought
 * halfway through the window is not punished for the half it did not exist for.
 * Everything here has been derivable from `rental_reservations` since the system
 * shipped; nothing had ever read it.
 */
export default async function RentalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const report = await getRentalUtilisation({ from: sp.from, to: sp.to })

  const pretty = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div>
        <Link
          href="/admin/rentals"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-mid hover:text-forest"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Rentals
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink">Utilisation</h1>
        <p className="mt-1 max-w-prose font-body text-sm text-mid">
          {pretty(report.from)} to {pretty(report.to)}. Utilisation is unit-days out against
          unit-days available — not bookings, because ten one-day rentals and one ten-day rental
          are the same use of a shelf.
        </p>
      </div>

      {/* ── Totals ────────────────────────────────────────────────────────── */}
      <div className="grid gap-px overflow-hidden rounded-[var(--r-panel)] border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: 'Utilisation', v: `${report.totals.utilisation}%`, hint: `${report.totals.bookedDays} of ${report.totals.unitDays} unit-days` },
          { k: 'Rent collected', v: formatPrice(report.totals.rent), hint: `${report.totals.units} units on the shelf` },
          { k: 'Late fees', v: formatPrice(report.totals.late), hint: 'Taken from deposits' },
          { k: 'Damage', v: formatPrice(report.totals.damage), hint: 'Assessed at return' },
        ].map((s) => (
          <div key={s.k} className="bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mid">{s.k}</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-ink">{s.v}</p>
            <p className="mt-1 font-body text-xs text-light">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* ── Per item ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-[var(--r-panel)] border border-rule bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[46rem] border-collapse">
          <thead>
            <tr className="border-b border-rule bg-paper-warm">
              {['Item', 'Units', 'Booked', 'Available', 'Utilisation', 'Rentals', 'Rent', 'Late', 'Damage'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-mid ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center font-body text-sm text-mid">
                  Nothing was rented in this window.
                </td>
              </tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.item_id} className="border-b border-rule-warm last:border-b-0">
                <td className="px-4 py-3 font-body text-sm text-ink">{r.name}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-mid">{r.units}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-mid">{r.booked_days}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-mid">{r.unit_days}</td>
                <td className="px-4 py-3 text-right">
                  {/* A bar as well as a number: a column of percentages is a
                      column of percentages, and the point of this report is to
                      see which two rows are unlike the others. */}
                  <div className="flex items-center justify-end gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-deep">
                      <span
                        className="block h-full rounded-full bg-forest"
                        style={{ width: `${Math.min(100, Number(r.utilisation))}%` }}
                      />
                    </span>
                    <span className="w-12 text-right font-mono text-xs tabular-nums text-ink">
                      {Number(r.utilisation).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-mid">{r.bookings}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink">{formatPrice(Number(r.rent_collected))}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-mid">{formatPrice(Number(r.late_collected))}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-mid">{formatPrice(Number(r.damage_collected))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-prose font-body text-xs text-light">
        Late and damage figures are apportioned to items by their share of a booking&rsquo;s rent,
        because a booking can carry several items and the fee is charged once against the whole of
        it. A single-item booking is exact; a mixed one is an allocation and is marked as such here
        rather than presented as a measurement.
      </p>
    </div>
  )
}
