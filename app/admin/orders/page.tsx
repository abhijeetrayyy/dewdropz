'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getAllOrders, updateOrderStatus, addTrackingInfo, bulkUpdateOrderStatus, refundOrder } from '@/actions/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Package, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { CardListSkeleton } from '@/components/admin/CardListSkeleton'
import type { OrderWithItems, Order } from '@/types/database'

const PAGE_SIZE = 20
// Bulk status changes are limited to transitions that don't need per-order data —
// shipping needs a carrier + tracking number per order, so it stays a per-order action.
const BULK_STATUSES: Order['status'][] = ['confirmed', 'processing', 'delivered', 'cancelled']

function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'> = {
  pending: 'warning', confirmed: 'info', processing: 'info',
  shipped: 'success', delivered: 'success', cancelled: 'destructive', refunded: 'destructive',
}
const paymentStatusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  paid: 'success', pending: 'warning', failed: 'destructive', refunded: 'destructive', partially_refunded: 'warning',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<Order['status']>('processing')
  const [shipDialog, setShipDialog] = useState(false)
  const [refundDialog, setRefundDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)
  const [trackForm, setTrackForm] = useState({ carrier: '', number: '', url: '' })
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', restock: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const { orders: rows, total: t } = await getAllOrders({
        status: filter && filter !== 'all' ? filter : undefined,
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
    try { await updateOrderStatus(orderId, status); toast.success(`Order ${status}`); load() }
    catch { toast.error('Failed to update') }
  }

  async function shipOrder() {
    if (!selectedOrder || !trackForm.carrier || !trackForm.number) { toast.error('Carrier and tracking number required'); return }
    setSaving(true)
    try {
      await addTrackingInfo(selectedOrder.id, trackForm.carrier, trackForm.number, trackForm.url || undefined)
      toast.success('Order shipped')
      setShipDialog(false)
      load()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  function openShip(order: OrderWithItems) { setSelectedOrder(order); setTrackForm({ carrier: '', number: '', url: '' }); setShipDialog(true) }

  function openRefund(order: OrderWithItems) {
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
    if (!confirm(`Mark ${selected.size} order${selected.size === 1 ? '' : 's'} as ${bulkStatus}?`)) return
    try {
      await bulkUpdateOrderStatus([...selected], bulkStatus)
      toast.success(`${selected.size} order${selected.size === 1 ? '' : 's'} updated`)
      load()
    } catch { toast.error('Bulk update failed') }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Orders</h2>
          <p className="text-sm text-gray-500 mt-1">{total} order{total === 1 ? '' : 's'}</p>
        </div>
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order # or email..." className="pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={orders.length > 0 && selected.size === orders.length} onCheckedChange={toggleSelectAll} />
          <span className="text-xs text-gray-500">Select all on page</span>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 text-sm ml-2">
              <span className="text-gray-500">{selected.size} selected</span>
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as Order['status'])}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BULK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleBulkStatus}>Apply</Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <CardListSkeleton count={5} />
      ) : orders.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No orders found</p>
            <p className="text-sm text-gray-500 max-w-sm">No orders match your current filters or search criteria.</p>
          </CardContent>
        </Card>
      ) : orders.map((o) => (
        <Card key={o.id}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelected(o.id)} />
              <div>
                <CardTitle className="text-base text-black">{o.order_number}</CardTitle>
                <p className="text-sm text-gray-500">{fmtDate(o.created_at)} — {o.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusColors[o.status]} className="capitalize">{o.status}</Badge>
              <Badge variant={paymentStatusColors[o.payment_status] ?? 'secondary'} className="capitalize">{o.payment_status.replace('_', ' ')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.items?.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium text-gray-900">{i.product_name}{i.variant_name ? ` — ${i.variant_name}` : ''}</TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="text-right text-gray-500">{fmtAmount(i.unit_price)}</TableCell>
                    <TableCell className="text-right">{fmtAmount(i.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Subtotal {fmtAmount(o.subtotal)} + Shipping {fmtAmount(o.shipping_cost)} + Tax {fmtAmount(o.tax_amount)}
                {o.discount_amount > 0 ? ` - Discount ${fmtAmount(o.discount_amount)}` : ''}
                {' = '}<strong className="text-black">{fmtAmount(o.total_amount)}</strong>
                {o.tracking_number && <span className="ml-4 text-xs">📦 {o.carrier}: {o.tracking_number}</span>}
              </div>
              <div className="flex gap-2">
                {(o.status === 'pending' || o.status === 'confirmed') && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => changeStatus(o.id, 'processing')}>Processing</Button>
                    <Button size="sm" onClick={() => openShip(o)}>Ship</Button>
                  </>
                )}
                {o.status === 'processing' && <Button size="sm" onClick={() => openShip(o)}>Ship</Button>}
                {o.status === 'shipped' && <Button size="sm" onClick={() => changeStatus(o.id, 'delivered')}>Delivered</Button>}
                {(o.payment_status === 'paid' || o.payment_status === 'partially_refunded') && (
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => openRefund(o)}>Refund</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

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
          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button 
              variant="secondary" 
              className="text-xs"
              onClick={(e) => {
                e.preventDefault()
                setTrackForm({
                  carrier: 'Delhivery',
                  number: `DLV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                  url: 'https://delhivery.com/track'
                })
              }}
            >
              Generate Mock Tracking
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShipDialog(false)}>Cancel</Button>
              <Button onClick={shipOrder} disabled={saving}>{saving ? 'Shipping...' : 'Mark Shipped'}</Button>
            </div>
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
                : `This issues a real refund through ${selectedOrder?.payment_method === 'stripe' ? 'Stripe' : 'Razorpay'}.`}
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
    </div>
  )
}
