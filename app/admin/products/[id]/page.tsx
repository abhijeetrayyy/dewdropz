'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getProductByIdAdmin, getCollections, updateProduct } from '@/actions/products'
import { getCategoryTree, getProductCategories, setProductCategories } from '@/actions/categories'
import { getTags, getProductTags, setProductTags } from '@/actions/tags'
import { getAttributes, getProductAttributes, setProductAttributes } from '@/actions/attributes'
import { getProductVariantsAdmin, generateVariants, updateVariant, deleteVariant, deleteAllVariantsForProduct, getInventoryMovements, adjustStock } from '@/actions/variants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { VariantRow } from '@/components/admin/VariantRow'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { MultiCombobox } from '@/components/admin/MultiCombobox'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, PackageOpen, Layers, Hash, Sparkles, Boxes } from 'lucide-react'
import { toast } from 'sonner'
import type { Product, CategoryWithChildren, Tag, AttributeWithValues, VariantWithOptions, InventoryMovementWithDetails } from '@/types/database'

function flattenTree(cats: CategoryWithChildren[]): (CategoryWithChildren & { depth: number })[] {
  const r: (CategoryWithChildren & { depth: number })[] = []
  for (const c of cats) { r.push({ ...c, depth: 0 }); r.push(...flattenTree(c.children).map((x) => ({ ...x, depth: x.depth + 1 }))) }
  return r
}

