'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getPaymentsLedger, getPaymentsSummary, getWebhookEvents, getWebhookEventPayload } from '@/actions/payments'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, ChevronLeft, ChevronRight, Wallet, Clock, XCircle, Undo2, Eye, Loader2 } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/TableSkeleton'
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard'

const PAGE_SIZE = 20

type Ledger = Awaited<ReturnType<typeof getPaymentsLedger>>['payments']
type Summary = Awaited<ReturnType<typeof getPaymentsSummary>>
type Events = Awaited<ReturnType<typeof getWebhookEvents>>['events']

function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }
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

  function viewPayload(id: string) {
    setPayloadDialog(true)
    setPayloadLoading(true)
    getWebhookEventPayload(id).then(setPayload).finally(() => setPayloadLoading(false))
  }

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    getPaymentsSummary().then(setSummary).catch(() => {})
    getWebhookEvents({ limit: 30 }).then((r) => setEvents(r.events)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    getPaymentsLedger({
      paymentStatus: statusFilter !== 'all' ? statusFilter : undefined,
      paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then((r) => { setPayments(r.payments); setTotal(r.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter, methodFilter, debouncedSearch, page])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const cards = summary ? [
    { label: 'Total Captured', value: fmtAmount(summary.totalCaptured), icon: Wallet, tone: 'success' as const },
    { label: 'Pending', value: summary.pendingCount, icon: Clock, tone: 'warning' as const },
    { label: 'Failed', value: summary.failedCount, icon: XCircle, tone: 'neutral' as const },
    { label: 'Refunded', value: summary.refundedCount, icon: Undo2, tone: 'info' as const },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-black">Payments</h2>
        <p className="text-sm text-gray-500 mt-1">Transaction ledger and gateway webhook activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {!summary ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
        ))}
      </div>

      {summary && summary.byMethod.length > 0 && (
        <div className="flex gap-2">
          {summary.byMethod.map((m) => (
            <Badge key={m.method} variant="outline" className="capitalize">{m.method}: {fmtAmount(m.amount)}</Badge>
          ))}
        </div>
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
                <SelectItem value="stripe">Stripe</SelectItem>
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
