'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getAllOrders, updateOrderStatus, bulkUpdateOrderStatus, refundOrder, cancelOrderAsAdmin, getRefundAttentionCount, exportOrdersCsv, type OrderView, type OrderListRow } from '@/actions/orders'

const VIEW_KEYS: string[] = ['all','unfulfilled','cod_pending','rto','needs_attention']
import { createShipment, updateShipmentStatus } from '@/actions/shipments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Search, ChevronLeft, ChevronRight, Loader2, AlertTriangle, MoreHorizontal, Palette } from 'lucide-react'
import { TableSkeleton } from '@/components/admin/CardListSkeleton'
import type { Order } from '@/types/database'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'

const PAGE_SIZE = 20
// Bulk status changes are limited to transitions that don't need per-order data —
// shipping needs a carrier + tracking number per order, so it stays a per-order action.
const BULK_STATUSES: Order['status'][] = ['confirmed', 'processing', 'delivered', 'cancelled']

function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  pending: 'warning', confirmed: 'info', processing: 'info',
  shipped: 'success', delivered: 'success', cancelled: 'destructive', refunded: 'destructive',
}
const paymentStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  paid: 'success', pending: 'warning', failed: 'destructive', refunded: 'destructive', partially_refunded: 'warning',
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Order['status']>('processing')
  const [shipDialog, setShipDialog] = useState(false)
  const [refundDialog, setRefundDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderListRow | null>(null)
  const [trackForm, setTrackForm] = useState({ carrier: '', number: '', url: '' })
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', restock: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attentionCount, setAttentionCount] = useState(0)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // Cancelling an order releases stock AND auto-refunds a captured payment.
  // That was behind a native confirm(), which is a browser dialog people
  // dismiss by reflex — thin cover for moving money. Both now use the same
  // ConfirmDialog as every other destructive action in this admin.
  const [confirmCancel, setConfirmCancel] = useState<OrderListRow | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  function loadAttentionCount() {
    getRefundAttentionCount().then(setAttentionCount).catch(() => {})
  }
  useEffect(() => { loadAttentionCount() }, [])

  // Downloads whatever the current view is showing, so "export what I am
  // looking at" needs no extra thought. Built and revoked in the browser — the
  // CSV never touches disk on the server.
  async function exportCsv() {
    try {
      const csv = await exportOrdersCsv({
        view: VIEW_KEYS.includes(filter) ? (filter as OrderView) : undefined,
        search: debouncedSearch || undefined,
      })
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${filter}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Could not export') }
  }

  async function load() {
    setLoading(true)
    try {
      // Saved views go through `view`; the plain status values still go through
      // `status`, so the dropdown can hold both without two controls.
      const isView = VIEW_KEYS.includes(filter)
      const { orders: rows, total: t } = await getAllOrders({
        view: isView ? (filter as OrderView) : undefined,
        status: isView ? undefined : filter,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setOrders(rows)
      setTotal(t)
      setSelected(new Set())
    } catch { toast.error('Failed to load orders') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filter, debouncedSearch, page])

  async function changeStatus(orderId: string, status: Order['status']) {
    try { await updateOrderStatus(orderId, status); toast.success(`Order ${status}`); load(); loadAttentionCount() }
    catch { toast.error('Failed to update') }
  }

  async function cancelSingleOrder(order: OrderListRow) {
    setConfirmCancel(null)
    setCancellingId(order.id)
    try {
      const result = await cancelOrderAsAdmin(order.id)
      if (result && 'error' in result) { toast.error(result.error); return }
      toast.success(result?.refundIssued ? 'Order cancelled and refunded' : 'Order cancelled')
      load()
      loadAttentionCount()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel order')
    } finally {
      setCancellingId(null)
    }
  }

  // Creates a real shipment rather than overwriting the order's single tracking
  // column, so a second parcel on the same order is possible — the order's own
  // status is then derived from its parcels, not set here by hand.
  async function shipOrder() {
    if (!selectedOrder || !trackForm.carrier || !trackForm.number) { toast.error('Carrier and tracking number required'); return }
    setSaving(true)
    try {
      const res = await createShipment({
        orderId: selectedOrder.id,
        courierName: trackForm.carrier,
        awb: trackForm.number,
        trackingUrl: trackForm.url || undefined,
      })
      if ('error' in res) { toast.error(res.error); return }
      // Straight to dispatched: the team only opens this once the parcel has
      // actually been handed over, and this records the event as well.
      await updateShipmentStatus(res.id, 'in_transit', { description: `Handed to ${trackForm.carrier}` })
      toast.success('Parcel added — order marked shipped')
      setShipDialog(false)
      load()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  function openShip(order: OrderListRow) { setSelectedOrder(order); setTrackForm({ carrier: '', number: '', url: '' }); setShipDialog(true) }

  function openRefund(order: OrderListRow) {
    setSelectedOrder(order)
    setRefundForm({ amount: (order.total_amount / 100).toString(), reason: '', restock: true })
    setRefundDialog(true)
  }

  async function submitRefund() {
    if (!selectedOrder) return
    const amount = Math.round(parseFloat(refundForm.amount) * 100)
    if (!amount || amount <= 0) { toast.error('Enter a valid refund amount'); return }
    setSaving(true)
    try {
      const result = await refundOrder(selectedOrder.id, { amount, reason: refundForm.reason || undefined, restock: refundForm.restock })
      if (result && 'error' in result) { toast.error(result.error); return }
      toast.success('Refund issued')
      setRefundDialog(false)
      load()
      loadAttentionCount()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Refund failed') }
    finally { setSaving(false) }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))))
  }

  async function handleBulkStatus() {
    setConfirmBulk(false)
    try {
      await bulkUpdateOrderStatus([...selected], bulkStatus)
      toast.success(`${selected.size} order${selected.size === 1 ? '' : 's'} updated`)
      load()
    } catch { toast.error('Bulk update failed') }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  /** One line describing the basket, so a row stays a row. The detail page is
   *  one click away for anyone who needs the itemisation. */
  function summarise(o: OrderListRow) {
    const items = o.items ?? []
    const units = items.reduce((n, i) => n + i.quantity, 0)
    const first = items[0]
    const rest = items.length - 1
    return {
      units,
      customCount: items.filter((i) => i.custom_design_id).length,
      label: !first ? '—' : `${first.product_name}${rest > 0 ? ` +${rest} more` : ''}`,
    }
  }

  /** The single move this order is waiting for. Anything else lives in the
   *  overflow menu — a row with five buttons is a row nobody reads. */
  function primaryAction(o: OrderListRow) {
    if (o.status === 'pending' || o.status === 'confirmed') return { label: 'Ship', run: () => openShip(o) }
    if (o.status === 'processing') return { label: 'Ship', run: () => openShip(o) }
    if (o.status === 'shipped') return { label: 'Delivered', run: () => changeStatus(o.id, 'delivered') }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Orders</h2>
          <p className="text-sm text-gray-500 mt-1">{total} order{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:border-black hover:text-black"
        >
          Export CSV
        </button>
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orders</SelectItem>
            <SelectItem value="unfulfilled">Unfulfilled — to pack</SelectItem>
            <SelectItem value="cod_pending">COD — not collected</SelectItem>
            <SelectItem value="rto">Returning (RTO)</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="needs_attention">⚠ Needs Attention{attentionCount > 0 ? ` (${attentionCount})` : ''}</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {attentionCount > 0 && filter !== 'needs_attention' && (
        <button
          type="button"
          onClick={() => { setFilter('needs_attention'); setPage(0) }}
          className="w-full flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-left hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-800">
            <strong>{attentionCount}</strong> order{attentionCount === 1 ? '' : 's'} had a refund fail automatically and need{attentionCount === 1 ? 's' : ''} manual attention.
          </span>
        </button>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, email, phone or name..." className="pl-8" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{selected.size} selected</span>
            <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as Order['status'])}>
              <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BULK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setConfirmBulk(true)}>Apply</Button>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : orders.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No orders found</p>
            <p className="text-sm text-gray-500 max-w-sm">No orders match your current filters or search criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {/* Same treatment as the products table: fixed layout with every
                column that holds something of known size given that size, and
                exactly one unsized column — Items — to absorb the slack. Under
                auto layout the basket description was taking whatever it liked
                and squeezing Total and Status, which are the two a person
                scanning this list is actually reading. */}
            <Table className="min-w-[940px] table-fixed">
              <colgroup>
                <col className="w-[44px]" />
                <col className="w-[210px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[150px]" />
                <col className="w-[116px]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-10 px-3">
                    <Checkbox
                      aria-label="Select all orders on this page"
                      checked={orders.length > 0 && selected.size === orders.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="h-10 px-3">Order</TableHead>
                  <TableHead className="h-10 px-3">Items</TableHead>
                  <TableHead className="h-10 px-3 text-right">Total</TableHead>
                  <TableHead className="h-10 px-3">Payment</TableHead>
                  <TableHead className="h-10 px-3">Status</TableHead>
                  <TableHead className="h-10 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const s = summarise(o)
                  const action = primaryAction(o)
                  const canCancel = o.status === 'pending' || o.status === 'confirmed' || o.status === 'processing'
                  const canRefund = o.payment_status === 'paid' || o.payment_status === 'partially_refunded'
                  return (
                    <TableRow
                      key={o.id}
                      // The row is a mouse convenience; the order number below is
                      // a real link, so keyboard and middle-click still work.
                      onClick={() => router.push(`/admin/orders/${o.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`Select order ${o.order_number}`}
                          checked={selected.has(o.id)}
                          onCheckedChange={() => toggleSelected(o.id)}
                        />
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-gray-900 hover:underline whitespace-nowrap"
                        >
                          {o.order_number}
                        </Link>
                        <div className="text-xs text-gray-400 max-w-[220px] truncate">
                          {fmtDate(o.created_at)} · {o.email}
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-gray-400">{s.units}×</span>
                          <span className="max-w-[140px] truncate">{s.label}</span>
                          {s.customCount > 0 && (
                            // Flagged in the list because a custom item is the one
                            // that cannot just be picked off a shelf — it has to be
                            // printed before it can ship.
                            <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                              <Palette className="h-3 w-3" /> {s.customCount}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right tabular-nums font-medium text-gray-900">
                        {fmtAmount(o.total_amount)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={paymentStatusColors[o.payment_status] ?? 'secondary'}
                          className="capitalize whitespace-nowrap"
                        >
                          {o.payment_status.replace('_', ' ')}{o.payment_method === 'cod' ? ' · COD' : ''}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={statusColors[o.status]} className="capitalize">{o.status}</Badge>
                          {o.refund_needs_attention && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="Refund needs attention" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {action && (
                            <Button size="sm" variant="outline" onClick={action.run}>{action.label}</Button>
                          )}
                          {(canRefund || canCancel) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`More actions for ${o.order_number}`}>
                                  {cancellingId === o.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <MoreHorizontal className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/admin/orders/${o.id}`)}>
                                  View details
                                </DropdownMenuItem>
                                {o.status === 'pending' || o.status === 'confirmed' ? (
                                  <DropdownMenuItem onClick={() => changeStatus(o.id, 'processing')}>
                                    Mark processing
                                  </DropdownMenuItem>
                                ) : null}
                                {canRefund && (
                                  <DropdownMenuItem onClick={() => openRefund(o)} className="text-red-600">
                                    {o.refund_needs_attention ? 'Retry refund' : 'Refund'}
                                  </DropdownMenuItem>
                                )}
                                {canCancel && (
                                  <DropdownMenuItem onClick={() => setConfirmCancel(o)} className="text-red-600">
                                    Cancel order
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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

      <Dialog open={shipDialog} onOpenChange={setShipDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ship Order {selectedOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Carrier *</Label><Input value={trackForm.carrier} onChange={(e) => setTrackForm({ ...trackForm, carrier: e.target.value })} placeholder="Delhivery" /></div>
            <div><Label>Tracking Number *</Label><Input value={trackForm.number} onChange={(e) => setTrackForm({ ...trackForm, number: e.target.value })} /></div>
            <div><Label>Tracking URL</Label><Input value={trackForm.url} onChange={(e) => setTrackForm({ ...trackForm, url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialog(false)}>Cancel</Button>
            <Button onClick={shipOrder} disabled={saving}>{saving ? 'Shipping...' : 'Mark Shipped'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund Order {selectedOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {selectedOrder?.payment_method === 'cod'
                ? 'This was a COD order — no gateway charge to reverse, this just records the refund and restores stock.'
                : `This issues a real refund through ${'Razorpay'}.`}
            </p>
            <div>
              <Label>Refund Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">Order total: {selectedOrder ? fmtAmount(selectedOrder.total_amount) : ''}. Enter less than the total for a partial refund.</p>
            </div>
            <div><Label>Reason</Label><Textarea value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} rows={2} placeholder="Optional note for the order record" /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={refundForm.restock} onCheckedChange={(v) => setRefundForm({ ...refundForm, restock: !!v })} />
              <span className="text-sm">Return items to stock</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(false)}>Cancel</Button>
            <Button onClick={submitRefund} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Refunding...' : 'Issue Refund'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(open) => { if (!open) setConfirmCancel(null) }}
        title={`Cancel order ${confirmCancel?.order_number}?`}
        description={
          confirmCancel && (confirmCancel.payment_status === 'paid' || confirmCancel.payment_status === 'partially_refunded')
            ? 'Stock returns to inventory and the captured payment is refunded to the customer automatically. This cannot be undone.'
            : 'Stock returns to inventory. No payment has been captured, so nothing is refunded.'
        }
        confirmLabel="Cancel order"
        onConfirm={() => { if (confirmCancel) cancelSingleOrder(confirmCancel) }}
      />

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Mark ${selected.size} order${selected.size === 1 ? '' : 's'} as ${bulkStatus}?`}
        description="This changes the status on every selected order at once."
        confirmLabel="Update"
        onConfirm={handleBulkStatus}
      />
    </div>
  )
}
