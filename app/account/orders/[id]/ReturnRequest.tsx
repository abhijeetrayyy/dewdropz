'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestReturn } from '@/actions/returns'

// The customer's way back. Until now a return meant emailing and hoping — the
// policy was promised on the product page and in the FAQ with nothing behind it.

type Line = { orderItemId: string; name: string; unitPrice: number; returnable: number }

const REASONS = [
  'Doesn’t fit',
  'Not what I expected',
  'Arrived damaged',
  'Wrong item sent',
  'Print quality',
  'Changed my mind',
]

export default function ReturnRequest({
  orderId,
  lines,
}: {
  orderId: string
  lines: Line[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [reason, setReason] = useState(REASONS[0])
  const [note, setNote] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const returnable = lines.filter((l) => l.returnable > 0)
  const chosen = returnable.filter((l) => (qty[l.orderItemId] ?? 0) > 0)
  const refundEstimate = chosen.reduce((sum, l) => sum + l.unitPrice * (qty[l.orderItemId] ?? 0), 0)

  function submit() {
    if (!chosen.length) { setError('Choose at least one item.'); return }
    setError(null)
    start(async () => {
      const res = await requestReturn({
        orderId, reason, note: note || undefined,
        items: chosen.map((l) => ({ orderItemId: l.orderItemId, quantity: qty[l.orderItemId] })),
      })
      if ('error' in res) { setError(res.error ?? 'Could not request return'); return }
      setDone(res.rmaNumber)
      setOpen(false)
      router.refresh()
    })
  }

  if (done) {
    return (
      <div className="mt-10 rounded-sm border border-rule bg-paper-warm p-5">
        <div className="font-body text-sm text-text">Return requested — {done}</div>
        <p className="mt-1 font-body text-xs text-mid">
          We’ll review it and email you what to do next. Nothing is charged or refunded until the parcel is back with us.
        </p>
      </div>
    )
  }

  if (!returnable.length) return null

  return (
    <div className="mt-10 border-t border-rule pt-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-body text-xs uppercase tracking-[0.1em] text-forest underline underline-offset-4"
        >
          Return an item
        </button>
      ) : (
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-body text-xs uppercase tracking-[0.1em] text-mid">Return an item</h2>
            <button type="button" onClick={() => setOpen(false)} className="font-body text-xs text-mid hover:text-text">
              Cancel
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {returnable.map((l) => (
              <label key={l.orderItemId} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-text">{l.name}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={l.returnable}
                    value={qty[l.orderItemId] ?? 0}
                    onChange={(e) =>
                      setQty({ ...qty, [l.orderItemId]: Math.max(0, Math.min(l.returnable, Number(e.target.value))) })
                    }
                    className="w-16 rounded-sm border border-rule px-2 py-1 text-right tabular-nums"
                  />
                  <span className="w-12 font-body text-xs text-mid">of {l.returnable}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="font-body text-xs text-mid" htmlFor="return-reason">Reason</label>
            <select
              id="return-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-sm border border-rule bg-transparent px-3 py-2 text-sm text-text"
            >
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else we should know? (optional)"
            rows={2}
            className="mt-3 w-full rounded-sm border border-rule bg-transparent px-3 py-2 text-sm text-text"
          />

          {/* An estimate, and labelled as one: what is actually refunded is
              decided when the parcel is inspected, and promising a number here
              that later changes is worse than not showing one. */}
          {refundEstimate > 0 && (
            <p className="mt-3 font-body text-xs text-mid">
              Estimated refund ₹{(refundEstimate / 100).toLocaleString('en-IN')} — confirmed once we have the item back.
            </p>
          )}

          {error && <p className="mt-3 font-body text-xs text-ember">{error}</p>}

          <button
            type="button" onClick={submit} disabled={pending}
            className="mt-4 rounded-full bg-forest px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.12em] text-paper disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Request return'}
          </button>
        </div>
      )}
    </div>
  )
}
