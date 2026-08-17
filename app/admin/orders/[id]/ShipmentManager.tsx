'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createShipment, updateShipment, updateShipmentStatus, type ShipmentStatus } from '@/actions/shipments'

// Parcel management. Until now the team could CREATE a shipment from the orders
// list and then nothing — no way to step its status, correct an AWB, or add a
// second parcel. That left the customer's tracking frozen at whatever it was on
// day one, which is worse than not showing tracking at all.

type Line = { orderItemId: string; name: string; ordered: number; shipped: number; remaining: number }
type Event = { id: string; status: string; description: string | null; occurred_at: string }
type Shipment = {
  id: string
  courier_name: string | null
  awb: string | null
  tracking_url: string | null
  status: string
  events?: Event[]
}

// The order a parcel actually moves in, so the next step is always one click
// rather than a dropdown of nine states most of which are backwards.
const NEXT: Record<string, ShipmentStatus[]> = {
  pending: ['label_created', 'cancelled'],
  label_created: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['out_for_delivery', 'failed', 'rto'],
  out_for_delivery: ['delivered', 'failed', 'rto'],
  failed: ['out_for_delivery', 'rto'],
  delivered: [],
  rto: [],
  cancelled: [],
}

const LABEL: Record<string, string> = {
  pending: 'Packed', label_created: 'Label created', picked_up: 'Picked up',
  in_transit: 'In transit', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', failed: 'Delivery failed', rto: 'Returning', cancelled: 'Cancelled',
}

