'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Loader2, Plus, PackageCheck, PackageOpen, Ban, Pencil, CalendarDays, BarChart3, Sun,
  Search, AlertTriangle, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  addRentalUnits, setUnitCondition, handOverBooking, returnBooking, cancelRentalBooking,
} from '@/actions/rentals'
import { RentalItemEditor } from '@/components/admin/RentalItemEditor'
import RentalBookingOps from '@/components/admin/RentalBookingOps'
import RentalCounterPayment from '@/components/admin/RentalCounterPayment'
import RentalHistoryPanel from '@/components/admin/RentalHistoryPanel'
import { shopToday } from '@/lib/shopTime'
import type {
  RentalItem, RentalCategory, RentalUnit, RentalBooking, RentalReservation,
} from '@/types/database'

type ItemWithUnits = RentalItem & { units: RentalUnit[] }
type BookingWithLines = RentalBooking & { reservations: RentalReservation[] }

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const STATUS_TONE: Record<string, string> = {
  // Distinct from `reserved`, and deliberately the most urgent colour on the
  // screen: it is the only state with a deadline running against it.
  pending_payment: 'bg-orange-50 text-orange-800 border-orange-200',
  reserved: 'bg-amber-50 text-amber-800 border-amber-200',
  out: 'bg-blue-50 text-blue-800 border-blue-200',
  returned: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

/**
 * Running the gear locker.
 *
 * Two jobs that look similar and are not: keeping the catalogue (what can be
 * rented, and which physical units exist), and moving bookings through their
 * lifecycle (out, back, inspected, deposit settled). They are separate tabs
 * because the second one is done standing at a counter with somebody waiting.
 */
/** The lifecycle, plus the one filter that is not a stored value.
 *
 *  'Overdue' is resolved from the dates on the server — the rental council
 *  killed adding it to the status CHECK, because a stored flag is a function of
 *  dates that needs one sweep to set it and another to clear it, and is wrong
 *  in between. */
const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending_payment', label: 'Awaiting payment' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'out', label: 'Out' },
  { key: 'returned', label: 'Returned' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'Everything' },
]

