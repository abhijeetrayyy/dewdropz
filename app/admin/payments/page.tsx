'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react'
import { getPaymentsLedger, getPaymentsOverview, getPaymentsSummary, getWebhookEvents, getWebhookEventPayload } from '@/actions/payments'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, ChevronLeft, ChevronRight, Wallet, Clock, Undo2, Eye, Loader2, Banknote, TrendingDown, Truck, AlertTriangle } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard'

const PAGE_SIZE = 20

type Ledger = Awaited<ReturnType<typeof getPaymentsLedger>>['payments']
type Summary = Awaited<ReturnType<typeof getPaymentsSummary>>
type Events = Awaited<ReturnType<typeof getWebhookEvents>>['events']

function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }

// The last 12 IST calendar months plus all-time.
//
// Calendar months, not the analytics page's rolling "last 30 days": books close
// on a month boundary, and a window that slides every second can never be
// reconciled against a statement twice and give the same answer. The bounds are
// half-open [from, to) and the database reads them as Asia/Kolkata wall-clock.
function monthOptions() {
  const now = new Date()
  const opts: { key: string; label: string; from: string | null; to: string | null }[] = []
  for (let i = 0; i < 12; i++) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    opts.push({
      key: iso(start),
      label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      from: iso(start),
      to: iso(end),
    })
  }
  opts.push({ key: 'all', label: 'All time', from: null, to: null })
  return opts
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

const paymentStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  paid: 'success', pending: 'warning', failed: 'destructive', refunded: 'destructive', partially_refunded: 'warning',
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Ledger>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [events, setEvents] = useState<Events>([])
  const [loading, setLoading] = useState(true)
  const [payloadDialog, setPayloadDialog] = useState(false)
  const [payload, setPayload] = useState<unknown>(null)
  const [payloadLoading, setPayloadLoading] = useState(false)
  const MONTHS = useMemo(() => monthOptions(), [])
  const [rangeKey, setRangeKey] = useState(MONTHS[0].key)
  const range = MONTHS.find((m) => m.key === rangeKey) ?? MONTHS[0]

  function viewPayload(id: string) {
    setPayloadDialog(true)
    setPayloadLoading(true)
    getWebhookEventPayload(id).then(setPayload).finally(() => setPayloadLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // First paint takes one round-trip, not three: the summary cards, the webhook
  // list and the first page of the ledger arrive together. Filtering and paging
  // afterwards only need the ledger, so they ask for just that.
  const [primed, setPrimed] = useState(false)

  useEffect(() => {
    const query = {
      paymentStatus: statusFilter !== 'all' ? statusFilter : undefined,
      paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }
    setLoading(true)

    if (!primed) {
      getPaymentsOverview(query, { from: range.from, to: range.to })
        .then((r) => {
          setSummary(r.summary)
          setEvents(r.events)
          setPayments(r.ledger.payments)
          setTotal(r.ledger.total)
          setPrimed(true)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
      return
    }

    getPaymentsLedger(query)
      .then((r) => { setPayments(r.payments); setTotal(r.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
    // `range` is deliberately absent: it changes only the summary, which the
    // effect below refetches on its own. Including it here would re-fetch the
    // ledger — a different, unfiltered dataset — on every month change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, methodFilter, debouncedSearch, page, primed])

  // The month picker moves the figures, not the ledger. Skipped on mount
  // because the priming call above already fetched this range's summary.
  useEffect(() => {
    if (!primed) return
    getPaymentsSummary({ from: range.from, to: range.to }).then(setSummary).catch(() => {})
  }, [rangeKey, primed, range.from, range.to])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Every exception that is currently non-zero. Each one means a figure above
  // it is incomplete, so they are listed by name rather than rolled into a
  // single "issues" count nobody can act on.
  const exceptions = summary ? ([
    [summary.refundLedgerVariance, `Refund ledger disagrees with order totals by ${fmtAmount(Math.abs(summary.refundLedgerVariance))} — a refund was recorded in one place and not the other`],
    [summary.refundsUnresolvedCount, `${summary.refundsUnresolvedCount} refund(s) failed at the gateway and are still owed to a customer (${fmtAmount(summary.refundsUnresolvedAmount)})`],
    [summary.codReturnedUncreditedCount, `${summary.codReturnedUncreditedCount} COD order(s) came back and were restocked, but no refund was recorded (${fmtAmount(summary.codReturnedUncredited)}) — COD collected is overstated by that much`],
    [summary.overRefundedCount, `${summary.overRefundedCount} order(s) refunded for more than they were charged`],
    [summary.unhandledRefundEvents, `${summary.unhandledRefundEvents} refund webhook(s) arrived that this app has no handler for — money may have moved without being recorded`],
    [summary.disputeEventsSeen, `${summary.disputeEventsSeen} dispute/chargeback event(s) seen — nothing here accounts for them`],
    [summary.nonInrOrderCount, `${summary.nonInrOrderCount} order(s) are not in INR and are excluded from every figure above`],
    [summary.capturedWithoutPaidAtCount, `${summary.capturedWithoutPaidAtCount} captured order(s) have no capture date — they are dated from confirmation instead`],
    [summary.uncreditedRefundCount, `${summary.uncreditedRefundCount} refund(s) have no GST credit note`],
  ] as [number, string][]).filter(([n]) => n > 0) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Payments</h2>
          <p className="text-sm text-gray-500 mt-1">
            Money in and out, for one calendar month. Not revenue and not profit — this screen
            knows nothing about gateway fees or what anything cost to make.
          </p>
        </div>
        <Select value={rangeKey} onValueChange={setRangeKey}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Band A — gateway money. Gross and refunds are counted on their OWN
          dates, so a November refund against an October sale reduces November
          without ever moving October's cash figure. */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Gateway money · {range.label}
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          {!summary ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
            <>
              <StatCard label="Gross captured" value={fmtAmount(summary.grossCaptured)} icon={Wallet} tone="success"
                sub={`${summary.capturedOrderCount} order(s) captured in this month`} />
              <StatCard label="Refunded" value={fmtAmount(summary.refundsSucceeded)} icon={TrendingDown} tone="warning"
                sub={summary.refundsPriorPeriod > 0
                  ? `${fmtAmount(summary.refundsPriorPeriod)} of this reverses earlier months`
                  : 'Counted on the refund date, not the sale date'} />
              <StatCard label="Net captured" value={fmtAmount(summary.netCaptured)} icon={Banknote} tone="info"
                sub="Gross captured less refunds paid this month" />
              <StatCard label="Net inflow" value={fmtAmount(summary.netInflow)} icon={Banknote} tone="success"
                sub="Net captured plus COD cash collected" />
            </>
          )}
        </div>
      </div>

      {/* Band B — COD. Kept apart from gateway money on purpose: a gateway
          capture will appear on a Razorpay statement, cash at the door will
          not, and mixing them makes the total tie to nothing. */}
      {summary && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Cash on delivery</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Collected at the door" value={fmtAmount(summary.codCollected)} icon={Truck} tone="success"
              sub={`${summary.codCollectedCount} delivered this month. Cash the courier holds — not yet remitted.`} />
            <StatCard label="Out with couriers" value={fmtAmount(summary.codOutstanding)} icon={Clock} tone="warning"
              sub={`${summary.codOutstandingCount} undelivered COD order(s). A running balance, not this month.`} />
            <StatCard label="Returned to sender" value={fmtAmount(summary.codRtoAmount)} icon={Undo2} tone="neutral"
              sub={`${summary.codRtoCount} RTO order(s) — never collected, and the shipping is spent.`} />
          </div>
        </div>
      )}

      {/* Band C — counts, kept away from the money cards. "Refunded: 4" sitting
          between two rupee figures was the old layout's worst readability
          problem: it reads as an amount. */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Awaiting payment: {summary.pendingPrepaidCount}</Badge>
          <Badge variant="outline">Abandoned checkouts: {summary.abandonedCount}</Badge>
          <Badge variant="outline">Failed payments: {summary.failedPaymentCount}</Badge>
          <Badge variant="outline">Orders refunded: {summary.refundedOrderCount}</Badge>
          {summary.byMethod.map((m) => (
            <Badge key={m.method} variant="secondary" className="capitalize">
              {m.method}: {fmtAmount(m.net)}
              {m.refunded > 0 && (
                <span className="ml-1 font-normal opacity-70">
                  ({fmtAmount(m.gross)} less {fmtAmount(m.refunded)})
                </span>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Band D — exceptions. The point of a reconciliation screen is that every
          difference it cannot explain is named, rather than quietly absorbed
          into a total that then looks tidy and is wrong. */}
      {exceptions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Needs looking at before these figures balance
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {exceptions.map(([, text]) => <li key={text}>· {text}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="transactions">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-black data-[state=active]:text-white">Transactions</TabsTrigger>
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-black data-[state=active]:text-white">Webhook Log</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, email, or gateway ID..." className="pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="partially_refunded">Partially Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(0) }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="cod">COD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <TableSkeleton columns={6} rows={8} />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Gateway ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">No transactions match your filters</TableCell></TableRow>
                    ) : payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-gray-900">{p.order_number}</TableCell>
                        <TableCell className="text-gray-500">{p.email}</TableCell>
                        <TableCell className="capitalize text-gray-600">{p.payment_method ?? '—'}</TableCell>
                        <TableCell className="text-gray-400 text-xs font-mono">{p.payment_intent_id ?? '—'}</TableCell>
                        <TableCell><Badge variant={paymentStatusVariant[p.payment_status] ?? 'secondary'} className="capitalize">{p.payment_status.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmtAmount(p.total_amount)}</TableCell>
                        <TableCell className="text-gray-400 text-xs">{fmtDate(p.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Page {page + 1} of {pageCount}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No webhook events recorded yet</TableCell></TableRow>
                  ) : events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="capitalize text-gray-900 font-medium">{e.provider}</TableCell>
                      <TableCell className="text-gray-600 text-sm font-mono">{e.event_type}</TableCell>
                      <TableCell>{e.processed ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                      <TableCell className="text-red-600 text-xs">{e.error ?? '—'}</TableCell>
                      <TableCell className="text-gray-400 text-xs">{fmtDate(e.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => viewPayload(e.id)}><Eye className="h-4 w-4 text-gray-400" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={payloadDialog} onOpenChange={setPayloadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Webhook Payload</DialogTitle></DialogHeader>
          {payloadLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <pre className="bg-gray-50 border border-gray-100 rounded-md p-4 text-xs overflow-auto max-h-[60vh] text-gray-700">
              {JSON.stringify(payload, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
