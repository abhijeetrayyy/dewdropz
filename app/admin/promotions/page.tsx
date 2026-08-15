'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { getPromotions, createPromotion, updatePromotion, deletePromotion, type PromotionRow } from '@/actions/promotions'
import { getCollections, getAllProducts } from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

const ACTION_LABEL: Record<string, string> = {
  percentage: 'Percentage off',
  fixed: 'Fixed amount off',
  free_shipping: 'Free shipping',
  bogo: 'Buy one, get one',
}

const emptyForm = {
  name: '', label: '', action_type: 'percentage', action_value: '', max_discount: '',
  minSubtotal: '', minQuantity: '', collectionSlugs: [] as string[], productSlugs: [] as string[],
  priority: '10', stackable: false, starts_at: '', ends_at: '', is_active: true,
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [collections, setCollections] = useState<{ slug: string; name: string }[]>([])
  const [products, setProducts] = useState<{ slug: string; name: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  // Sampled when the list loads rather than read during render, so "Scheduled"
  // and "Ended" can't flip on an unrelated re-render.
  const [now, setNow] = useState(0)

  async function load() {
    try { setPromotions(await getPromotions()); setNow(Date.now()) }
    catch { toast.error('Failed to load promotions') }
  }

  useEffect(() => {
    load()
    getCollections().then((c) => setCollections(c.map((x) => ({ slug: x.slug, name: x.name })))).catch(() => {})
    getAllProducts({ limit: 500 }).then((r) => setProducts(r.products.map((p) => ({ slug: p.slug, name: p.name })))).catch(() => {})
  }, [])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function edit(p: PromotionRow) {
    setEditingId(p.id)
    const c = p.conditions ?? {}
    setForm({
      name: p.name, label: p.label, action_type: p.action_type,
      // A percentage is stored as a percentage; every other money value is paise.
      action_value: p.action_type === 'percentage' || p.action_type === 'bogo'
        ? String(p.action_value) : String(p.action_value / 100),
      max_discount: p.max_discount ? String(p.max_discount / 100) : '',
      minSubtotal: c.minSubtotal ? String(c.minSubtotal / 100) : '',
      minQuantity: c.minQuantity ? String(c.minQuantity) : '',
      collectionSlugs: c.collectionSlugs ?? [],
      productSlugs: c.productSlugs ?? [],
      priority: String(p.priority), stackable: p.stackable,
      starts_at: p.starts_at ? new Date(p.starts_at).toISOString().slice(0, 16) : '',
      ends_at: p.ends_at ? new Date(p.ends_at).toISOString().slice(0, 16) : '',
      is_active: p.is_active,
    })
    setDialogOpen(true)
  }

  const needsValue = form.action_type !== 'free_shipping'

  async function save() {
    if (!form.name || !form.label) { toast.error('Name and customer-facing label are required'); return }
    if (needsValue && !form.action_value) { toast.error('This promotion type needs a value'); return }
    setSaving(true)
    try {
      const conditions: Record<string, unknown> = {}
      if (form.minSubtotal) conditions.minSubtotal = Math.round(parseFloat(form.minSubtotal) * 100)
      if (form.minQuantity) conditions.minQuantity = parseInt(form.minQuantity)
      if (form.collectionSlugs.length) conditions.collectionSlugs = form.collectionSlugs
      if (form.productSlugs.length) conditions.productSlugs = form.productSlugs

      const payload = {
        name: form.name,
        label: form.label,
        action_type: form.action_type as 'percentage' | 'fixed' | 'free_shipping' | 'bogo',
        action_value: !needsValue ? 0
          : form.action_type === 'percentage' || form.action_type === 'bogo'
            ? parseInt(form.action_value)
            : Math.round(parseFloat(form.action_value) * 100),
        max_discount: form.max_discount ? Math.round(parseFloat(form.max_discount) * 100) : null,
        conditions,
        priority: parseInt(form.priority) || 10,
        stackable: form.stackable,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        is_active: form.is_active,
      }
      if (editingId) { await updatePromotion(editingId, payload); toast.success('Promotion updated') }
      else { await createPromotion(payload); toast.success('Promotion created') }
      setDialogOpen(false); await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  async function remove(p: PromotionRow) {
    if (!confirm(`Delete "${p.name}"?`)) return
    try { await deletePromotion(p.id); toast.success('Promotion deleted'); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to delete') }
  }

  function describe(p: PromotionRow) {
    if (p.action_type === 'percentage') return `${p.action_value}% off${p.max_discount ? ` (max ${rupees(p.max_discount)})` : ''}`
    if (p.action_type === 'fixed') return `${rupees(p.action_value)} off`
    if (p.action_type === 'bogo') return `${p.action_value} free per pair`
    return 'Free shipping'
  }

  function scopeOf(p: PromotionRow) {
    const c = p.conditions ?? {}
    const bits: string[] = []
    if (c.minSubtotal) bits.push(`over ${rupees(c.minSubtotal)}`)
    if (c.minQuantity) bits.push(`${c.minQuantity}+ items`)
    if (c.collectionSlugs?.length) bits.push(`${c.collectionSlugs.length} collection${c.collectionSlugs.length === 1 ? '' : 's'}`)
    if (c.productSlugs?.length) bits.push(`${c.productSlugs.length} product${c.productSlugs.length === 1 ? '' : 's'}`)
    return bits.length ? bits.join(' · ') : 'Whole cart'
  }

  function statusOf(p: PromotionRow) {
    if (!p.is_active) return <Badge variant="secondary">Off</Badge>
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return <Badge variant="warning">Scheduled</Badge>
    if (p.ends_at && new Date(p.ends_at).getTime() < now) return <Badge variant="secondary">Ended</Badge>
    return <Badge variant="success">Live</Badge>
  }

  function toggleIn(list: string[], slug: string) {
    return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-black">Promotions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Automatic offers — applied at checkout without a code. Coupons stay separate.
          </p>
        </div>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Promotion</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promotion</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead className="text-right">Cost so far</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">No promotions yet</TableCell></TableRow>
              ) : promotions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      &ldquo;{p.label}&rdquo;{p.stackable ? ' · stacks' : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">{describe(p)}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{scopeOf(p)}</TableCell>
                  <TableCell className="text-right text-gray-500 tabular-nums">{p.priority}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="text-gray-900">{rupees(p.spend)}</div>
                    <div className="text-xs text-gray-400">{p.orders} order{p.orders === 1 ? '' : 's'}</div>
                  </TableCell>
                  <TableCell>{statusOf(p)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Promotion' : 'Add Promotion'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="promo-name">Internal name *</Label>
                <Input id="promo-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monsoon bottles 15%" />
                <p className="text-xs text-gray-400 mt-1">Only staff see this.</p>
              </div>
              <div>
                <Label htmlFor="promo-label">Customer label *</Label>
                <Input id="promo-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Monsoon Sale" />
                <p className="text-xs text-gray-400 mt-1">Shown on the cart and the invoice.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Offer type</Label>
                <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="promo-value">
                  {form.action_type === 'percentage' ? 'Percent off *'
                    : form.action_type === 'bogo' ? 'Items free per pair *'
                    : form.action_type === 'fixed' ? 'Amount off (₹) *' : 'Value'}
                </Label>
                <Input id="promo-value" type="number" disabled={!needsValue}
                  value={needsValue ? form.action_value : ''}
                  onChange={(e) => setForm({ ...form, action_value: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="promo-max">Max discount (₹)</Label>
                <Input id="promo-max" type="number" disabled={form.action_type !== 'percentage'}
                  value={form.action_type === 'percentage' ? form.max_discount : ''}
                  onChange={(e) => setForm({ ...form, max_discount: e.target.value })} />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900">Conditions</h4>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">All must hold. Leave everything blank for a cart-wide offer.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="promo-minsub">Minimum cart total (₹)</Label>
                  <Input id="promo-minsub" type="number" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="promo-minqty">Minimum items</Label>
                  <Input id="promo-minqty" type="number" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} />
                </div>
              </div>

              {collections.length > 0 && (
                <div className="mt-4">
                  <Label>Limit to collections</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {collections.map((c) => {
                      const on = form.collectionSlugs.includes(c.slug)
                      return (
                        <button key={c.slug} type="button"
                          onClick={() => setForm({ ...form, collectionSlugs: toggleIn(form.collectionSlugs, c.slug) })}
                          aria-pressed={on}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            on ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-600 hover:border-gray-500'
                          }`}>
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label htmlFor="promo-product">Limit to specific products</Label>
                <select id="promo-product" value=""
                  onChange={(e) => { if (e.target.value) setForm({ ...form, productSlugs: toggleIn(form.productSlugs, e.target.value) }) }}
                  className="mt-1.5 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Add a product…</option>
                  {products.filter((p) => !form.productSlugs.includes(p.slug)).map((p) => (
                    <option key={p.slug} value={p.slug}>{p.name}</option>
                  ))}
                </select>
                {form.productSlugs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.productSlugs.map((slug) => (
                      <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                        {products.find((p) => p.slug === slug)?.name ?? slug}
                        <button type="button" onClick={() => setForm({ ...form, productSlugs: toggleIn(form.productSlugs, slug) })}
                          aria-label={`Remove ${slug}`} className="text-gray-400 hover:text-gray-900">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="promo-start">Starts</Label>
                <Input id="promo-start" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="promo-end">Ends</Label>
                <Input id="promo-end" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="promo-priority">Priority</Label>
                <Input id="promo-priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Lower runs first.</p>
              </div>
              <div className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="promo-stack" className="font-normal">Stacks with other promotions</Label>
                  <Checkbox id="promo-stack" className="w-5 h-5" checked={form.stackable} onCheckedChange={(v) => setForm({ ...form, stackable: !!v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="promo-active" className="font-normal">Active</Label>
                  <Checkbox id="promo-active" className="w-5 h-5" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
                </div>
              </div>
            </div>

            {!form.stackable && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                Non-stacking: if this promotion applies, no lower-priority promotion is considered. Coupon codes still apply on top.
              </p>
            )}
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
