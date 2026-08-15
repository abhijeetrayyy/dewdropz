'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import {
  getTaxRates, createTaxRate, updateTaxRate, deleteTaxRate,
  getUnclassifiedProducts, setProductHsn, type TaxRateRow,
} from '@/actions/taxRates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import TaxSettingsCard from './TaxSettingsCard'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const emptyForm = { name: '', hsn_code: '', min_price: '0', max_price: '', rate: '', is_active: true }

export default function TaxPage() {
  const [rates, setRates] = useState<TaxRateRow[]>([])
  const [unclassified, setUnclassified] = useState<{ id: string; name: string; slug: string; price: number }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    try {
      const [r, u] = await Promise.all([getTaxRates(), getUnclassifiedProducts()])
      setRates(r); setUnclassified(u)
    } catch { toast.error('Failed to load tax rules') }
  }
  useEffect(() => { load() }, [])

  function openAdd() {
    setEditingId(null); setForm(emptyForm); setDialogOpen(true)
  }

  function edit(r: TaxRateRow) {
    setEditingId(r.id)
    setForm({
      name: r.name, hsn_code: r.hsn_code,
      min_price: String(r.min_price / 100),
      max_price: r.max_price == null ? '' : String(r.max_price / 100),
      rate: String(r.rate), is_active: r.is_active,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.name || !form.hsn_code || !form.rate) {
      toast.error('Name, HSN code and rate are required'); return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        hsn_code: form.hsn_code.trim(),
        min_price: Math.round(parseFloat(form.min_price || '0') * 100),
        max_price: form.max_price ? Math.round(parseFloat(form.max_price) * 100) : null,
        rate: parseFloat(form.rate),
        is_active: form.is_active,
      }
      if (payload.max_price != null && payload.max_price <= payload.min_price) {
        toast.error('The upper bound must be above the lower bound'); setSaving(false); return
      }
      if (editingId) { await updateTaxRate(editingId, payload); toast.success('Rate updated') }
      else { await createTaxRate(payload); toast.success('Rate created') }
      setDialogOpen(false); await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function remove(r: TaxRateRow) {
    if (!confirm(`Delete "${r.name}"?`)) return
    try { await deleteTaxRate(r.id); toast.success('Rate deleted'); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to delete') }
  }

  async function classify(productId: string, hsn: string) {
    if (!hsn.trim()) return
    try { await setProductHsn(productId, hsn.trim()); toast.success('HSN saved'); load() }
    catch { toast.error('Failed to save HSN') }
  }

  function band(r: TaxRateRow) {
    // The stored upper bound is exclusive, so a slab of "₹1,000 and below" is
    // stored as 100001. Printing that number back reads as "Under ₹1,000.01",
    // which is not how anyone states a tax slab — show the inclusive figure.
    const upper = r.max_price == null ? null : rupees(r.max_price - 1)
    if (r.min_price === 0 && upper == null) return 'Any price'
    if (r.min_price === 0) return `Up to ${upper}`
    if (upper == null) return `Above ${rupees(r.min_price - 1)}`
    return `${rupees(r.min_price)} – ${upper}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Tax Rules</h2>
          <p className="text-sm text-gray-500 mt-1">
            GST by HSN code, and by price where the slab depends on it. Applied per line at checkout;
            anything unclassified falls back to the store rate below.
          </p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Rate</Button>
      </div>

      <TaxSettingsCard />

      {unclassified.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="w-full">
                <div className="text-sm font-medium text-gray-900">
                  {unclassified.length} product{unclassified.length === 1 ? '' : 's'} without an HSN code
                </div>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">
                  These are taxed at the store fallback rate, which is only right by coincidence.
                </p>
                <div className="space-y-2">
                  {unclassified.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="text-sm text-gray-700 flex-1 truncate">
                        {p.name} <span className="text-gray-400">· {rupees(p.price)}</span>
                      </div>
                      <Input
                        className="w-36 h-8 bg-white"
                        placeholder="HSN code"
                        aria-label={`HSN code for ${p.name}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') classify(p.id, (e.target as HTMLInputElement).value)
                        }}
                        onBlur={(e) => classify(p.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">No tax rules yet</TableCell></TableRow>
              ) : rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-gray-900">{r.name}</TableCell>
                  <TableCell className="font-mono text-sm text-gray-600">{r.hsn_code}</TableCell>
                  <TableCell className="text-sm text-gray-500">{band(r)}</TableCell>
                  <TableCell className="text-right tabular-nums text-gray-900">{r.rate}%</TableCell>
                  <TableCell className="text-right tabular-nums text-gray-500">{r.productCount}</TableCell>
                  <TableCell>
                    {r.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Off</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Tax Rate' : 'Add Tax Rate'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tax-name">Name *</Label>
                <Input id="tax-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Apparel up to ₹1,000" />
              </div>
              <div>
                <Label htmlFor="tax-hsn">HSN code *</Label>
                <Input id="tax-hsn" value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} placeholder="6109" />
              </div>
            </div>

            <div>
              <Label>Price band</Label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">
                Matched on the price of a single piece, not the line total — buying two ₹899 tees must not
                push them into a higher slab. Leave the upper bound empty for &ldquo;no ceiling&rdquo;.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tax-min" className="font-normal text-xs">From (₹)</Label>
                  <Input id="tax-min" type="number" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="tax-max" className="font-normal text-xs">Up to, exclusive (₹)</Label>
                  <Input id="tax-max" type="number" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} placeholder="no ceiling" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tax-rate">Rate (%) *</Label>
                <Input id="tax-rate" type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="5" />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label htmlFor="tax-active" className="font-normal">Active</Label>
                <Checkbox id="tax-active" className="w-5 h-5" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