export default function ProductEditor() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [desc, setDesc] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [price, setPrice] = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [sku, setSku] = useState('')
  const [weight, setWeight] = useState('')
  const [featured, setFeatured] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [collectionId, setCollectionId] = useState('')

  const [allCollections, setAllCollections] = useState<Array<{ id: string; name: string }>>([])
  const [allCategories, setAllCategories] = useState<CategoryWithChildren[]>([])
  const [selectedCats, setSelectedCats] = useState<Record<string, boolean>>({})
  const [primaryCat, setPrimaryCat] = useState('')
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>({})
  const [allAttrs, setAllAttrs] = useState<AttributeWithValues[]>([])
  const [productAttrs, setProductAttrs] = useState<Record<string, { valueId: string; textValue: string }>>({})
  const [variants, setVariants] = useState<VariantWithOptions[]>([])
  const [varAttrs, setVarAttrs] = useState<AttributeWithValues[]>([])
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([])

  const [genDialog, setGenDialog] = useState(false)
  const [selVarAttrs, setSelVarAttrs] = useState<string[]>([])
  const [stockDialog, setStockDialog] = useState(false)
  const [stockForm, setStockForm] = useState({ variantId: '', qty: '', reason: 'restock', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const p = await getProductByIdAdmin(productId)
    if (!p) { setLoading(false); return }
    setProduct(p)
    setName(p.name); setSlug(p.slug); setDesc(p.description ?? ''); setShortDesc(p.short_description ?? '')
    setPrice(String(p.price / 100)); setComparePrice(p.compare_at_price ? String(p.compare_at_price / 100) : '')
    setSku(p.sku ?? ''); setWeight(p.weight ? String(p.weight) : '')
    setFeatured(p.is_featured); setIsActive(p.is_active)
    setMetaTitle(p.meta_title ?? ''); setMetaDesc(p.meta_description ?? '')
    setImages(p.images ?? [])

    try {
      const cats = await getCategoryTree(); setAllCategories(cats)
      const pc = await getProductCategories(productId)
      const sc: Record<string, boolean> = {}; let pr = ''
      for (const c of pc) { sc[c.category_id] = true; if (c.is_primary) pr = c.category_id }
      setSelectedCats(sc); setPrimaryCat(pr)
    } catch { /* */ }
    try {
      const t = await getTags(); setAllTags(t)
      const pt = await getProductTags(productId) as Array<{ tag_id: string }> | undefined
      const st: Record<string, boolean> = {}
      pt?.forEach((x: { tag_id: string }) => (st[x.tag_id] = true))
      setSelectedTags(st)
    } catch { /* */ }
    try {
      const a = await getAttributes(); setAllAttrs(a); setVarAttrs(a.filter((x) => x.is_variant_attribute))
      const pa = (await getProductAttributes(productId)) ?? []
      const pv: Record<string, { valueId: string; textValue: string }> = {}
      for (const x of pa) { pv[x.attribute_id] = { valueId: x.attribute_value_id ?? '', textValue: x.text_value ?? '' } }
      setProductAttrs(pv)
    } catch { /* */ }
    try { setVariants((await getProductVariantsAdmin(productId)) ?? []) } catch { /* */ }
    try { setMovements((await getInventoryMovements(productId)) ?? []) } catch { /* */ }
    setLoading(false)
  }, [productId])

  useEffect(() => { load() }, [load])

  async function saveBasic() {
    setSaving(true)
    try {
      await updateProduct(productId, {
        name, slug, description: desc, short_description: shortDesc,
        price: Math.round(parseFloat(price) * 100),
        compare_at_price: comparePrice ? Math.round(parseFloat(comparePrice) * 100) : null,
        sku: sku || null, weight: weight ? parseFloat(weight) : null,
        is_featured: featured, is_active: isActive,
        meta_title: metaTitle || null,
        meta_description: metaDesc || null,
        images,
      })
      toast.success('Saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function saveCategories() {
    setSaving(true)
    try {
      await setProductCategories(productId, Object.entries(selectedCats).filter(([,v]) => v).map(([id]) => ({ category_id: id, is_primary: id === primaryCat })))
      toast.success('Categories saved')
    } catch { toast.error('Failed to save categories') }
    finally { setSaving(false) }
  }

  async function saveTags() {
    setSaving(true)
    try {
      await setProductTags(productId, Object.entries(selectedTags).filter(([,v]) => v).map(([id]) => id))
      toast.success('Tags saved')
    } catch { toast.error('Failed to save tags') }
    finally { setSaving(false) }
  }

  async function saveAttrs() {
    setSaving(true)
    try {
      await setProductAttributes(productId, Object.entries(productAttrs).map(([id, v]) => ({ attribute_id: id, attribute_value_id: v.valueId || null, text_value: v.textValue || null })))
      toast.success('Attributes saved')
    } catch { toast.error('Failed to save attributes') }
    finally { setSaving(false) }
  }

  async function doGenerateVariants() {
    setSaving(true)
    try {
      await deleteAllVariantsForProduct(productId)
      await generateVariants(productId, selVarAttrs)
      setVariants((await getProductVariantsAdmin(productId)) ?? [])
      setGenDialog(false)
      toast.success('Variants generated')
    } catch { toast.error('Failed to generate variants') }
    finally { setSaving(false) }
  }

  async function doStockAdjust() {
    setSaving(true)
    try {
      await adjustStock({ product_id: productId, variant_id: stockForm.variantId || null, quantity_change: parseInt(stockForm.qty), reason: stockForm.reason as 'restock'|'adjustment'|'damaged', notes: stockForm.notes || undefined })
      setMovements((await getInventoryMovements(productId)) ?? [])
      setStockDialog(false)
      toast.success('Stock adjusted')
    } catch { toast.error('Failed to adjust stock') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading...</div>
  if (!product) return <div className="text-red-600 py-16 text-center">Product not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          <h2 className="text-2xl font-bold tracking-tight text-black mt-1">{product.name}</h2>
          <p className="text-sm text-gray-500">{product.slug}</p>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="basic" className="data-[state=active]:bg-black data-[state=active]:text-white"><PackageOpen className="h-4 w-4 mr-1" /> Basic</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-black data-[state=active]:text-white"><Layers className="h-4 w-4 mr-1" /> Categories</TabsTrigger>
          <TabsTrigger value="tags" className="data-[state=active]:bg-black data-[state=active]:text-white"><Hash className="h-4 w-4 mr-1" /> Tags</TabsTrigger>
          <TabsTrigger value="attributes" className="data-[state=active]:bg-black data-[state=active]:text-white"><Sparkles className="h-4 w-4 mr-1" /> Attributes</TabsTrigger>
          <TabsTrigger value="variants" className="data-[state=active]:bg-black data-[state=active]:text-white"><Boxes className="h-4 w-4 mr-1" /> Variants</TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-black data-[state=active]:text-white">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Slug *</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
                <div><Label>Price (₹) *</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" /></div>
                <div><Label>Compare-at Price (₹)</Label><Input value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} type="number" /></div>
                <div><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
                <div><Label>Weight (g)</Label><Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" /></div>
              </div>
              <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} /></div>
              <div><Label>Short Description</Label><Input value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} /></div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2"><Checkbox checked={featured} onCheckedChange={(v) => setFeatured(!!v)} /><span className="text-sm">Featured</span></label>
                <label className="flex items-center gap-2"><Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} /><span className="text-sm">Active</span></label>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div><Label>Meta Title</Label><Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO title (max 70 chars)" /></div>
                <div><Label>Meta Description</Label><Input value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder="SEO description (max 160 chars)" /></div>
              </div>
              <div>
                <Label>Images</Label>
                <div className="mt-1">
                  <ImageUploader bucket="PRODUCTS" value={images} onChange={setImages} />
                </div>
              </div>
              <Button onClick={saveBasic} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Categories</Label>
                <div className="mt-1">
                  <MultiCombobox
                    options={flattenTree(allCategories).map((c) => ({ value: c.id, label: c.name, depth: c.depth }))}
                    selected={Object.entries(selectedCats).filter(([, v]) => v).map(([id]) => id)}
                    onChange={(ids) => {
                      const next: Record<string, boolean> = {}
                      ids.forEach((id) => { next[id] = true })
                      setSelectedCats(next)
                      if (!ids.includes(primaryCat)) setPrimaryCat(ids[0] ?? '')
                    }}
                    placeholder="Search categories..."
                    emptyText="No matching categories."
                  />
                </div>
              </div>
              {Object.values(selectedCats).some(Boolean) && (
                <div>
                  <Label>Primary Category</Label>
                  <Select value={primaryCat} onValueChange={setPrimaryCat}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose primary" /></SelectTrigger>
                    <SelectContent>
                      {flattenTree(allCategories).filter((c) => selectedCats[c.id]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={saveCategories} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save Categories</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {allTags.map((t) => (
                  <label key={t.id} className={`px-3 py-1 rounded-full text-xs cursor-pointer border transition-colors ${selectedTags[t.id] ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                    <input type="checkbox" checked={!!selectedTags[t.id]} onChange={(e) => setSelectedTags({ ...selectedTags, [t.id]: e.target.checked })} className="hidden" />
                    {t.name}
                  </label>
                ))}
              </div>
              <Button onClick={saveTags} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save Tags</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributes" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {allAttrs.filter((a) => !a.is_variant_attribute).map((a) => (
                <div key={a.id} className="pb-4 border-b border-gray-100 last:border-0">
                  <Label>{a.name}</Label>
                  {a.input_type === 'select' && a.values?.length ? (
                    <Select value={productAttrs[a.id]?.valueId || 'none'} onValueChange={(v) => setProductAttrs({ ...productAttrs, [a.id]: { valueId: v === 'none' ? '' : v, textValue: '' } })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {a.values.map((v) => (<SelectItem key={v.id} value={v.id}>{v.value}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  ) : a.input_type === 'boolean' ? (
                    <Select value={productAttrs[a.id]?.textValue || 'none'} onValueChange={(v) => setProductAttrs({ ...productAttrs, [a.id]: { valueId: '', textValue: v === 'none' ? '' : v } })}>
                      <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={productAttrs[a.id]?.textValue ?? ''} onChange={(e) => setProductAttrs({ ...productAttrs, [a.id]: { valueId: '', textValue: e.target.value } })} placeholder={a.input_type === 'number' ? 'Value' : 'Value'} className="mt-1" />
                  )}
                </div>
              ))}
              {allAttrs.filter((a) => !a.is_variant_attribute).length === 0 && <p className="text-sm text-gray-400">No descriptive attributes. <a href="/admin/attributes" className="text-black underline">Create some</a>.</p>}
              <Button onClick={saveAttrs} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save Attributes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{variants.length} variants</p>
                <div className="flex gap-2">
                  {variants.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={async () => { if (!confirm('Delete all variants?')) return; await deleteAllVariantsForProduct(productId); setVariants([]) }}>Delete All</Button>
                  )}
                  <Button size="sm" onClick={() => setGenDialog(true)}>Generate Variants</Button>
                </div>
              </div>
              {variants.length === 0 ? (
                <p className="text-sm text-gray-400">No variants. Generate from variant attributes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Price Adj</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Threshold</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => (
                      <VariantRow key={v.id} variant={v} onChange={setVariants} variants={variants} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Inventory Movements</p>
                <Button size="sm" onClick={() => { setStockForm({ variantId: '', qty: '', reason: 'restock', notes: '' }); setStockDialog(true) }}>Adjust Stock</Button>
              </div>
              {movements.length === 0 ? (
                <p className="text-sm text-gray-400">No movements recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-gray-500 text-xs">{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell className="text-gray-600 text-sm">{m.variant?.name ?? 'Base product'}</TableCell>
                        <TableCell className={`text-right font-medium ${m.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity_change > 0 ? '+' : ''}{m.quantity_change}</TableCell>
                        <TableCell><Badge variant={m.reason === 'sale' ? 'outline' : m.reason === 'restock' ? 'default' : m.reason === 'damaged' ? 'destructive' : 'secondary'}>{m.reason}</Badge></TableCell>
                        <TableCell className="text-gray-500 text-xs">{m.notes ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Variants Dialog */}
      <Dialog open={genDialog} onOpenChange={setGenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Variants</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Select variant attributes. All combinations will be generated (replaces existing).</p>
          <div className="space-y-2">
            {varAttrs.map((a) => (
              <label key={a.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <Checkbox checked={selVarAttrs.includes(a.id)} onCheckedChange={(v) => {
                  if (v) setSelVarAttrs([...selVarAttrs, a.id]); else setSelVarAttrs(selVarAttrs.filter((id) => id !== a.id))
                }} />
                <span className="text-sm">{a.name}</span>
                <span className="text-xs text-gray-400">({a.values?.length ?? 0} values)</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialog(false)}>Cancel</Button>
            <Button onClick={doGenerateVariants} disabled={saving || selVarAttrs.length === 0}>{saving ? 'Generating...' : 'Generate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={stockDialog} onOpenChange={setStockDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Variant</Label>
              <Select value={stockForm.variantId || 'none'} onValueChange={(v) => setStockForm({ ...stockForm, variantId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Base product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Base product (no variant)</SelectItem>
                  {variants.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantity Change *</Label><Input value={stockForm.qty} onChange={(e) => setStockForm({ ...stockForm, qty: e.target.value })} type="number" placeholder="+10 or -5" /></div>
            <div>
              <Label>Reason</Label>
              <Select value={stockForm.reason} onValueChange={(v) => setStockForm({ ...stockForm, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialog(false)}>Cancel</Button>
            <Button onClick={doStockAdjust} disabled={saving || !stockForm.qty}>{saving ? 'Adjusting...' : 'Adjust'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
