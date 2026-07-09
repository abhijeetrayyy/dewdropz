'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/actions/coupons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Coupon } from '@/types/database'

function fmtAmount(p: number) { return `₹${(p / 100).toLocaleString('en-IN')}` }

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '', type: 'percentage' as string, value: '', min_order_amount: '',
    max_discount_amount: '', usage_limit: '', starts_at: '', expires_at: '', is_active: true,
  })

  async function load() {
    try { setCoupons(await getCoupons()) }
    catch { toast.error('Failed to load coupons') }
  }
  useEffect(() => { load() }, [])

  function openAdd() {
    setEditingId(null)
    setForm({ code: '', type: 'percentage', value: '', min_order_amount: '', max_discount_amount: '', usage_limit: '', starts_at: '', expires_at: '', is_active: true })
    setDialogOpen(true)
  }

  function edit(c: Coupon) {
    setEditingId(c.id)
    setForm({
      code: c.code, type: c.type,
      value: String(c.type === 'percentage' ? c.value : c.value / 100),
      min_order_amount: c.min_order_amount ? String(c.min_order_amount / 100) : '',
      max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount / 100) : '',
      usage_limit: c.usage_limit ? String(c.usage_limit) : '',
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : '',
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : '',
      is_active: c.is_active,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.code || !form.value) { toast.error('Code and value are required'); return }
    setSaving(true)
    try {
      const payload = {
        code: form.code.toUpperCase(),
        type: form.type as 'percentage' | 'fixed',
        value: form.type === 'percentage' ? parseInt(form.value) : Math.round(parseFloat(form.value) * 100),
        min_order_amount: form.min_order_amount ? Math.round(parseFloat(form.min_order_amount) * 100) : undefined,
        max_discount_amount: form.max_discount_amount ? Math.round(parseFloat(form.max_discount_amount) * 100) : undefined,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit) : undefined,
        starts_at: form.starts_at || undefined,
        expires_at: form.expires_at || undefined,
        is_active: form.is_active,
      }
      if (editingId) {
        await updateCoupon(editingId, payload)
        toast.success('Coupon updated')
      } else {
        await createCoupon(payload)
        toast.success('Coupon created')
      }
      setDialogOpen(false); await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this coupon?')) return
    try { await deleteCoupon(id); toast.success('Coupon deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight text-black">Coupons</h2><p className="text-sm text-gray-500 mt-1">Manage discount codes</p></div>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Coupon</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min Order</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No coupons yet</TableCell></TableRow>
              ) : coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-gray-900 font-mono">{c.code}</TableCell>
                  <TableCell>
                    {c.type === 'percentage' ? `${c.value}%` : fmtAmount(c.value)}
                    {c.max_discount_amount ? <span className="text-gray-400 text-xs ml-1">(max {fmtAmount(c.max_discount_amount)})</span> : ''}
                  </TableCell>
                  <TableCell className="text-gray-500">{c.min_order_amount ? fmtAmount(c.min_order_amount) : '—'}</TableCell>
                  <TableCell className="text-gray-500">{c.usage_count ?? 0}/{c.usage_limit ?? '∞'}</TableCell>
                  <TableCell>
                    {c.is_active
                      ? (c.expires_at && new Date(c.expires_at) < new Date() ? <Badge variant="warning">Expired</Badge> : <Badge variant="success">Active</Badge>)
                      : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Coupon' : 'Add Coupon'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{form.type === 'percentage' ? 'Value (%) *' : 'Value (₹) *'}</Label><Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} type="number" /></div>
              <div><Label>Min Order (₹)</Label><Input value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} type="number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Max Discount (₹)</Label><Input value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} type="number" /></div>
              <div><Label>Usage Limit</Label><Input value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} type="number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Starts At</Label><Input value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} type="datetime-local" /></div>
              <div><Label>Expires At</Label><Input value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} type="datetime-local" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
