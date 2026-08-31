'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loader2, Plus, PackageCheck, PackageOpen, Ban, Pencil, CalendarDays, BarChart3, Sun } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  addRentalUnit, setUnitCondition, handOverBooking, returnBooking, cancelRentalBooking,
} from '@/actions/rentals'
import { RentalItemEditor } from '@/components/admin/RentalItemEditor'
import RentalBookingOps from '@/components/admin/RentalBookingOps'
import type { RentalItem, RentalUnit, RentalBooking, RentalReservation } from '@/types/database'

type ItemWithUnits = RentalItem & { units: RentalUnit[] }
type BookingWithLines = RentalBooking & { reservations: RentalReservation[] }

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const STATUS_TONE: Record<string, string> = {
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
export function RentalsClient({
  initialItems,
  initialBookings,
}: {
  initialItems: ItemWithUnits[]
  initialBookings: BookingWithLines[]
}) {
  const router = useRouter()
  // Read straight from props, NOT copied into state.
  //
  // `useState(initialBookings)` captures the first value and then ignores every
  // later one, so after `router.refresh()` the server had the new booking state
  // and this list was still rendering the old one — handing gear over appeared
  // to do nothing while the database said 'out'. Server data that this
  // component only reads has no business being state.
  const items = initialItems
  const bookings = initialBookings
  const [busy, setBusy] = useState<string | null>(null)
  const [newUnit, setNewUnit] = useState<Record<string, string>>({})
  const [damage, setDamage] = useState<Record<string, string>>({})
  // `null` = closed, 'new' = the add form, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(key)
    try {
      const res = await fn()
      if (!res.ok) { toast.error(res.error ?? 'That did not work.'); return }
      toast.success(done)
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
            <CardHeader>
              <CardTitle className="text-lg">In flight</CardTitle>
              <CardDescription>
                Handing over records the deposit. Returning computes the late fee from the dates —
                it is never typed in — and settles what goes back.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookings.length === 0 && <p className="text-sm text-gray-500">No bookings yet.</p>}

              {bookings.map((b) => {
                const owed = b.late_fee + b.damage_fee
                return (
                  <div key={b.id} className="rounded-md border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-900">{b.booking_number}</span>
                          <Badge variant="outline" className={STATUS_TONE[b.status]}>{b.status}</Badge>
                          <Badge variant="outline">{b.fulfilment === 'ship' ? 'Posted' : 'Collection'}</Badge>
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

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
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
                      {b.status === 'reserved' && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy === b.id}
                            onClick={() => run(b.id, () => handOverBooking(b.id, b.deposit_amount), 'Handed over, deposit recorded')}
                          >
                            {busy === b.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <PackageOpen className="mr-2 h-3.5 w-3.5" />}
                            Hand over &amp; take {money(b.deposit_amount)}
                          </Button>
                          <Button
                            size="sm" variant="ghost" disabled={busy === b.id}
                            onClick={() => run(b.id, () => cancelRentalBooking(b.id, 'Cancelled in admin'), 'Cancelled — dates freed')}
                          >
                            <Ban className="mr-2 h-3.5 w-3.5" /> Cancel
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
                  <RentalItemEditor onDone={() => setEditing(null)} />
                </div>
              )}
              {items.map((it) => (
                <div key={it.id} className="rounded-md border border-gray-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <span className="font-medium text-gray-900">{it.name}</span>
                      <span className="ml-2 font-mono text-xs text-gray-500">{it.slug}</span>
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
                      <RentalItemEditor item={it} onDone={() => setEditing(null)} />
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

                  <div className="mt-3 flex items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`u-${it.id}`} className="text-xs">Add a unit</Label>
                      <Input
                        id={`u-${it.id}`} className="h-9 w-40" placeholder="e.g. FST-005"
                        value={newUnit[it.id] ?? ''}
                        onChange={(e) => setNewUnit((n) => ({ ...n, [it.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm" variant="outline"
                      disabled={!newUnit[it.id]?.trim() || busy === it.id}
                      onClick={() =>
                        run(it.id, async () => {
                          const res = await addRentalUnit(it.id, newUnit[it.id])
                          if (res.ok) setNewUnit((n) => ({ ...n, [it.id]: '' }))
                          return res
                        }, 'Unit added')
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                    </Button>
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