export default function ShipmentManager({
  orderId,
  shipments,
  fulfillment,
}: {
  orderId: string
  shipments: Shipment[]
  fulfillment: { lines: Line[]; itemised: boolean; fullyShipped: boolean }
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ courier: '', awb: '', url: '' })
  // Correcting a parcel. `updateShipment` has existed and been admin-guarded
  // since shipping was built, with zero callers — so a mistyped digit in a
  // 12-digit AWB, the most routine packing-desk error there is, could only be
  // fixed with a SQL client.
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ courier: '', awb: '', url: '' })
  const [error, setError] = useState<string | null>(null)
  // Which lines go in THIS box. Defaults to everything still owed, because
  // shipping the whole remainder is the common case and should need no clicks.
  const [pack, setPack] = useState<Record<string, number>>({})

  const owed = fulfillment.lines.filter((l) => l.remaining > 0)
  const splitting = owed.length > 1 || owed.some((l) => l.remaining < l.ordered)

  function step(shipmentId: string, status: ShipmentStatus) {
    setError(null)
    start(async () => {
      const res = await updateShipmentStatus(shipmentId, status)
      if (res && 'error' in res) setError(res.error ?? 'Could not update parcel')
      else router.refresh()
    })
  }

  function addParcel() {
    if (!form.courier || !form.awb) { setError('Courier and AWB are required'); return }
    setError(null)
    start(async () => {
      // Only send items when the team actually chose a subset. Sending the full
      // remainder explicitly would be equivalent but writes rows for nothing —
      // absent rows already mean "everything", by design.
      const chosen = Object.entries(pack)
        .filter(([, q]) => q > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
      const isSubset =
        chosen.length > 0 && chosen.some((c) => {
          const line = owed.find((l) => l.orderItemId === c.orderItemId)
          return !line || c.quantity < line.remaining || chosen.length < owed.length
        })

      const res = await createShipment({
        orderId, courierName: form.courier, awb: form.awb, trackingUrl: form.url || undefined,
        items: isSubset ? chosen : undefined,
      })
      if ('error' in res) { setError(res.error ?? 'Could not add parcel'); return }
      setForm({ courier: '', awb: '', url: '' })
      setPack({})
      setAdding(false)
      router.refresh()
    })
  }

  function beginEdit(shipment: Shipment) {
    setEditing(shipment.id)
    setEditForm({
      courier: shipment.courier_name ?? '',
      awb: shipment.awb ?? '',
      url: shipment.tracking_url ?? '',
    })
    setError(null)
  }

  function saveEdit(shipmentId: string) {
    if (!editForm.courier || !editForm.awb) { setError('Courier and AWB are required'); return }
    setError(null)
    start(async () => {
      const res = await updateShipment(shipmentId, {
        courierName: editForm.courier,
        awb: editForm.awb,
        trackingUrl: editForm.url || undefined,
      })
      // Surfaced rather than assumed. The case someone actually hits here is
      // correcting a typo to a number that is already on another parcel — the
      // unique index rejects it and this is where they need to be told.
      if (res && 'error' in res) { setError(res.error ?? 'Could not update parcel'); return }
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Parcels {shipments.length > 0 && <span className="text-neutral-400">({shipments.length})</span>}
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-medium text-neutral-900 underline underline-offset-4"
        >
          {adding ? 'Cancel' : 'Add parcel'}
        </button>
      </div>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {/* What is still owed. Without this the team could only see that a parcel
          existed, never whether the order was actually complete. */}
      {!fulfillment.fullyShipped && owed.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Still to ship:{' '}
          {owed.map((l, i) => (
            <span key={l.orderItemId}>
              {i > 0 && ', '}
              {l.name} ×{l.remaining}
            </span>
          ))}
        </div>
      )}
      {fulfillment.fullyShipped && shipments.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">Every item on this order has shipped.</p>
      )}

      {adding && splitting && (
        <div className="mt-4 rounded border border-neutral-200 p-3">
          <p className="text-xs font-medium text-neutral-900">What goes in this box?</p>
          <p className="mt-0.5 text-xs text-neutral-500">Leave all at full quantity to ship everything remaining.</p>
          <div className="mt-2 space-y-1.5">
            {owed.map((l) => (
              <label key={l.orderItemId} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-neutral-700">{l.name}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={l.remaining}
                    value={pack[l.orderItemId] ?? l.remaining}
                    onChange={(e) =>
                      setPack({ ...pack, [l.orderItemId]: Math.max(0, Math.min(l.remaining, Number(e.target.value))) })
                    }
                    className="w-16 rounded border border-neutral-300 px-2 py-1 text-right tabular-nums"
                  />
                  <span className="w-10 text-neutral-400">of {l.remaining}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {adding && (
        <div className="mt-3 grid gap-2 rounded border border-neutral-200 p-3 sm:grid-cols-3">
          <input
            value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })}
            placeholder="Courier *" className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <input
            value={form.awb} onChange={(e) => setForm({ ...form, awb: e.target.value })}
            placeholder="AWB *" className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <input
            value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="Tracking URL" className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button" onClick={addParcel} disabled={pending}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs uppercase tracking-wide text-white disabled:opacity-50 sm:col-span-3"
          >
            {pending ? 'Saving…' : 'Add parcel'}
          </button>
        </div>
      )}

      {shipments.length === 0 && !adding && (
        <p className="mt-3 text-sm text-neutral-400">Nothing shipped yet.</p>
      )}

      <div className="mt-4 space-y-3">
        {shipments.map((s, i) => (
          <div key={s.id} className="rounded border border-neutral-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-neutral-900">
                {shipments.length > 1 && <span className="mr-2 text-xs text-neutral-400">{String(i + 1).padStart(2, '0')}</span>}
                {s.courier_name ?? 'Parcel'}
                {s.awb && <span className="ml-2 font-mono text-xs text-neutral-500">{s.awb}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                  {LABEL[s.status] ?? s.status}
                </span>
                {/* Opens in a new tab and prints itself — the packer's hands are
                    on a box, not on a mouse. */}
                <a
                  href={`/api/admin/packing-slip/${s.id}`} target="_blank" rel="noopener"
                  title="Printable slip for this parcel"
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"
                >
                  Packing slip
                </a>
                <button
                  type="button" onClick={() => beginEdit(s)} disabled={pending}
                  title="Correct courier or AWB"
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50"
                >
                  Edit
                </button>
              </div>
            </div>

            {editing === s.id && (
              <div className="mt-3 grid gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  value={editForm.courier} onChange={(e) => setEditForm({ ...editForm, courier: e.target.value })}
                  placeholder="Courier *" className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
                <input
                  value={editForm.awb} onChange={(e) => setEditForm({ ...editForm, awb: e.target.value })}
                  placeholder="AWB *" className="rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm"
                />
                <input
                  value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  placeholder="Tracking URL" className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => saveEdit(s.id)} disabled={pending}
                    className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {pending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button" onClick={() => setEditing(null)} disabled={pending}
                    className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Only forward moves are offered — a parcel cannot un-deliver. */}
            {NEXT[s.status]?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {NEXT[s.status].map((next) => (
                  <button
                    key={next} type="button" disabled={pending}
                    onClick={() => step(s.id, next)}
                    className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50"
                  >
                    Mark {LABEL[next].toLowerCase()}
                  </button>
                ))}
              </div>
            )}

            {s.events && s.events.length > 0 && (
              <ol className="mt-3 space-y-1 border-t border-neutral-100 pt-2">
                {[...s.events]
                  .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                  .map((e) => (
                    <li key={e.id} className="flex gap-3 text-xs text-neutral-500">
                      <span className="w-24 shrink-0 tabular-nums">
                        {new Date(e.occurred_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <span>{LABEL[e.status] ?? e.status}{e.description ? ` — ${e.description}` : ''}</span>
                    </li>
                  ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
