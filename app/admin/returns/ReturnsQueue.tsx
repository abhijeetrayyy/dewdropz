'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { decideReturn, receiveReturn } from '@/actions/returns'

type Item = { order_item_id: string; quantity: number; restock: boolean }
type Ret = {
  id: string
  rma_number: string | null
  status: string
  reason: string
  customer_note: string | null
  refund_amount: number | null
  created_at: string
  order_id: string
  items: Item[]
  order: { order_number: string; email: string } | null
}

// The lifecycle, in the order it actually happens. Anything terminal offers
// nothing, so the queue never invites a move that cannot be made.
const ACTIONS: Record<string, ('approve' | 'reject' | 'receive')[]> = {
  requested: ['approve', 'reject'],
  approved: ['receive'],
  in_transit: ['receive'],
  received: [],
  refunded: [],
  rejected: [],
  cancelled: [],
}

const TABS = ['requested', 'approved', 'received', 'refunded', 'rejected'] as const

export default function ReturnsQueue({
  returns, counts, tab, page, total, pageSize,
}: {
  returns: Ret[]
  counts: Record<string, number>
  tab: string
  page: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Refund is entered in rupees because this is a human typing a number, and
  // paise in a text box is how you refund a hundred times too much.
  const [refund, setRefund] = useState<Record<string, string>>({})

  // Already filtered by the server; the browser no longer holds every return.
  const shown = returns
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  function act(r: Ret, action: 'approve' | 'reject' | 'receive') {
    setError(null)
    start(async () => {
      let res
      if (action === 'receive') {
        const rupees = Number(refund[r.id] ?? '')
        res = await receiveReturn({
          returnId: r.id,
          refundAmount: rupees > 0 ? Math.round(rupees * 100) : undefined,
        })
      } else {
        res = await decideReturn(r.id, action === 'approve' ? 'approved' : 'rejected')
      }
      if (res && 'error' in res) setError(res.error ?? 'Could not update return')
      else router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Returns</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {total} {tab}{total === 1 ? '' : ''}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t} href={`/admin/returns?tab=${t}`}
            className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
              tab === t ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-600'
            }`}
          >
            {t} <span className="opacity-60">{counts[t] ?? 0}</span>
          </Link>
        ))}
      </div>

      {error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="mt-6 space-y-3">
        {shown.length === 0 && <p className="text-sm text-neutral-400">Nothing {tab}.</p>}

        {shown.map((r) => (
          <div key={r.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-mono text-sm text-neutral-900">{r.rma_number}</span>
                <Link
                  href={`/admin/orders/${r.order_id}`}
                  className="ml-3 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                >
                  {r.order?.order_number}
                </Link>
              </div>
              <span className="text-xs text-neutral-400">
                {new Date(r.created_at).toLocaleDateString('en-IN')}
              </span>
            </div>

            <p className="mt-2 text-sm text-neutral-700">
              {r.reason}
              <span className="text-neutral-400"> · {r.items?.reduce((n, i) => n + i.quantity, 0) ?? 0} item(s)</span>
            </p>
            {r.customer_note && <p className="mt-1 text-xs text-neutral-500">“{r.customer_note}”</p>}
            {r.refund_amount ? (
              <p className="mt-1 text-xs text-neutral-500">
                Refunded ₹{(r.refund_amount / 100).toLocaleString('en-IN')}
              </p>
            ) : null}

            {ACTIONS[r.status]?.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                {ACTIONS[r.status].includes('receive') && (
                  <input
                    value={refund[r.id] ?? ''}
                    onChange={(e) => setRefund({ ...refund, [r.id]: e.target.value })}
                    placeholder="Refund ₹ (optional)"
                    inputMode="decimal"
                    className="w-40 rounded border border-neutral-300 px-2 py-1.5 text-xs"
                  />
                )}
                {ACTIONS[r.status].map((a) => (
                  <button
                    key={a} type="button" disabled={pending} onClick={() => act(r, a)}
                    className={`rounded px-3 py-1.5 text-xs capitalize disabled:opacity-50 ${
                      a === 'reject'
                        ? 'border border-neutral-300 text-neutral-600 hover:border-neutral-900'
                        : 'bg-neutral-900 text-white'
                    }`}
                  >
                    {a === 'receive' ? 'Mark received' : a}
                  </button>
                ))}
                {ACTIONS[r.status].includes('receive') && (
                  // Says what the button will actually do, because "received"
                  // silently issuing a refund would be a nasty surprise.
                  <span className="text-xs text-neutral-400">
                    Restocks the items; refunds only if an amount is entered.
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {total > pageSize && (
        <div className="mt-6 flex items-center justify-between text-sm text-neutral-500">
          <span>Page {page + 1} of {pageCount}</span>
          <div className="flex gap-2">
            <Link
              href={`/admin/returns?tab=${tab}&page=${page - 1}`}
              aria-disabled={page === 0}
              className={`rounded-md border px-3 py-1.5 ${page === 0 ? 'pointer-events-none opacity-40' : 'hover:bg-neutral-50'}`}
            >
              Prev
            </Link>
            <Link
              href={`/admin/returns?tab=${tab}&page=${page + 1}`}
              aria-disabled={page + 1 >= pageCount}
              className={`rounded-md border px-3 py-1.5 ${page + 1 >= pageCount ? 'pointer-events-none opacity-40' : 'hover:bg-neutral-50'}`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