export function RentalsClient({
  initialItems,
  bookings,
  total,
  page,
  perPage,
  status,
  query,
  categories,
}: {
  initialItems: ItemWithUnits[]
  bookings: BookingWithLines[]
  total: number
  page: number
  perPage: number
  status: string
  query: string
  categories: RentalCategory[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Read straight from props, NOT copied into state.
  //
  // `useState(initialBookings)` captures the first value and then ignores every
  // later one, so after `router.refresh()` the server had the new booking state
  // and this list was still rendering the old one — handing gear over appeared
  // to do nothing while the database said 'out'. Server data that this
  // component only reads has no business being state.
  const items = initialItems
  const [busy, setBusy] = useState<string | null>(null)
  const [term, setTerm] = useState(query)
  const today = shopToday()

  /** The filter lives in the URL because the LIST IS FETCHED ON THE SERVER —
   *  state held here could only hide rows already fetched, which is exactly
   *  what a `.limit(100)` with no filter does badly. */
  const go = useCallback(
    (next: { status?: string; q?: string; page?: number }) => {
      const p = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === '' || v === 'all' || v === 1) p.delete(k === 'page' ? 'page' : k)
        else p.set(k, String(v))
      }
      // Any change to what is being LOOKED at resets the page — otherwise
      // filtering to Overdue while on page 3 shows an empty list and reads as
      // "there are none".
      if (next.status !== undefined || next.q !== undefined) p.delete('page')
      const qs = p.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams],
  )

  const pages = Math.max(1, Math.ceil(total / perPage))
  const firstShown = total === 0 ? 0 : (page - 1) * perPage + 1
  const lastShown = Math.min(page * perPage, total)

  /** Gear still out past its end date. Computed from the rows on screen for the
   *  badge only — the FILTER is resolved on the server against every booking,
   *  not just this page. */
  const overdueDays = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of bookings) {
      if (b.status !== 'out') continue
      const due = b.reservations
        ?.filter((r) => r.status !== 'cancelled')
        .map((r) => r.ends_on)
        .sort()
        .at(-1)
      if (due && due < today) {
        m.set(b.id, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000))
      }
    }
    return m
  }, [bookings, today])
  const [newUnit, setNewUnit] = useState<Record<string, string>>({})
  const [damage, setDamage] = useState<Record<string, string>>({})
  // `null` = closed, 'new' = the add form, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(key)
    try {
      const res = await fn()
      if (!res.ok) { toast.error(res.error ?? 'That did not work.'); return }
      // An empty `done` means the caller has already said something more
      // specific than this helper could — "4 added, 2 already there" rather
      // than "Saved". An empty toast is worse than no toast.
      if (done) toast.success(done)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Rentals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gear for rent, the units behind it, and every booking in flight.
          </p>
        </div>
        {/* The three screens that answer questions this one cannot: "what am I
            doing today?", "when is that tent free?" and "which gear earns its
            shelf space?" */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/rentals/today"
            className="inline-flex items-center gap-1.5 rounded-md border border-forest bg-forest px-3 py-1.5 text-xs font-medium text-paper hover:bg-forest-mid"
          >
            <Sun className="h-3.5 w-3.5" aria-hidden="true" /> Today
          </Link>
          <Link
            href="/admin/rentals/calendar"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:border-gray-400"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Calendar
          </Link>
          <Link
            href="/admin/rentals/reports"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:border-gray-400"
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Utilisation
          </Link>
        </div>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue &amp; units</TabsTrigger>
        </TabsList>

        {/* ── Lifecycle ──────────────────────────────────────────────────── */}
        <TabsContent value="bookings" className="mt-4">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-lg">In flight</CardTitle>
                <CardDescription>
                  Handing over records the deposit. Returning computes the late fee from the dates —
                  it is never typed in — and settles what goes back.
                </CardDescription>
              </div>

              {/* ── Working the list ───────────────────────────────────────
                  Overdue leads, because a hire business does not lose money on
                  the booking it took — it loses money on the tent nobody
                  remembered was due back on Tuesday. This list used to be
                  newest-first with no filter, so a rental three days late sat
                  below forty newer ones and the word "overdue" appeared
                  nowhere in the admin at all. */}
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_TABS.map((t) => {
                  const on = status === t.key || (t.key === 'all' && status === 'all')
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => go({ status: t.key })}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                        on
                          ? 'border-forest bg-forest text-paper'
                          : 'border-gray-200 text-gray-600 hover:border-forest hover:text-forest'
                      }`}
                    >
                      {t.key === 'overdue' && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); go({ q: term.trim() }) }}
                  className="relative min-w-0 flex-1 basis-64"
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <Input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Booking number, email or phone"
                    aria-label="Find a booking"
                    className="h-9 pl-9 pr-8"
                  />
                  {term && (
                    <button
                      type="button"
                      onClick={() => { setTerm(''); go({ q: '' }) }}
                      aria-label="Clear the search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </form>

                {/* An exact count. A page that silently shows the first hundred
                    of an unknown number is a page that lies quietly. */}
                <p className="font-mono text-xs tabular-nums text-gray-500" aria-live="polite">
                  {total === 0 ? 'none' : `${firstShown}–${lastShown} of ${total}`}
                </p>

                {pages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button" disabled={page <= 1} onClick={() => go({ page: page - 1 })}
                      aria-label="The page before"
                      className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:border-gray-400 disabled:cursor-not-allowed disabled:text-gray-300"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-mono text-xs tabular-nums text-gray-500">{page}/{pages}</span>
                    <button
                      type="button" disabled={page >= pages} onClick={() => go({ page: page + 1 })}
                      aria-label="The page after"
                      className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:border-gray-400 disabled:cursor-not-allowed disabled:text-gray-300"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookings.length === 0 && (
                <p className="text-sm text-gray-500">
                  {query
                    ? `Nothing matches “${query}”.`
                    : status === 'overdue'
                      ? 'Nothing is overdue. Everything out is still inside its dates.'
                      : status === 'pending_payment'
                        // Empty here is the healthy state, and saying so stops
                        // it reading as a broken filter.
                        ? 'Nobody is mid-payment. Holds appear here for their fifteen minutes and then either become reservations or release themselves.'
                        : status === 'all'
                          ? 'No bookings yet.'
                          : `Nothing is ${STATUS_TABS.find((t) => t.key === status)?.label.toLowerCase() ?? status} right now.`}
                </p>
              )}

              {bookings.map((b) => {
                const owed = b.late_fee + b.damage_fee
                const late = overdueDays.get(b.id)
                const balance = Math.max(0, b.total_amount - (b.amount_paid ?? 0))
                return (
                  <div
                    key={b.id}
                    className={`rounded-md border p-4 ${
                      // An overdue booking is marked on the card, not only by
                      // being findable under a filter — the list is scanned far
                      // more often than it is filtered.
                      late ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-gray-900">{b.booking_number}</span>
                          <Badge variant="outline" className={STATUS_TONE[b.status]}>{b.status}</Badge>
                          <Badge variant="outline">{b.fulfilment === 'ship' ? 'Posted' : 'Collection'}</Badge>
                          {late && (
                            <Badge variant="outline" className="border-red-300 bg-red-100 text-red-800">
                              {late} day{late === 1 ? '' : 's'} overdue
                            </Badge>
                          )}
                          {/* Unpaid is a state worth seeing without opening
                              anything: every booking this shop has taken is a
                              counter sale, and until now nothing could move one
                              off 'unpaid'. */}
                          {b.status !== 'cancelled' && balance > 0 && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                              {money(balance)} unpaid
                            </Badge>
                          )}
                          {/* Why a booking is cancelled matters more than that
                              it is: an expired hold took no money and needs no
                              action, while a shop cancellation was refunded in
                              full and a customer one was not. */}
                          {b.status === 'cancelled' && b.cancelled_by && (
                            <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-700">
                              {b.cancelled_by === 'expired'
                                ? 'hold expired'
                                : b.cancelled_by === 'shop'
                                  ? 'we cancelled · refunded in full'
                                  : `customer cancelled${(b.rent_refunded ?? 0) > 0 ? ` · ${money(b.rent_refunded ?? 0)} back` : ''}`}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{b.email}{b.phone ? ` · ${b.phone}` : ''}</p>
                        <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
                          {b.reservations?.map((r) => (
                            <li key={r.id}>
                              {r.item?.name ?? 'Item'}{' '}
                              <span className="font-mono text-xs text-gray-500">
                                {r.unit?.code} · {r.starts_on} → {r.ends_on} · {r.days}d
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-right text-sm">
                        <p className="font-medium text-gray-900">{money(b.total_amount)}</p>
                        <p className="text-xs text-gray-500">deposit {money(b.deposit_amount)} · {b.deposit_state}</p>
                        {owed > 0 && (
                          <p className="text-xs text-red-700">
                            late {money(b.late_fee)} · damage {money(b.damage_fee)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Money first. It is the thing standing between this
                        booking and a receipt, an invoice and a set of books
                        that balance. */}
                    {b.status !== 'cancelled' && (
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <RentalCounterPayment
                          bookingId={b.id}
                          balance={balance}
                          depositAmount={b.deposit_amount}
                          depositState={b.deposit_state}
                          depositMethod={b.deposit_method ?? 'cash'}
                        />
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                      <RentalHistoryPanel bookingId={b.id} />
                      <RentalBookingOps
                        bookingId={b.id}
                        fulfilment={b.fulfilment}
                        status={b.status}
                        depositAmount={b.deposit_amount}
                        depositState={b.deposit_state}
                        depositRefunded={b.deposit_refunded ?? 0}
                        outTracking={b.out_tracking ?? null}
                        returnTracking={b.return_tracking ?? null}
                      />
                      {(b.status === 'reserved' || b.status === 'pending_payment') && (
                        <>
                          <Button
                            size="sm"
                            // Gear does not leave against an unpaid hold. The
                            // counter-payment control above is the way through
                            // for somebody standing at the door — it confirms
                            // the hold and then this becomes available.
                            disabled={busy === b.id || b.status === 'pending_payment'}
                            onClick={() => run(b.id, () => handOverBooking(b.id, b.deposit_amount), 'Handed over, deposit recorded')}
                          >
                            {busy === b.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <PackageOpen className="mr-2 h-3.5 w-3.5" />}
                            Hand over &amp; take {money(b.deposit_amount)}
                          </Button>
                          <Button
                            size="sm" variant="ghost" disabled={busy === b.id}
                            onClick={() => run(b.id, () => cancelRentalBooking(b.id, 'Cancelled by the shop'), 'Cancelled — refunded in full, dates freed')}
                            /* Says what it will DO. A shop-initiated
                               cancellation always refunds everything, and an
                               operator clicking a button labelled only "Cancel"
                               has no way to know that from the screen. */
                            title="The customer is refunded in full — the shop never keeps money on a cancellation it caused."
                          >
                            <Ban className="mr-2 h-3.5 w-3.5" /> Cancel &amp; refund in full
                          </Button>
                        </>
                      )}

                      {b.status === 'out' && (
                        <>
                          <Input
                            className="h-9 w-40"
                            placeholder="Damage ₹ (optional)"
                            value={damage[b.id] ?? ''}
                            onChange={(e) => setDamage((d) => ({ ...d, [b.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            disabled={busy === b.id}
                            onClick={() =>
                              run(
                                b.id,
                                () =>
                                  returnBooking({
                                    bookingId: b.id,
                                    damageFee: Math.round((Number(damage[b.id]) || 0) * 100),
                                    damageNote: damage[b.id] ? 'Assessed on return' : undefined,
                                  }),
                                'Returned and settled',
                              )
                            }
                          >
                            {busy === b.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="mr-2 h-3.5 w-3.5" />}
                            Mark returned
                          </Button>
                          <span className="text-xs text-gray-500">
                            Late fees are calculated from the end date, not entered.
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Catalogue ──────────────────────────────────────────────────── */}
        <TabsContent value="catalogue" className="mt-4">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-lg">Gear and units</CardTitle>
                <CardDescription>
                  Every physical copy is a row, so you know which one came back damaged. A unit in
                  repair or retired is never offered, and keeps its history.
                </CardDescription>
              </div>
              <Button size="sm" variant={editing === 'new' ? 'ghost' : 'default'} onClick={() => setEditing(editing === 'new' ? null : 'new')}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {editing === 'new' ? 'Close' : 'Add gear'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {editing === 'new' && (
                <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4">
                  <RentalItemEditor categories={categories} onDone={() => setEditing(null)} />
                </div>
              )}
              {items.map((it) => (
                <div key={it.id} className="rounded-md border border-gray-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <span className="font-medium text-gray-900">{it.name}</span>
                      <span className="ml-2 font-mono text-xs text-gray-500">{it.slug}</span>
                      {/* An unfiled item still renders on the storefront, under
                          "Everything else" — so this is a nudge, not an alarm. */}
                      <Badge
                        variant="outline"
                        className={`ml-2 ${it.category ? 'bg-forest/10 text-forest border-forest/20' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {it.category?.name ?? 'unfiled'}
                      </Badge>
                      {!it.is_active && <Badge variant="outline" className="ml-2 bg-gray-100 text-gray-600">unlisted</Badge>}
                      {(!it.images || it.images.length === 0) && (
                        // Said plainly, because a photographless item renders
                        // as "Photograph to come" on the storefront and looks
                        // broken to a customer.
                        <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-800 border-amber-200">no photo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs text-gray-600">
                        {money(it.daily_rate)}/day · deposit {money(it.deposit)} · GST {it.gst_rate}%
                        {it.buffer_days > 0 && ` · ${it.buffer_days}d turnaround`}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(editing === it.id ? null : it.id)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        {editing === it.id ? 'Close' : 'Edit'}
                      </Button>
                    </div>
                  </div>

                  {editing === it.id && (
                    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50/60 p-4">
                      <RentalItemEditor item={it} categories={categories} onDone={() => setEditing(null)} />
                    </div>
                  )}

                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {it.units?.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-xs">{u.code}</TableCell>
                          <TableCell>
                            <Select
                              value={u.condition}
                              onValueChange={(v) =>
                                run(u.id, () => setUnitCondition(u.id, v as 'good' | 'fair' | 'repair' | 'retired'), `${u.code} → ${v}`)
                              }
                            >
                              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="fair">Fair</SelectItem>
                                <SelectItem value="repair">In repair</SelectItem>
                                <SelectItem value="retired">Retired</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{u.notes ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* The shop buys gear in BATCHES. One field and one button
                      per tent meant six trips through a form and six refreshes
                      to stock a delivery; `expandUnitCodes` understands the
                      list or the range somebody would write on the note that
                      came with it. */}
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`u-${it.id}`} className="text-xs">Add units</Label>
                      <Input
                        id={`u-${it.id}`} className="h-9 w-72" placeholder="FST-005, or FST-005..010"
                        value={newUnit[it.id] ?? ''}
                        onChange={(e) => setNewUnit((n) => ({ ...n, [it.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm" variant="outline"
                      disabled={!newUnit[it.id]?.trim() || busy === it.id}
                      onClick={() =>
                        run(it.id, async () => {
                          const res = await addRentalUnits(it.id, newUnit[it.id] ?? '')
                          if (res.ok) {
                            setNewUnit((n) => ({ ...n, [it.id]: '' }))
                            // "6 added" and "4 added, 2 already there" are
                            // different facts about a shelf, and somebody
                            // counting tents needs the second one.
                            toast.success(
                              res.skipped > 0
                                ? `${res.added} added · ${res.skipped} already on the shelf`
                                : `${res.added} unit${res.added === 1 ? '' : 's'} added`,
                            )
                          }
                          return res
                        }, '')
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                    </Button>
                    <p className="text-[11px] text-gray-500">
                      A list, or a range — the width of the first number is kept.
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
